import { tool } from 'ai';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { getWalletByUserId, saveWallet } from '../../db/wallet-queries';
import { Address, Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { experimental_createMCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// 预定义MCP工具的参数模式
const MCP_TOOL_SCHEMAS = {
  // 区块链基础工具
  'get_block_by_hash': {
    parameters: z.object({
      blockHash: z.string().describe("The block hash to look up"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_block_by_number': {
    parameters: z.object({
      blockNumber: z.string().describe("The block number to look up"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_latest_block': {
    parameters: z.object({
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'is_contract': {
    parameters: z.object({
      address: z.string().describe("The wallet or contract address to check"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  
  // 智能合约交互
  'read_contract': {
    parameters: z.object({
      contractAddress: z.string().describe("The address of the smart contract to interact with"),
      abi: z.array(z.object({}).passthrough()).describe("The ABI of the smart contract function"),
      functionName: z.string().describe("The name of the function to call on the contract"),
      args: z.array(
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.object({}).passthrough()
        ])
      ).optional().describe("The arguments to pass to the function"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'write_contract': {
    parameters: z.object({
      contractAddress: z.string().describe("The address of the smart contract to interact with"),
      abi: z.array(z.object({}).passthrough()).describe("The ABI of the smart contract function"),
      functionName: z.string().describe("The name of the function to call on the contract"),
      args: z.array(
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.object({}).passthrough()
        ])
      ).describe("The arguments to pass to the function"),
      privateKey: z.string().optional().describe("Private key for signing transaction"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  
  // 链信息工具
  'get_chain_info': {
    parameters: z.object({
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_supported_networks': {
    parameters: z.object({})
  },
  'resolve_ens': {
    parameters: z.object({
      ensName: z.string().describe("ENS name to resolve (e.g., 'vitalik.eth')"),
      network: z.string().default("eth").describe("Network name or chain ID. Defaults to Ethereum mainnet.")
    })
  },
  
  // 代币工具
  'get_erc20_token_info': {
    parameters: z.object({
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_native_balance': {
    parameters: z.object({
      address: z.string().describe("The address to check balance for"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_erc20_balance': {
    parameters: z.object({
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      address: z.string().describe("The address to check balance for"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  
  // 交易工具
  'get_transaction': {
    parameters: z.object({
      txHash: z.string().describe("The transaction hash to look up"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_transaction_receipt': {
    parameters: z.object({
      txHash: z.string().describe("The transaction hash to look up"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'estimate_gas': {
    parameters: z.object({
      to: z.string().describe("The recipient address"),
      value: z.string().optional().describe("The amount of ETH to send in ether"),
      data: z.string().optional().describe("The transaction data as a hex string"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  
  // 转账工具
  'transfer_native_token': {
    parameters: z.object({
      privateKey: z.string().optional().describe("Private key of the sender account"),
      to: z.string().describe("The recipient address or ENS name"),
      amount: z.string().describe("Amount to send in BNB/ETH as a string"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'approve_token_spending': {
    parameters: z.object({
      privateKey: z.string().optional().describe("Private key of the token owner account"),
      tokenAddress: z.string().describe("The contract address of the ERC20 token to approve"),
      spenderAddress: z.string().describe("The contract address being approved to spend tokens"),
      amount: z.string().describe("The amount of tokens to approve in token units"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'transfer_nft': {
    parameters: z.object({
      privateKey: z.string().optional().describe("Private key of the NFT owner account"),
      tokenAddress: z.string().describe("The contract address of the NFT collection"),
      tokenId: z.string().describe("The ID of the specific NFT to transfer"),
      toAddress: z.string().describe("The recipient wallet address"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'transfer_erc1155': {
    parameters: z.object({
      privateKey: z.string().optional().describe("Private key of the token owner account"),
      tokenAddress: z.string().describe("The contract address of the ERC1155 token collection"),
      tokenId: z.string().describe("The ID of the specific token to transfer"),
      amount: z.string().describe("The quantity of tokens to send"),
      toAddress: z.string().describe("The recipient wallet address"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'transfer_erc20': {
    parameters: z.object({
      privateKey: z.string().optional().describe("Private key of the sender account"),
      tokenAddress: z.string().describe("The contract address of the ERC20 token"),
      toAddress: z.string().describe("The recipient address or ENS name"),
      amount: z.string().describe("Amount of tokens to send"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  
  // 地址和密钥工具
  'get_address_from_private_key': {
    parameters: z.object({
      privateKey: z.string().describe("Private key in hex format")
    })
  },
  
  // NFT工具
  'get_nft_info': {
    parameters: z.object({
      tokenAddress: z.string().describe("The contract address of the NFT collection"),
      tokenId: z.string().describe("The ID of the specific NFT token to query"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'check_nft_ownership': {
    parameters: z.object({
      tokenAddress: z.string().describe("The contract address of the NFT collection"),
      tokenId: z.string().describe("The ID of the NFT to check"),
      ownerAddress: z.string().describe("The wallet address to check ownership against"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_erc1155_token_uri': {
    parameters: z.object({
      tokenAddress: z.string().describe("The contract address of the ERC1155 token collection"),
      tokenId: z.string().describe("The ID of the specific token to query metadata for"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_nft_balance': {
    parameters: z.object({
      tokenAddress: z.string().describe("The contract address of the NFT collection"),
      ownerAddress: z.string().describe("The wallet address to check the NFT balance for"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  'get_erc1155_balance': {
    parameters: z.object({
      tokenAddress: z.string().describe("The contract address of the ERC1155 token collection"),
      tokenId: z.string().describe("The ID of the specific token to check the balance for"),
      ownerAddress: z.string().describe("The wallet address to check the token balance for"),
      network: z.string().default("bsc").describe("Network name or chain ID. Defaults to BSC mainnet.")
    })
  },
  
  // Greenfield相关工具
  'gnfd_get_account_balance': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      privateKey: z.string().optional().describe("Private key of the account in hex format")
    })
  },
  'gnfd_get_module_accounts': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')")
    })
  },
  'gnfd_get_all_sps': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')")
    })
  },
  'gnfd_create_bucket': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      privateKey: z.string().optional().describe("Private key of the account in hex format"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use")
    })
  },
  'gnfd_create_file': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      privateKey: z.string().optional().describe("Private key of the account in hex format"),
      filePath: z.string().describe("Absolute path to the file to upload"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use")
    })
  },
  'gnfd_create_folder': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      privateKey: z.string().optional().describe("Private key of the account in hex format"),
      folderName: z.string().default("created-by-bnbchain-mcp").describe("Optional folder name"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use")
    })
  },
  'gnfd_list_buckets': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      address: z.string().optional().describe("The address of the account to list buckets for"),
      privateKey: z.string().optional().describe("Private key of the account in hex format")
    })
  },
  'gnfd_list_objects': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use")
    })
  },
  'gnfd_delete_object': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      privateKey: z.string().optional().describe("Private key of the account in hex format"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use"),
      objectName: z.string().describe("The name of the object to delete")
    })
  },
  'gnfd_delete_bucket': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      privateKey: z.string().optional().describe("Private key of the account in hex format"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use")
    })
  },
  'gnfd_get_bucket_info': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use")
    })
  },
  'gnfd_get_object_info': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use"),
      objectName: z.string().describe("The name of the object to get info for")
    })
  },
  'gnfd_download_object': {
    parameters: z.object({
      network: z.string().default("testnet").describe("Network name (e.g. 'testnet', 'mainnet')"),
      bucketName: z.string().default("created-by-bnbchain-mcp").describe("The bucket name to use"),
      objectName: z.string().describe("The name of the object to download"),
      targetPath: z.string().optional().describe("The path to save the downloaded object"),
      privateKey: z.string().optional().describe("Private key of the account in hex format")
    })
  }
};

// 简化的BSCToolkit状态
type BSCToolkitState = {
  privateKey: Hex;
  walletAddress: Address;
  mcpClient: any;
  mcpTools: Record<string, any>; // 添加缓存MCP工具的字段
  isToolsLoaded: boolean; // 标记工具是否已加载
};

// 用户BSCToolkit状态映射
const userBSCToolkitMap = new Map<string, BSCToolkitState>();

// 添加一个全局变量来跟踪是否已保存过工具定义文件
let hasToolDefinitionSaved = false;

// 初始化BSCToolkit
export async function initializeBSCToolkit() {
  try {
    // 获取当前用户信息
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    // 检查此用户是否已经初始化了BSCToolkit
    if (userBSCToolkitMap.has(userId)) {
      console.log(`✅ User ${userId}'s BSCToolkit is already initialized, reusing`);
      return userBSCToolkitMap.get(userId)!;
    }

    console.log(`🚀 Initializing BSCToolkit for user ${userId}...`);
    
    let privateKey: Hex | null = null;
    let walletAddress: Address | null = null;

    // 如果用户已登录，尝试从数据库获取BSC钱包信息
    if (userId !== 'anonymous') {
      console.log(`👤 User is logged in, ID: ${userId}`);
      const userWallet = await getWalletByUserId(userId, 'bsc');
      
      if (userWallet) {
        console.log(`🎉 Found user's BSC wallet, address: ${userWallet.walletAddress}`);
        privateKey = userWallet.privateKey as Hex;
        walletAddress = userWallet.walletAddress as Address;
      } else {
        console.log(`⚠️ User doesn't have a BSC wallet, will create a new one`);
      }
    } else {
      console.log(`⚠️ User not logged in, will use temporary wallet`);
      // 临时文件路径
      const walletDataFile = `/tmp/bsc_wallet_data.txt`;
      
      if (fs.existsSync(walletDataFile)) {
        try {
          const tempWalletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8"));
          privateKey = tempWalletData.privateKey as Hex;
          walletAddress = tempWalletData.walletAddress as Address;
          console.log(`🎉 Successfully read temporary BSC wallet, address: ${walletAddress}`);
        } catch (error) {
          console.error(`❌ Failed to read temporary BSC wallet data:`, error);
        }
      }
    }

    // 如果没有找到私钥，生成一个新的
    if (!privateKey) {
      privateKey = generatePrivateKey() as Hex;
      console.log(`🆕 Generated new BSC private key for user ${userId}`);
    }
 
    // 从私钥创建账户
    const account = privateKeyToAccount(privateKey);
    walletAddress = account.address;

    // 使用更简单的方式初始化MCP客户端
    console.log(`🔄 Initializing BNBChain MCP client...`);
    
    // 构建MCP模块路径 - 直接使用node_modules中的文件
    const mcpModulePath = path.resolve(process.cwd(), 'node_modules/@bnb-chain/mcp/dist/index.js');
    
    // 创建传输层
    const stdioTransport = new StdioClientTransport({
      command: '/opt/homebrew/bin/node', // 直接使用node运行
      args: [mcpModulePath], // 指向实际文件路径
      env: {
        PRIVATE_KEY: privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
      }
    });

    // 创建MCP客户端 - 使用预定义的模式
    const mcpClient = await experimental_createMCPClient({
      transport: stdioTransport,
    });
    
    console.log(`✅ BNBChain MCP client initialized`);
    
    // 保存状态 - 初始化时不立即加载工具，而是在首次请求时加载
    const bscToolkitState: BSCToolkitState = {
      privateKey,
      walletAddress,
      mcpClient,
      mcpTools: {}, // 初始空工具集
      isToolsLoaded: false // 标记工具尚未加载
    };
    
    // 保存到用户映射
    userBSCToolkitMap.set(userId, bscToolkitState);
    
    // 如果用户已登录，保存钱包信息到数据库
    if (userId !== 'anonymous') {
      await saveWallet({
        userId,
        privateKey,
        walletAddress,
        networkId: 'bsc'
      });
      console.log(`💾 Successfully saved user's BSC wallet to database`);
    } else {
      // 否则保存到临时文件
      const walletDataFile = `/tmp/bsc_wallet_data.txt`;
      fs.writeFileSync(
        walletDataFile,
        JSON.stringify({
          privateKey,
          walletAddress,
        })
      );
      console.log(`💾 Successfully saved temporary BSC wallet data: ${walletDataFile}`);
    }

    console.log(`💡 User ${userId}'s BSC wallet address: ${walletAddress}`);
    console.log(`🌐 Network: BNB Smart Chain`);
    
    return bscToolkitState;
  } catch (error) {
    console.error("❌ BSCToolkit initialization failed:", error);
    throw error;
  }
}

// 获取BSC钱包地址
export const getBSCWalletAddress = tool({
  description: 'Get BSC wallet address',
  parameters: z.object({}),
  execute: async () => {
    try {
      console.log("📱 getBSCWalletAddress 工具被调用");
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    let state: BSCToolkitState;
    
    if (userBSCToolkitMap.has(userId)) {
      state = userBSCToolkitMap.get(userId)!;
    } else {
      state = await initializeBSCToolkit();
    }
    
      if (!state || !state.walletAddress) {
        throw new Error("无法获取钱包地址");
      }
      
      console.log(`📱 返回钱包地址: ${state.walletAddress}`);
      
      // 确保返回的是一个简单的对象
      return {
        walletAddress: state.walletAddress,
        network: 'bsc',
      };
    } catch (error) {
      console.error("❌ 获取BSC钱包地址失败:", error);
      // 即使出错也返回一个有效的结果，避免streamText流程中断
      return {
        error: error instanceof Error ? error.message : String(error),
        walletAddress: "0x0000000000000000000000000000000000000000",
        network: 'bsc',
      };
    }
  },
});

// 导出BSC工具包
export async function getBSCToolkit() {
  try {
    // 确保BSCToolkit已初始化
    const session = await auth();
    const userId = session?.user?.id || 'anonymous';
    
    let state: BSCToolkitState;
    
    if (userBSCToolkitMap.has(userId)) {
      state = userBSCToolkitMap.get(userId)!;
      
      // 如果工具已经加载了，直接返回缓存的工具
      if (state.isToolsLoaded && Object.keys(state.mcpTools).length > 0) {
        console.log(`✅ [${userId}] 使用缓存的MCP工具，共${Object.keys(state.mcpTools).length}个工具`);
        return {
          getBSCWalletAddress,
          ...state.mcpTools
        };
      }
      console.log(`🔄 [${userId}] BSC客户端已初始化，但工具尚未加载，开始加载工具...`);
    } else {
      // 如果没有状态，初始化
      console.log(`🔄 [${userId}] BSC客户端未初始化，开始初始化...`);
      state = await initializeBSCToolkit();
    }
    
    // 如果工具尚未加载，加载MCP工具
    console.log(`🔄 [${userId}] 加载MCP工具，使用预定义的参数模式...`);
    try {
      // 只在首次加载时保存工具定义文件
      if (!hasToolDefinitionSaved) {
        console.log(`📝 首次加载，获取并保存工具定义...`);
        // 先试图获取原始工具信息，以查看所有工具定义
        const rawTools = await state.mcpClient.tools({ raw: true });
        
        // 将原始工具定义保存到文件
        const toolsJsonPath = path.resolve(process.cwd(), 'mcp-tools-definition.json');
        fs.writeFileSync(
          toolsJsonPath,
          JSON.stringify(rawTools, null, 2),
          'utf8'
        );
        console.log(`📝 MCP工具原始定义已保存到: ${toolsJsonPath}`);
        
        // 标记已保存工具定义
        hasToolDefinitionSaved = true;
      }
      
      // 使用预定义的参数模式获取MCP工具
      console.log(`🔄 [${userId}] 获取MCP工具...`);
      const startTime = Date.now();
      state.mcpTools = await state.mcpClient.tools({
        schemas: MCP_TOOL_SCHEMAS
      });
      const endTime = Date.now();
      
      console.log(`✅ [${userId}] 获取到${Object.keys(state.mcpTools).length}个MCP工具，耗时${endTime - startTime}ms`);
      
      // 标记工具已加载
      state.isToolsLoaded = true;
      userBSCToolkitMap.set(userId, state);
      
      // 打印工具列表，帮助调试
      console.log(`📋 [${userId}] 可用MCP工具列表:`, Object.keys(state.mcpTools).join(", "));
    } catch (error) {
      console.error(`❌ [${userId}] 获取MCP工具失败:`, error);
      state.mcpTools = {}; // 失败时使用空对象
    }
    
    // 构建工具集合 - 包括钱包地址工具和所有MCP工具
    return {
      getBSCWalletAddress,
      ...state.mcpTools
    };
  } catch (error) {
    console.error("❌ Failed to get BSC toolkit:", error);
    
    // 出错时至少返回钱包工具
    return {
      getBSCWalletAddress,
    };
  }
}

// 在组件卸载或服务器关闭时清理MCP客户端
export async function cleanupBSCToolkit(userId?: string) {
  try {
    if (userId && userBSCToolkitMap.has(userId)) {
      const state = userBSCToolkitMap.get(userId)!;
      if (state.mcpClient && typeof state.mcpClient.close === 'function') {
        await state.mcpClient.close();
      }
      userBSCToolkitMap.delete(userId);
    } else {
      // 清理所有客户端
      for (const [userId, state] of userBSCToolkitMap.entries()) {
        if (state.mcpClient && typeof state.mcpClient.close === 'function') {
          await state.mcpClient.close();
        }
      }
      userBSCToolkitMap.clear();
    }
    console.log("🧹 成功清理MCP客户端资源");
  } catch (error) {
    console.error("清理MCP客户端时出错:", error);
  }
} 