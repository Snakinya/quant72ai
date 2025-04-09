import { Session } from 'next-auth';
import {
  AgentKit,
  cdpApiActionProvider,
  erc721ActionProvider,
  pythActionProvider,
  walletActionProvider,
  SmartWalletProvider,
} from '@coinbase/agentkit';
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { DataStreamWriter, ToolSet } from 'ai';
import { Address, Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import fs from 'fs/promises';
import path from 'path';

// 定义钱包数据类型
type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
};

/**
 * 初始化AgentKit并获取工具供AI使用
 * 
 * @param session 用户会话信息
 * @param dataStream AI数据流
 * @returns AgentKit工具集
 */
export const initializeAgentKit = async ({
  session,
  dataStream,
}: {
  session: Session;
  dataStream: DataStreamWriter;
}) => {
  try {
    if (!session.user?.id) {
      throw new Error('User not authenticated');
    }
    
    // 获取环境变量
    const networkId = process.env.NETWORK_ID || 'base-sepolia';
    const cdpApiKeyName = process.env.CDP_API_KEY_NAME;
    const cdpApiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;

    // 确保必要的环境变量存在
    if (!cdpApiKeyName || !cdpApiKeyPrivateKey) {
      console.error('Missing required environment variables for AgentKit');
      throw new Error('Missing required environment variables for AgentKit');
    }

    // 根据用户ID和网络ID创建钱包数据文件路径
    const walletDir = path.join(process.cwd(), 'wallets');
    try {
      await fs.mkdir(walletDir, { recursive: true });
    } catch (error) {
      console.error('Error creating wallet directory:', error);
    }
    
    const walletDataFile = path.join(
      walletDir,
      `wallet_${session.user.id}_${networkId.replace(/-/g, '_')}.json`
    );

    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;

    // 读取现有钱包数据（如果存在）
    try {
      const fileData = await fs.readFile(walletDataFile, 'utf8');
      walletData = JSON.parse(fileData) as WalletData;
      privateKey = walletData.privateKey;
    } catch (error) {
      // 如果文件不存在或读取错误，继续创建新钱包
      console.log(`No existing wallet found or error reading wallet data, creating new wallet`);
    }

    // 如果没有私钥，生成一个新的
    if (!privateKey) {
      privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    }

    // 创建签名者
    const signer = privateKeyToAccount(privateKey);

    // 配置智能钱包提供者
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: walletData?.smartWalletAddress,
      paymasterUrl: process.env.PAYMASTER_URL,
    });

    // 初始化AgentKit
    const agentKit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        cdpApiActionProvider({
          apiKeyName: cdpApiKeyName,
          apiKeyPrivateKey: cdpApiKeyPrivateKey,
        }),
        erc721ActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
      ],
    });

    // 保存钱包数据
    const smartWalletAddress = await walletProvider.getAddress();
    await fs.writeFile(
      walletDataFile,
      JSON.stringify({
        privateKey,
        smartWalletAddress,
      } as WalletData),
    );

    // 获取Vercel AI SDK兼容的工具
    const tools = getVercelAITools(agentKit) as ToolSet;
    console.log(`AgentKit initialized with ${Object.keys(tools).length} tools for wallet ${smartWalletAddress} on ${networkId}`);
    return tools;
  } catch (error) {
    console.error('Failed to initialize AgentKit:', error);
    throw error;
  }
}; 