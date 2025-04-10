import { tool } from 'ai';
import { z } from 'zod';
import { getMorphoVaultsHandler } from './handlers';
import { GetMorphoVaultsSchema } from './schemas';
import { walletProvider } from '../../tools/agentkit';

// 获取Morpho金库列表工具
export const getMorphoVaults = tool({
  description: '获取当前网络上可用的Morpho金库列表，可以按资产类型过滤',
  parameters: GetMorphoVaultsSchema,
  execute: async (args: z.infer<typeof GetMorphoVaultsSchema>) => {
    return await getMorphoVaultsHandler(walletProvider, args);
  },
}); 