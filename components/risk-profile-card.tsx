import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RiskProfileCardProps {
  tokenData: {
    symbol: string;
    price: number;
    priceChange24h: number;
    rsi: number;
    volatility?: number;
    liquidity?: number;
    marketTrend?: string;
  };
}

export const RiskProfileCard = ({ tokenData }: RiskProfileCardProps) => {
  // 如果没有提供波动率，基于RSI估算一个
  const volatility = tokenData.volatility ?? (tokenData.rsi > 70 || tokenData.rsi < 30 ? 0.8 : 0.4);
  
  // 基于流动性或使用默认值
  const liquidity = tokenData.liquidity ?? 0.5;
  
  // 基于价格变化判断趋势，如果没有提供
  const marketTrend = tokenData.marketTrend ?? (tokenData.priceChange24h < -5 ? 'bearish' : 
                                               tokenData.priceChange24h > 5 ? 'bullish' : 'neutral');
  
  // 计算总体风险分数 (0-100)
  const riskScore = 
    volatility * 40 + 
    (1 - liquidity) * 30 + 
    (marketTrend === 'bearish' ? 30 : 0);
  
  // 风险分类
  const riskCategory = 
    riskScore < 30 ? 'Low' : 
    riskScore < 60 ? 'Medium' : 'High';
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">{tokenData.symbol} Risk Assessment</CardTitle>
            <CardDescription>AI-powered risk profiling</CardDescription>
          </div>
          <Badge variant={
            riskCategory === 'Low' ? 'outline' : 
            riskCategory === 'Medium' ? 'secondary' : 'destructive'
          }>
            {riskCategory} Risk
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* 风险评分横条 */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-sm">Low Risk</span>
            <span className="text-sm">High Risk</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div 
              className={`h-2 rounded-full ${
                riskCategory === 'Low' ? 'bg-green-500' : 
                riskCategory === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${riskScore}%` }}
            ></div>
          </div>
        </div>
        
        {/* 风险指标横排显示 */}
        <div className="flex flex-row justify-between gap-2">
          <div className="flex-1 bg-gray-100 rounded-md p-2 flex flex-col justify-center items-center">
            <div className="text-sm text-gray-600">Volatility</div>
            <div className="text-base font-medium">{(volatility * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-500">
              {volatility < 0.3 ? 'Low' : volatility < 0.6 ? 'Medium' : 'High'}
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 rounded-md p-2 flex flex-col justify-center items-center">
            <div className="text-sm text-gray-600">Liquidity</div>
            <div className="text-base font-medium">
              {liquidity < 0.3 ? 'Low' : liquidity < 0.7 ? 'Medium' : 'High'}
            </div>
            <div className="text-xs text-gray-500">
              {liquidity < 0.3 ? 'Limited' : liquidity < 0.7 ? 'Adequate' : 'Deep'}
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 rounded-md p-2 flex flex-col justify-center items-center">
            <div className="text-sm text-gray-600">Market Trend</div>
            <div className={`text-base font-medium ${
              marketTrend === 'bullish' ? 'text-green-600' : 
              marketTrend === 'bearish' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {marketTrend === 'bullish' ? 'Bullish' : 
               marketTrend === 'bearish' ? 'Bearish' : 'Neutral'}
            </div>
            <div className="text-xs text-gray-500">
              24h: {tokenData.priceChange24h > 0 ? '+' : ''}{tokenData.priceChange24h.toFixed(2)}%
            </div>
          </div>
        </div>
        
        {/* 风险分析简要总结 */}
        <div className="mt-3 p-2 bg-gray-100 rounded-md">
          <p className="text-sm text-gray-600">
            {riskCategory === 'Low' ? 
              `${tokenData.symbol} shows stability with low volatility and adequate liquidity. Suitable for long-term positions.` : 
             riskCategory === 'Medium' ? 
              `${tokenData.symbol} displays moderate volatility and standard liquidity. Consider balanced positioning.` : 
              `${tokenData.symbol} exhibits high volatility and potential liquidity concerns. Only for short-term trading.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 