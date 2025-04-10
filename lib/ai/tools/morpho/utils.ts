import { morphoApiClient } from './graphql';
import { GET_VAULTS_QUERY } from './queries';
import type { MorphoVaultsResponse, MorphoVault } from './types';

// 将chainId转换为网络名称
function getNetworkNameById(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'base-mainnet';
    case 84532:
      return 'base-sepolia';
    default:
      return `未知网络(${chainId})`;
  }
}

// 获取Morpho金库列表
export async function getMorphoVaults({
  chainId = 8453, // 默认为Base网络
  assetSymbol = '',
}: {
  chainId?: number;
  assetSymbol: string;
}): Promise<MorphoVault[]> {
  try {
    console.log(`查询Morpho金库: chainId=${chainId}, assetSymbol=${assetSymbol || 'ALL'}`);
    
    const data = await morphoApiClient.request<MorphoVaultsResponse>(
      GET_VAULTS_QUERY,
      {
        chainId,
        assetSymbol,
      },
    );
    
    console.log(`成功获取${data.vaults.items.length}个Morpho金库，网络: ${getNetworkNameById(chainId)}`);
    return data.vaults.items;
  } catch (error) {
    console.error('获取Morpho金库失败:', error);
    throw error;
  }
} 