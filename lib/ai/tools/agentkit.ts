import { DataStreamWriter, tool } from 'ai';
import { Session } from 'next-auth';
import {
  AgentKit,
  cdpApiActionProvider,
  erc721ActionProvider,
  pythActionProvider,
  walletActionProvider,
  SmartWalletProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";

// 钱包数据类型
type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
};

// 初始化 AgentKit 并获取工具
export async function initializeAgentKit() {
  try {
    const networkId = process.env.NETWORK_ID || "base-sepolia";
    const walletDataFile = `wallet_data_${networkId.replace(/-/g, "_")}.txt`;

    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;

    // 读取现有钱包数据
    if (fs.existsSync(walletDataFile)) {
      try {
        walletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8")) as WalletData;
        privateKey = walletData.privateKey;
      } catch (error) {
        console.error(`读取${networkId}钱包数据出错:`, error);
      }
    }

    if (!privateKey) {
      if (walletData?.smartWalletAddress) {
        throw new Error(
          `找到智能钱包但未提供私钥。请提供私钥或删除${walletDataFile}并重试。`
        );
      }
      privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    }

    const signer = privateKeyToAccount(privateKey);

    // 配置智能钱包提供程序
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: walletData?.smartWalletAddress,
      paymasterUrl: undefined, // 交易赞助: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    });

    const agentKit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
        }),
        erc721ActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
      ],
    });

    // 保存钱包数据
    const smartWalletAddress = await walletProvider.getAddress();
    fs.writeFileSync(
      walletDataFile,
      JSON.stringify({
        privateKey,
        smartWalletAddress,
      } as WalletData)
    );

    // 获取Vercel AI SDK工具
    const tools = getVercelAITools(agentKit);
    return tools;
  } catch (error) {
    console.error("初始化 AgentKit 失败:", error);
    throw error;
  }
}

interface AgentKitToolsProps {
  session: Session;
  dataStream: DataStreamWriter;
}

// 导出AgentKit工具的封装，以便在chat/route.ts中使用
export function getAgentKitTools({ session, dataStream }: AgentKitToolsProps) {
  return initializeAgentKit();
} 