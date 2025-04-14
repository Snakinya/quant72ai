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
    // If already initialized, return existing tools
    if (agentKit) {
      console.log("Using existing AgentKit instance");
      console.log(`当前网络ID: ${currentNetworkId}`);
      console.log(`当前钱包地址: ${smartWalletAddress}`);
      return getVercelAITools(agentKit);
    }

    console.log("Initializing AgentKit...");
    const networkId = process.env.NETWORK_ID || "base-mainnet";
    currentNetworkId = networkId;
    console.log(`使用的网络ID: ${networkId}`);
    const walletDataFile = `wallet_data_${networkId.replace(/-/g, "_")}.txt`;
    console.log(`钱包数据文件: ${walletDataFile}`);

    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;

    // Read existing wallet data
    if (fs.existsSync(walletDataFile)) {
      console.log(`钱包数据文件存在，尝试读取: ${walletDataFile}`);
      try {
        walletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8")) as WalletData;
        privateKey = walletData.privateKey;
        console.log(`读取现有钱包数据成功，钱包地址: ${walletData.smartWalletAddress}`);
      } catch (error) {
        console.error(`Error reading ${networkId} wallet data:`, error);
        walletData = null;
      }
    } else {
      console.log(`钱包数据文件不存在: ${walletDataFile}`);
    }

    if (!privateKey) {
      if (walletData?.smartWalletAddress) {
        throw new Error(
          `Smart wallet found but no private key provided. Please provide a private key or delete ${walletDataFile} and try again.`
        );
      }
      // Safely handle private key
      if (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith('0x')) {
        privateKey = process.env.PRIVATE_KEY as Hex;
        console.log(`使用环境变量中的私钥`);
      } else {
        privateKey = generatePrivateKey();
        console.log(`生成了新的私钥: ${privateKey}`);
      }
    }

    const signer = privateKeyToAccount(privateKey);
    console.log(`Signer详情:`);
    console.log(`- 地址: ${signer.address}`);
    console.log(`- 类型: ${signer.type}`);

    // 在第一次运行时，直接使用signer地址作为smartWalletAddress
    if (!walletData || !walletData.smartWalletAddress) {
      console.log(`第一次运行，使用signer地址作为smartWalletAddress: ${signer.address}`);
      smartWalletAddress = signer.address as Address;
      
      // 保存钱包数据
      fs.writeFileSync(
        walletDataFile,
        JSON.stringify({
          privateKey,
          smartWalletAddress,
        } as WalletData)
      );
      console.log(`已保存初始钱包数据到: ${walletDataFile}`);
    } else {
      smartWalletAddress = walletData.smartWalletAddress;
    }

    // 在配置前输出所有参数详情
    console.log(`==============配置智能钱包提供商的参数==============`);
    console.log(`networkId: ${networkId}`);
    console.log(`signer地址: ${signer.address}`);
    console.log(`smartWalletAddress: ${smartWalletAddress}`);
    console.log(`paymasterUrl: undefined`);
    console.log(`======================================================`);

    // Configure smart wallet provider
    console.log(`正在配置智能钱包提供商...`);
    walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: smartWalletAddress,
      paymasterUrl: undefined, // Transaction sponsorship: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    });
    console.log(`智能钱包提供商配置完成`);

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
    console.log(`AgentKit初始化完成`);

    // 重新保存钱包数据以防有变化
    const currentAddress = await walletProvider.getAddress() as Address;
    if (currentAddress !== smartWalletAddress) {
      console.log(`注意: 初始化后的地址(${currentAddress})与之前的地址(${smartWalletAddress})不同，更新地址`);
      smartWalletAddress = currentAddress;
      
      fs.writeFileSync(
        walletDataFile,
        JSON.stringify({
          privateKey,
          smartWalletAddress,
        } as WalletData)
      );
      console.log(`已更新钱包数据到: ${walletDataFile}`);
    }

    console.log(`智能钱包地址: ${smartWalletAddress}`);
    console.log(`网络: ${networkId}`);
    console.log(`链ID: ${currentNetworkId === 'base-sepolia' ? 84532 : 8453}`);
    console.log(`启用的操作提供商: cdpApi, erc721, pyth, wallet, morpho`);
    
    // Get Vercel AI SDK tools
    const tools = getVercelAITools(agentKit);
    return tools;
  } catch (error) {
    console.error("初始化AgentKit失败:", error);
    throw error;
  }
}

// Get my wallet address tool
export const getMyWalletAddress = tool({
  description: 'Get the current smart wallet address and network information',
  parameters: z.object({}),
  execute: async () => {
    if (!smartWalletAddress || !walletProvider) {
      throw new Error('Wallet not initialized');
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
      throw new Error('Wallet not initialized');
    }
    
    try {
      // Get native token balance (ETH/BASE etc.)
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
        tokens: [] // For future ERC20 token balances, can be extended here
      };
    } catch (error) {
      console.error("Failed to get token balance:", error);
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

// Export AgentKit tools wrapper for use in chat/route.ts
export async function getAgentKitTools({ session, dataStream }: AgentKitToolsProps) {
  try {
    // Check for required environment variables
    if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
      console.warn("Missing environment variables required for AgentKit, wallet features will not be initialized");
      return {
        getMyWalletAddress,
        getMyTokenBalance,
        getMorphoVaults: getMorphoVaultsFromAPI,
      };
    }
    
    const agentKitTools = await initializeAgentKit();
    
    // Merge AgentKit tools and custom tools
    return {
      ...agentKitTools,
      getMyWalletAddress,
      getMyTokenBalance,
      getMorphoVaults: getMorphoVaultsFromAPI,
    };
  } catch (error) {
    console.error("Failed to get AgentKit tools:", error);
    // Even if AgentKit initialization fails, still return custom tools
    return {
      getMyWalletAddress,
      getMyTokenBalance,
      getMorphoVaults: getMorphoVaultsFromAPI,
    };
  }
} 