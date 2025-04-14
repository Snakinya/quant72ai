import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface TokenData {
  baseTokenInfo: {
    symbol: string;
    name: string;
    decimals: number;
    logoUri: string;
    totalSupply: string;
    social?: {
      twitter?: string;
      telegram?: string;
      website?: string;
    };
  };
  priceUsd: string;
  marketCap: string;
  liquidUsd: string;
  poolReports: Array<{
    interval: string;
    buyVolume: string;
    sellVolume: string;
    priceChangePercent: string;
  }>;
}

interface TokenInfoProps {
  data: TokenData;
}

export function TokenInfo({ data }: TokenInfoProps) {
  const formatNumber = (num: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(Number(num));
  };

  const formatPercent = (num: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'always'
    }).format(Number(num) / 100);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          {data.baseTokenInfo.logoUri && (
            <img 
              src={data.baseTokenInfo.logoUri} 
              alt={data.baseTokenInfo.name}
              className="w-8 h-8 rounded-full"
            />
          )}
          <div>
            <CardTitle>{data.baseTokenInfo.name}</CardTitle>
            <CardDescription>{data.baseTokenInfo.symbol}</CardDescription>
          </div>
        </div>
        <Badge variant={Number(data.poolReports[0]?.priceChangePercent) > 0 ? "success" : "destructive"}>
          {formatPercent(data.poolReports[0]?.priceChangePercent || "0")} (24h)
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Current Price</p>
            <p className="text-2xl font-bold">{formatNumber(data.priceUsd)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Market Cap</p>
            <p className="text-2xl font-bold">{formatNumber(data.marketCap)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Liquidity</p>
            <p className="text-2xl font-bold">{formatNumber(data.liquidUsd)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">24h Volume</p>
            <p className="text-2xl font-bold">
              {formatNumber(
                (Number(data.poolReports[0]?.buyVolume || 0) + 
                Number(data.poolReports[0]?.sellVolume || 0)).toString()
              )}
            </p>
          </div>
        </div>
        
        {data.baseTokenInfo.social && (
          <div className="mt-4 flex gap-2">
            {data.baseTokenInfo.social.website && (
              <a 
                href={data.baseTokenInfo.social.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                网站
              </a>
            )}
            {data.baseTokenInfo.social.telegram && (
              <a 
                href={data.baseTokenInfo.social.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                Telegram
              </a>
            )}
            {data.baseTokenInfo.social.twitter && (
              <a 
                href={data.baseTokenInfo.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                Twitter
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 