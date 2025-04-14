import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AllocationSuggestionProps {
  riskProfile: 'low' | 'medium' | 'high';
  assetType?: 'defi' | 'token' | 'general';
}

export const AllocationSuggestion = ({ 
  riskProfile = 'medium', 
  assetType = 'general' 
}: AllocationSuggestionProps) => {
  // 基于风险偏好的资产分配建议
  let allocation = {
    stableYield: 0,
    liquidityPool: 0,
    trading: 0
  };
  
  if (riskProfile === 'low') {
    allocation = {
      stableYield: 70,
      liquidityPool: 25,
      trading: 5
    };
  } else if (riskProfile === 'medium') {
    allocation = {
      stableYield: 40,
      liquidityPool: 40,
      trading: 20
    };
  } else { // high
    allocation = {
      stableYield: 20,
      liquidityPool: 30,
      trading: 50
    };
  }
  
  // 根据资产类型调整建议
  let recommendations: string[] = [];
  
  if (assetType === 'defi') {
    recommendations = [
      `将${allocation.stableYield}%资金投入稳定币存款或低风险DeFi产品`,
      `将${allocation.liquidityPool}%资金投入Morpho等流动性提供协议`,
      `保留${allocation.trading}%资金用于相对高风险的DeFi策略`
    ];
  } else if (assetType === 'token') {
    recommendations = [
      `将${allocation.stableYield}%资金投入大型稳定代币(ETH, BTC)`,
      `将${allocation.liquidityPool}%资金投入中等风险的中型代币`,
      `保留${allocation.trading}%资金用于小型代币和新项目`
    ];
  } else {
    recommendations = [
      `将${allocation.stableYield}%资金投入稳定收益产品`,
      `将${allocation.liquidityPool}%资金投入中等风险策略`,
      `保留${allocation.trading}%资金用于高风险高回报策略`
    ];
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">智能资产配置</CardTitle>
        <CardDescription>基于AI风险评估的资产分配建议</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex mb-4 h-8 rounded-lg overflow-hidden">
          <div 
            className="bg-blue-500" 
            style={{ width: `${allocation.stableYield}%` }}
          ></div>
          <div 
            className="bg-purple-500" 
            style={{ width: `${allocation.liquidityPool}%` }}
          ></div>
          <div 
            className="bg-orange-500" 
            style={{ width: `${allocation.trading}%` }}
          ></div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-sm mb-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <div>稳定收益: {allocation.stableYield}%</div>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
            <div>流动性策略: {allocation.liquidityPool}%</div>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            <div>交易策略: {allocation.trading}%</div>
          </div>
        </div>
        
        <div className="bg-gray-100 rounded-md p-3">
          <h4 className="text-sm font-medium mb-2">推荐配置策略</h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
          
          {riskProfile === 'low' && (
            <p className="mt-2 text-sm text-gray-600">
              此配置适合低风险偏好，以资本保全为主要目标。
            </p>
          )}
          
          {riskProfile === 'medium' && (
            <p className="mt-2 text-sm text-gray-600">
              此配置在风险和回报之间取得平衡，适合大多数投资者。
            </p>
          )}
          
          {riskProfile === 'high' && (
            <p className="mt-2 text-sm text-gray-600">
              此配置追求较高回报，同时伴随较大风险，适合风险承受能力强的投资者。
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 