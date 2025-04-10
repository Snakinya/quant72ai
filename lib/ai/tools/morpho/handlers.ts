import type { z } from 'zod';
import { GetMorphoVaultsSchema } from './schemas';
import { getMorphoVaults } from './utils';
import { SmartWalletProvider } from '@coinbase/agentkit';
import { currentNetworkId } from '../../tools/agentkit';

// 将chainId转换为数字
function getChainIdFromNetworkId(networkId: string): number {
  switch (networkId) {
    case 'base-mainnet':
      return 8453;
    case 'base-sepolia':
      return 84532;
    default:
      return 8453; // 默认为Base网络
  }
}

// 获取Morpho金库列表处理函数
export async function getMorphoVaultsHandler(
  wallet: SmartWalletProvider | null,
  args: z.infer<typeof GetMorphoVaultsSchema>
): Promise<string> {
  try {
    // 获取chainId
    let chainId = 8453; // 默认为Base主网
    
    // 使用全局变量currentNetworkId而不是从wallet对象获取
    const networkId = currentNetworkId || 'base-mainnet';
    chainId = getChainIdFromNetworkId(networkId);
    
    // 获取Morpho金库
    const vaults = await getMorphoVaults({
      chainId,
      assetSymbol: args.assetSymbol || '',
    });

    // 添加额外的易用信息
    const enhancedVaults = vaults.map(vault => ({
      ...vault,
      apy: vault.riskAnalysis[0]?.score ? `约${(vault.riskAnalysis[0].score * 10).toFixed(2)}%` : '未知',
      tvlUsd: `$${(vault.liquidity.usd / 1000000).toFixed(2)}M`,
    }));
    
    // 构建用户友好的响应
    const result = {
      network: chainId === 8453 ? 'base-mainnet' : 'base-sepolia',
      vaultsCount: vaults.length,
      vaults: enhancedVaults,
      message: `在${chainId === 8453 ? 'Base网络' : 'Base Sepolia测试网'}上找到${vaults.length}个Morpho金库${args.assetSymbol ? `（过滤：${args.assetSymbol}）` : ''}`
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    const errorMessage = `获取Morpho金库失败: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return JSON.stringify({ error: errorMessage });
  }
} 