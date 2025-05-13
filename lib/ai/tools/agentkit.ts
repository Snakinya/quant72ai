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
import { getWalletByUserId, saveWallet, WalletData } from '../../db/wallet-queries';
import { auth } from '@/app/(auth)/auth';

// 全局变量类型定义
type AgentKitState = {
  privateKey: Hex;
  smartWalletAddress: Address;
};
const cdpApiKeyName = "6cda8ad3-a962-4413-9ed8-afe3b9334967";
const cdpApiKeyPrivateKey = "BfvHyayPQo7eP5EdYyXf7Fb+AGE1pipZDsZ6OqHm5DvkfHVUXF5um89EHTFJQwaYXIj6ZNz5bFXydY8UNoNUPQ=="
// Global variables to store AgentKit state
// 使用 Map 存储每个用户的 AgentKit 状态，避免共享全局变量
const userAgentKitMap = new Map<string, {
  agentKit: AgentKit;
  walletProvider: SmartWalletProvider;
  smartWalletAddress: Address;
  currentNetworkId: string;
}>();

export let walletProvider: SmartWalletProvider | null = null;
let smartWalletAddress: Address | null = null;
export let currentNetworkId: string = '';

// Initialize AgentKit and get tools
export async function initializeAgentKit() {
  try {
    // 获取当前用户信息
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    // 检查该用户是否已有初始化的 AgentKit
    if (userAgentKitMap.has(userId)) {
      const userState = userAgentKitMap.get(userId)!;
      console.log(`✅ 用户 ${userId} 的 AgentKit 已初始化，直接复用`);
      
      // 更新全局变量以兼容现有代码
      walletProvider = userState.walletProvider;
      smartWalletAddress = userState.smartWalletAddress;
      currentNetworkId = userState.currentNetworkId;
      
      return getVercelAITools(userState.agentKit);
    }

    console.log(`🚀 为用户 ${userId} 初始化 AgentKit...`);
    const networkId = process.env.NETWORK_ID || "base-mainnet";
    currentNetworkId = networkId;
    
    let privateKey: Hex | null = null;
    let walletData: AgentKitState | null = null;

    // 如果有用户登录，尝试从数据库获取钱包信息
    if (userId !== 'anonymous') {
      console.log(`👤 用户已登录，ID: ${userId}`);
      const userWallet = await getWalletByUserId(userId);
      
      if (userWallet) {
        console.log(`🎉 找到用户钱包，地址: ${userWallet.smartWalletAddress}`);
        privateKey = userWallet.privateKey as Hex;
        smartWalletAddress = userWallet.smartWalletAddress as Address;
        walletData = {
          privateKey,
          smartWalletAddress
        };
      } else {
        console.log(`⚠️ 用户没有钱包，将创建新钱包`);
      }
    } else {
      console.log(`⚠️ 用户未登录，将使用临时钱包`);
      // 如果用户未登录，尝试使用临时文件
      const walletDataFile = `/tmp/wallet_data_${networkId.replace(/-/g, "_")}.txt`;
      
      if (fs.existsSync(walletDataFile)) {
        console.log(`📁 临时钱包数据文件存在: ${walletDataFile}`);
        try {
          const tempWalletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8"));
          privateKey = tempWalletData.privateKey as Hex;
          smartWalletAddress = tempWalletData.smartWalletAddress as Address;
          walletData = {
            privateKey,
            smartWalletAddress
          };
          console.log(`🎉 读取临时钱包成功，地址: ${smartWalletAddress}`);
        } catch (error) {
          console.error(`❌ 读取临时钱包数据失败:`, error);
        }
      }
    }

    // 如果没有找到私钥，始终生成新的，不使用环境变量中的私钥
    if (!privateKey) {
      // 删除使用环境变量私钥的逻辑，确保每个用户获得唯一的私钥
      privateKey = generatePrivateKey() as Hex;
      console.log(`🆕 为用户 ${userId} 生成新私钥`);
    }
 
    const signer = privateKeyToAccount(privateKey);
    console.log(`⚙️ 配置智能钱包提供商...`);
    
    walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: smartWalletAddress || undefined,
      paymasterUrl: undefined,
    });
    console.log(`✅ 智能钱包配置完成`);
    smartWalletAddress = walletProvider.getAddress() as Address;
    
    // 如果用户已登录，将钱包信息保存到数据库
    if (userId !== 'anonymous') {
      await saveWallet({
        userId,
        privateKey,
        smartWalletAddress,
        networkId
      });
      console.log(`💾 保存用户钱包到数据库成功`);
    } else {
      // 否则保存到临时文件
      const walletDataFile = `/tmp/wallet_data_${networkId.replace(/-/g, "_")}.txt`;
      fs.writeFileSync(
        walletDataFile,
        JSON.stringify({
          privateKey,
          smartWalletAddress,
        })
      );
      console.log(`💾 保存临时钱包数据成功: ${walletDataFile}`);
    }
    
    const newAgentKit = await AgentKit.from({
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

    // 检查钱包地址是否变化
    const currentAddress = await walletProvider.getAddress() as Address;
    if (currentAddress !== smartWalletAddress) {
      console.log(`⚠️ 钱包地址变化，更新记录`);
      smartWalletAddress = currentAddress;
      
      // 如果用户已登录，更新数据库中的钱包地址
      if (userId !== 'anonymous') {
        await saveWallet({
          userId,
          privateKey,
          smartWalletAddress,
          networkId
        });
        console.log(`💾 更新用户钱包地址到数据库成功`);
      } else {
        // 否则更新临时文件
        const walletDataFile = `/tmp/wallet_data_${networkId.replace(/-/g, "_")}.txt`;
        fs.writeFileSync(
          walletDataFile,
          JSON.stringify({
            privateKey,
            smartWalletAddress,
          })
        );
      }
    }

    // 保存用户的 AgentKit 状态到 Map 中
    userAgentKitMap.set(userId, {
      agentKit: newAgentKit,
      walletProvider,
      smartWalletAddress,
      currentNetworkId
    });

    console.log(`💡 用户 ${userId} 的钱包地址: ${smartWalletAddress}`);
    console.log(`🌐 网络: ${networkId}`);
    console.log(`🔗 链 ID: ${currentNetworkId === 'base-sepolia' ? 84532 : 8453}`);
    console.log(`🧩 启用 action providers: cdpApi, erc721, pyth, wallet, morpho`);

    return getVercelAITools(newAgentKit);
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
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    if (userAgentKitMap.has(userId)) {
      const userState = userAgentKitMap.get(userId)!;
      return {
        walletAddress: userState.smartWalletAddress,
        network: userState.currentNetworkId,
      };
    }
    
    // 如果没有用户状态，初始化 AgentKit
    if (!smartWalletAddress || !walletProvider) {
      console.log(`🚨 用户 ${userId} 的钱包未初始化，在 getMyWalletAddress 执行初始化...`);
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
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    let userWalletProvider: SmartWalletProvider | null = null;
    let userSmartWalletAddress: Address | null = null;
    let userNetworkId: string = '';
    
    // 尝试获取用户特定的状态
    if (userAgentKitMap.has(userId)) {
      const userState = userAgentKitMap.get(userId)!;
      userWalletProvider = userState.walletProvider;
      userSmartWalletAddress = userState.smartWalletAddress;
      userNetworkId = userState.currentNetworkId;
    } else {
      // 如果没有用户状态，初始化 AgentKit
      if (!walletProvider || !smartWalletAddress) {
        console.log(`🚨 用户 ${userId} 的钱包未初始化，在 getMyTokenBalance 执行初始化...`);
        await initializeAgentKit();
      }
      
      userWalletProvider = walletProvider;
      userSmartWalletAddress = smartWalletAddress;
      userNetworkId = currentNetworkId;
    }

    if (!userWalletProvider || !userSmartWalletAddress) {
      throw new Error('Wallet still not initialized after attempt.');
    }

    try {
      const nativeBalance = await userWalletProvider.getBalance();

      return {
        provider: 'cdp_smart_wallet_provider',
        address: userSmartWalletAddress,
        network: {
          protocolFamily: 'evm',
          networkId: userNetworkId,
          chainId: userNetworkId === 'base-mainnet' ? 8453 : 8453
        },
        nativeBalance: nativeBalance ? `${nativeBalance} WEI` : '0 WEI',
        tokens: []
      };
    } catch (error) {
      console.error("❌ Failed to get token balance:", error);
      return {
        provider: 'cdp_smart_wallet_provider',
        address: userSmartWalletAddress,
        network: {
          protocolFamily: 'evm',
          networkId: userNetworkId,
          chainId: userNetworkId === 'base-mainnet' ? 8453 : 8453
        },
        nativeBalance: '0 WEI',
        tokens: []
      };
    }
  },
});

