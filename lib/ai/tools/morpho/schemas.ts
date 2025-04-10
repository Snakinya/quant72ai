import { z } from 'zod';

export const GetMorphoVaultsSchema = z
  .object({
    assetSymbol: z
      .string()
      .optional()
      .describe('要筛选的资产符号，例如WETH, USDbC, cbETH等')
  })
  .describe('获取Morpho协议上可用的金库列表'); 