import { DataStreamWriter, tool } from 'ai';
import { Session } from 'next-auth';
import {
  AgentKit,
  cdpApiActionProvider,
  erc721ActionProvider,
  pythActionProvider,
  walletActionProvider,
  SmartWalletProvider,
  morphoActionProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import { z } from 'zod';
import { getMorphoVaults as getMorphoVaultsFromAPI } from './morpho';

// Wallet data type
type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
};

// Global variables to store AgentKit state
let agentKit: AgentKit | null = null;
export let walletProvider: SmartWalletProvider | null = null;
let smartWalletAddress: Address | null = null;
export let currentNetworkId: string = '';

// Initialize AgentKit and get tools
export async function initializeAgentKit() {
  try {
    if (agentKit && walletProvider && smartWalletAddress) {
      console.log("✅ AgentKit 已初始化，直接复用");
      return getVercelAITools(agentKit);
    }

    console.log("🚀 正在初始化 AgentKit...");
    const networkId = process.env.NETWORK_ID || "base-mainnet";
    currentNetworkId = networkId;
    const walletDataFile = `wallet_data_${networkId.replace(/-/g, "_")}.txt`;

    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;

    if (fs.existsSync(walletDataFile)) {
      console.log(`📁 钱包数据文件存在: ${walletDataFile}`);
      try {
        walletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8")) as WalletData;
        privateKey = walletData.privateKey;
        console.log(`🎉 读取成功，钱包地址: ${walletData.smartWalletAddress}`);
      } catch (error) {
        console.error(`❌ 读取钱包数据失败:`, error);
        walletData = null;
      }
    }

    if (!privateKey) {
      if (walletData?.smartWalletAddress) {
        throw new Error(
          `钱包文件存在但缺失私钥，请检查 ${walletDataFile} 文件。`
        );
      }

      if (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith('0x')) {
        privateKey = process.env.PRIVATE_KEY as Hex;
        console.log(`🔑 使用环境变量中的私钥`);
      } else {
        privateKey = generatePrivateKey();
        console.log(`🆕 生成新私钥: ${privateKey}`);
      }
    }

    const signer = privateKeyToAccount(privateKey);
    if (!walletData?.smartWalletAddress) {
      smartWalletAddress = signer.address as Address;
      fs.writeFileSync(
        walletDataFile,
        JSON.stringify({
          privateKey,
          smartWalletAddress,
        } as WalletData)
      );
      console.log(`💾 保存钱包数据成功: ${walletDataFile}`);
    } else {
      smartWalletAddress = walletData.smartWalletAddress;
    }

    console.log(`⚙️ 配置智能钱包提供商...`);
    walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: smartWalletAddress,
      paymasterUrl: undefined,
    });
    console.log(`✅ 智能钱包配置完成`);

    agentKit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME!,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
        }),
        erc721ActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        morphoActionProvider(),
      ],
    });

    console.log(`✅ AgentKit 初始化完成`);

    const currentAddress = await walletProvider.getAddress() as Address;
    if (currentAddress !== smartWalletAddress) {
      console.log(`⚠️ 钱包地址变化，更新文件`);
      smartWalletAddress = currentAddress;
      fs.writeFileSync(
        walletDataFile,
        JSON.stringify({
          privateKey,
          smartWalletAddress,
        } as WalletData)
      );
    }

    console.log(`💡 钱包地址: ${smartWalletAddress}`);
    console.log(`🌐 网络: ${networkId}`);
    console.log(`🔗 链 ID: ${currentNetworkId === 'base-sepolia' ? 84532 : 8453}`);
    console.log(`🧩 启用 action providers: cdpApi, erc721, pyth, wallet, morpho`);

    return getVercelAITools(agentKit);
  } catch (error) {
    console.error("❌ AgentKit 初始化失败:", error);
    throw error;
  }
}

// Get my wallet address tool
export const getMyWalletAddress = tool({
  description: 'Get the current smart wallet address and network information',
  parameters: z.object({}),
  execute: async () => {
    if (!smartWalletAddress || !walletProvider) {
      console.log('🚨 钱包未初始化，在 getMyWalletAddress 执行初始化...');
      await initializeAgentKit();
    }

    if (!smartWalletAddress || !walletProvider) {
      throw new Error('Wallet still not initialized after attempt.');
    }

    return {
      walletAddress: smartWalletAddress,
      network: currentNetworkId,
    };
  },
});

// Get my token balance tool
export const getMyTokenBalance = tool({
  description: 'Get token balance information for the current smart wallet',
  parameters: z.object({}),
  execute: async () => {
    if (!smartWalletAddress || !walletProvider) {
      console.log('🚨 钱包未初始化，在 getMyTokenBalance 执行初始化...');
      await initializeAgentKit();
    }

    if (!smartWalletAddress || !walletProvider) {
      throw new Error('Wallet still not initialized after attempt.');
    }

    try {
      const nativeBalance = await walletProvider.getBalance();

      return {
        provider: 'cdp_smart_wallet_provider',
        address: smartWalletAddress,
        network: {
          protocolFamily: 'evm',
          networkId: currentNetworkId,
          chainId: currentNetworkId === 'base-sepolia' ? 84532 : 8453
        },
        nativeBalance: nativeBalance ? `${nativeBalance} WEI` : '0 WEI',
        tokens: []
      };
    } catch (error) {
      console.error("❌ Failed to get token balance:", error);
      return {
        provider: 'cdp_smart_wallet_provider',
        address: smartWalletAddress,
        network: {
          protocolFamily: 'evm',
          networkId: currentNetworkId,
          chainId: currentNetworkId === 'base-sepolia' ? 84532 : 8453
        },
        nativeBalance: '0 WEI',
        tokens: []
      };
    }
  },
});

interface AgentKitToolsProps {
  session: Session;
  dataStream: DataStreamWriter;
}

// AgentKit tools export function
export async function getAgentKitTools({ session, dataStream }: AgentKitToolsProps) {
  try {
    if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
      console.warn("⚠️ 缺少环境变量，跳过 AgentKit 初始化");
      return {
        getMyWalletAddress,
        getMyTokenBalance,
        getMorphoVaults: getMorphoVaultsFromAPI,
      };
    }

    // ✅ 强制初始化，确保冷启动可用
    await initializeAgentKit();

    const agentKitTools = await initializeAgentKit();

    return {
      ...agentKitTools,
      getMyWalletAddress,
      getMyTokenBalance,
      getMorphoVaults: getMorphoVaultsFromAPI,
    };
  } catch (error) {
    console.error("❌ 获取 AgentKit tools 失败:", error);
    return {
      getMyWalletAddress,
      getMyTokenBalance,
      getMorphoVaults: getMorphoVaultsFromAPI,
    };
  }
}
