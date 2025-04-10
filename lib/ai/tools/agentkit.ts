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
let currentNetworkId: string = '';

// Initialize AgentKit and get tools
export async function initializeAgentKit() {
  try {
    // If already initialized, return existing tools
    if (agentKit) {
      console.log("Using existing AgentKit instance");
      return getVercelAITools(agentKit);
    }

    console.log("Initializing AgentKit...");
    const networkId = process.env.NETWORK_ID || "base-sepolia";
    currentNetworkId = networkId;
    const walletDataFile = `wallet_data_${networkId.replace(/-/g, "_")}.txt`;

    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;

    // Read existing wallet data
    if (fs.existsSync(walletDataFile)) {
      try {
        walletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8")) as WalletData;
        privateKey = walletData.privateKey;
      } catch (error) {
        console.error(`Error reading ${networkId} wallet data:`, error);
      }
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
      } else {
        privateKey = generatePrivateKey();
      }
    }

    const signer = privateKeyToAccount(privateKey);

    // Configure smart wallet provider
    walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: walletData?.smartWalletAddress,
      paymasterUrl: undefined, // Transaction sponsorship: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    });

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

    // Save wallet data
    smartWalletAddress = await walletProvider.getAddress() as Address;
    fs.writeFileSync(
      walletDataFile,
      JSON.stringify({
        privateKey,
        smartWalletAddress,
      } as WalletData)
    );

    console.log(`Smart wallet address: ${smartWalletAddress}`);
    console.log(`Network: ${networkId}`);
    console.log(`Enabled action providers: cdpApi, erc721, pyth, wallet, morpho`);
    
    // Get Vercel AI SDK tools
    const tools = getVercelAITools(agentKit);
    return tools;
  } catch (error) {
    console.error("Failed to initialize AgentKit:", error);
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