// Transfer tokens tool
export const transferTokens = tool({
  description: 'Transfer native tokens (ETH) from your wallet to another address',
  parameters: z.object({
    toAddress: z.string().describe('The destination Ethereum address to send tokens to'),
    amount: z.string().describe('The amount to send in WEI (e.g. "1000000000000000" for 0.001 ETH)'),
  }),
  execute: async ({ toAddress, amount }) => {
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    let userWalletProvider: SmartWalletProvider | null = null;
    let userSmartWalletAddress: Address | null = null;
    let userNetworkId: string = '';
    
    // 尝试获取用户特定的状态
    if (userAgentKitMap.has(userId)) {
      const userState = userAgentKitMap.get(userId)!;
      userWalletProvider = userState.walletProvider;
      userSmartWalletAddress = userState.smartWalletAddress;
      userNetworkId = userState.currentNetworkId;
    } else {
      // 如果没有用户状态，初始化 AgentKit
      if (!walletProvider) {
        console.log(`🚨 用户 ${userId} 的钱包未初始化，在 transferTokens 执行初始化...`);
        await initializeAgentKit();
      }
      
      userWalletProvider = walletProvider;
      userSmartWalletAddress = smartWalletAddress;
      userNetworkId = currentNetworkId;
    }

    if (!userWalletProvider || !userSmartWalletAddress) {
      throw new Error('Wallet still not initialized after attempt.');
    }

    try {
      console.log(`🔄 准备转账: ${amount} WEI 到 ${toAddress}`);
      
      // 验证接收地址格式
      if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
        throw new Error('Invalid Ethereum address format. Address must start with 0x and be 42 characters long.');
      }
      
      // 验证金额为有效数字
      const amountBigInt = BigInt(amount);
      if (amountBigInt <= 0n) {
        throw new Error('Amount must be greater than 0');
      }
      
      // 检查余额是否足够
      const balance = await userWalletProvider.getBalance();
      console.log(`💰 当前余额: ${balance} WEI`);
      
      if (balance < amountBigInt) {
        return {
          success: false,
          error: `Insufficient funds. Current balance: ${balance} WEI, Requested amount: ${amount} WEI`,
          transaction: null,
        };
      }
      
      // 执行转账
      const txHash = await userWalletProvider.sendTransaction({
        to: toAddress as Address,
        value: amountBigInt,
      });
      
      console.log(`✅ 转账成功: ${txHash}`);
      
      return {
        success: true,
        transaction: {
          hash: txHash,
          from: userSmartWalletAddress,
          to: toAddress,
          amount: amount,
          network: userNetworkId,
          explorerLink: `${userNetworkId === 'base-sepolia' 
            ? 'https://sepolia.basescan.org/tx/' 
            : 'https://basescan.org/tx/'}${txHash}`,
        },
      };
    } catch (error) {
      console.error("❌ 转账失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during transfer',
        transaction: null,
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
        transferTokens,
      };
    }

    // 确保 AgentKit 为当前用户初始化
    const userId = session?.user?.id || 'anonymous';
    console.log(`🔍 获取用户 ${userId} 的 AgentKit 工具`);

    // ✅ 强制初始化，确保冷启动可用
    await initializeAgentKit();

    // 获取用户特定的工具
    let agentKitTools;
    
    if (userAgentKitMap.has(userId)) {
      const userState = userAgentKitMap.get(userId)!;
      console.log(`✅ 使用用户 ${userId} 已初始化的 AgentKit`);
      agentKitTools = await getVercelAITools(userState.agentKit);
    } else {
      console.log(`⚠️ 用户 ${userId} 的 AgentKit 未找到，使用默认初始化`);
      agentKitTools = await initializeAgentKit();
    }

    return {
      ...agentKitTools,
      getMyWalletAddress,
      getMyTokenBalance,
      getMorphoVaults: getMorphoVaultsFromAPI,
      transferTokens,
    };
  } catch (error) {
    console.error("❌ 获取 AgentKit tools 失败:", error);
    return {
      getMyWalletAddress,
      getMyTokenBalance,
      getMorphoVaults: getMorphoVaultsFromAPI,
      transferTokens,
    };
  }
}
