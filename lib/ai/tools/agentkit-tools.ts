import { 
  AgentKit, 
  CdpWalletProvider, 
  basenameActionProvider,
  morphoActionProvider,
  walletActionProvider,
  cdpWalletActionProvider,
  cdpApiActionProvider
} from '@coinbase/agentkit';
import { base, baseSepolia } from 'viem/chains';

// AgentKit 单例实例
let agentKitInstance: any = null;

// 获取 AgentKit 实例
export async function getAgentKit() {
  // 如果已初始化，直接返回
  if (agentKitInstance) return agentKitInstance;

  try {
    // 获取环境变量
    const apiKeyName = process.env.COINBASE_API_KEY_NAME;
    const privateKey = process.env.COINBASE_API_PRIVATE_KEY;
    const seedPhrase = process.env.SEED_PHRASE;
    const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : base.id;
    
    if (!apiKeyName || !privateKey || !seedPhrase) {
      throw new Error('缺少必要的 AgentKit 环境变量');
    }

    // 配置钱包提供者
    const cdpWalletProvider = await CdpWalletProvider.configureWithWallet({
      mnemonicPhrase: seedPhrase,
      apiKeyName,
      apiKeyPrivateKey: privateKey,
      networkId: chainId === baseSepolia.id ? 'base-sepolia' : 'base-mainnet',
    });

    // 初始化 AgentKit
    agentKitInstance = await AgentKit.from({
      cdpApiKeyName: apiKeyName,
      cdpApiKeyPrivateKey: privateKey,
      walletProvider: cdpWalletProvider,
      actionProviders: [
        basenameActionProvider(),
        morphoActionProvider(),
        walletActionProvider(),
        cdpWalletActionProvider({
          apiKeyName,
          apiKeyPrivateKey: privateKey,
        }),
        cdpApiActionProvider({
          apiKeyName,
          apiKeyPrivateKey: privateKey,
        }),
      ],
    });

    console.log('AgentKit 初始化成功');
    return agentKitInstance;
  } catch (error) {
    console.error('AgentKit 初始化失败:', error);
    throw error;
  }
}

// 获取 Vercel AI SDK 兼容的工具
export async function getAgentKitTools() {
  try {
    const agentKit = await getAgentKit();
    let tools = {};
    
    // 适配不同版本的 AgentKit API
    if (typeof agentKit.getVercelAiTools === 'function') {
      tools = agentKit.getVercelAiTools();
    } else if (typeof agentKit.tools === 'function') {
      const toolsResult = agentKit.tools();
      if (toolsResult.vercelAiTools) {
        tools = toolsResult.vercelAiTools;
      } else {
        tools = toolsResult;
      }
    }
    
    return tools;
  } catch (error) {
    console.error('获取 AgentKit 工具失败:', error);
    return {};
  }
} 