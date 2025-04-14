import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface BacktestResultProps {
  data: {
    tokenSymbol: string;
    poolAddress: string;
    timeBucket: string;
    dataStatistics: {
      totalCandles: number;
      timeRange?: string;
      startPrice?: number;
      endPrice?: number;
      priceChangePct?: number;
    };
    backtestResults?: {
      totalTrades: number;
      profitPct: number;
      maxDrawdownPct: number;
      winRate: number;
      avgWinPct: number;
      avgLossPct: number;
      sampleTrades?: Array<{
        type: string;
        entryTime: string;
        entryPrice: number;
        exitTime?: string | null;
        exitPrice?: number;
        profit?: number;
      }> | null;
      conclusion: string;
    } | null;
    backtestError?: {
      message: string;
      fallback: string;
    };
    estimatedResults?: {
      totalTrades: number;
      estimatedProfitPct: number;
      note: string;
    };
  };
}

export function BacktestResult({ data }: BacktestResultProps) {
  const hasResults = !!data.backtestResults;
  const hasError = !!data.backtestError;
  const hasEstimates = !!data.estimatedResults;
  const results = data.backtestResults;

  const profitColor = hasResults && results?.profitPct !== undefined && results.profitPct >= 0 ? 'text-green-600' : 'text-red-600';
  const statusVariant = hasResults
    ? results?.profitPct !== undefined && results.profitPct >= 0 ? 'success' : 'destructive'
    : hasError ? 'destructive' : 'secondary';
  const statusText = hasResults
    ? results?.profitPct !== undefined && results.profitPct >= 0 ? 'Strategy Profitable' : 'Strategy Loss'
    : hasError ? 'Backtest Failed' : 'Insufficient Data';

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const formatPrice = (value: number) => {
    if (value === undefined || value === null) return 'N/A';
    if (Math.abs(value) < 0.00001) {
      return value.toExponential(6);
    } else if (Math.abs(value) < 0.001) {
      return value.toFixed(8);
    } else if (Math.abs(value) < 0.1) {
      return value.toFixed(6);
    } else if (Math.abs(value) < 10) {
      return value.toFixed(4);
    } else {
      return value.toFixed(2);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const tradeFrequency = hasResults && data.dataStatistics.timeRange && results?.totalTrades !== undefined
    ? (results.totalTrades / data.dataStatistics.totalCandles * 100).toFixed(2) + '%'
    : 'N/A';

  const profitFactor = hasResults && results?.avgLossPct !== undefined && results.avgLossPct !== 0
    ? Math.abs(results.avgWinPct / results.avgLossPct).toFixed(2)
    : 'N/A';

  const expectedValue = hasResults && results?.winRate !== undefined
    ? (
        (results.winRate / 100) * results.avgWinPct -
        ((100 - results.winRate) / 100) * results.avgLossPct
      ).toFixed(2)
    : 'N/A';
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">{data.tokenSymbol} RSI Strategy Backtest</CardTitle>
              <CardDescription>Timeframe: {data.timeBucket}</CardDescription>
            </div>
            <Badge variant={statusVariant}>
              {statusText}
            </Badge>
          </div>
        </CardHeader>
  
        <CardContent className="space-y-4">
          {/* Market data statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-gray-100 rounded-md p-2">
              <div className="text-sm text-gray-600">Candles</div>
              <div className="text-lg font-semibold">{data.dataStatistics.totalCandles}</div>
            </div>
            {data.dataStatistics.priceChangePct !== undefined && (
              <div className="bg-gray-100 rounded-md p-2">
                <div className="text-sm text-gray-600">Market Change</div>
                <div className={`text-lg font-semibold ${data.dataStatistics.priceChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(data.dataStatistics.priceChangePct)}
                </div>
              </div>
            )}
            {data.dataStatistics.startPrice !== undefined && (
              <div className="bg-gray-100 rounded-md p-2">
                <div className="text-sm text-gray-600">Start Price</div>
                <div className="text-lg font-semibold">{formatPrice(data.dataStatistics.startPrice)}</div>
              </div>
            )}
            {data.dataStatistics.endPrice !== undefined && (
              <div className="bg-gray-100 rounded-md p-2">
                <div className="text-sm text-gray-600">End Price</div>
                <div className="text-lg font-semibold">{formatPrice(data.dataStatistics.endPrice)}</div>
              </div>
            )}
          </div>
  
          {/* Backtest results area */}
          {hasResults && results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Strategy Return</div>
                  <div className={`text-xl font-semibold ${profitColor}`}>
                    {formatPercent(results.profitPct)}
                  </div>
                </div>
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Max Drawdown</div>
                  <div className="text-xl font-semibold text-red-500">
                    {results.maxDrawdownPct.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Total Trades</div>
                  <div className="text-xl font-semibold">
                    {results.totalTrades}
                  </div>
                </div>
              </div>
  
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Win Rate</div>
                  <div className="text-lg font-semibold">
                    {results.winRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Avg Win</div>
                  <div className="text-lg font-semibold text-green-500">
                    +{results.avgWinPct.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Avg Loss</div>
                  <div className="text-lg font-semibold text-red-500">
                    -{results.avgLossPct.toFixed(2)}%
                  </div>
                </div>
              </div>
  
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Profit Factor</div>
                  <div className="text-lg font-semibold">
                    {profitFactor}
                  </div>
                  <div className="text-xs text-gray-500">Win size / Loss size</div>
                </div>
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Expected Value</div>
                  <div className={`text-lg font-semibold ${parseFloat(expectedValue) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {expectedValue}%
                  </div>
                  <div className="text-xs text-gray-500">Per trade expectancy</div>
                </div>
                <div className="bg-gray-100 rounded-md p-2">
                  <div className="text-sm text-gray-600">Trade Frequency</div>
                  <div className="text-lg font-semibold">
                    {tradeFrequency}
                  </div>
                  <div className="text-xs text-gray-500">Trades per candle</div>
                </div>
              </div>
  
              {/* Sample trades */}
              {results.sampleTrades && results.sampleTrades.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Sample Trades</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-left">Entry Time</th>
                          <th className="p-2 text-right">Entry Price</th>
                          <th className="p-2 text-left">Exit Time</th>
                          <th className="p-2 text-right">Exit Price</th>
                          <th className="p-2 text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.sampleTrades.map((trade, i) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="p-2">{trade.type === 'first' ? 'First Trade' : 'Last Trade'}</td>
                            <td className="p-2">{formatDate(trade.entryTime)}</td>
                            <td className="p-2 text-right">{formatPrice(trade.entryPrice)}</td>
                            <td className="p-2">{trade.exitTime ? formatDate(trade.exitTime) : 'In Position'}</td>
                            <td className="p-2 text-right">{trade.exitPrice !== undefined ? formatPrice(trade.exitPrice) : '-'}</td>
                            <td className={`p-2 text-right ${trade.profit !== undefined && trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {trade.profit !== undefined ? formatPercent(trade.profit) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
  
              {/* Strategy performance assessment */}
              <div className="bg-gray-100 rounded-md p-3">
                <h4 className="text-sm font-medium mb-1 text-gray-700">Performance Analysis</h4>
                <p className="text-sm text-gray-600">{results.conclusion}</p>
  
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <h4 className="text-sm font-medium mb-1 text-gray-700">Optimization Suggestions</h4>
                  <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {results.winRate < 40 && (
                      <li>Consider adjusting the RSI overbought/oversold thresholds to improve entry timing</li>
                    )}
                    {results.maxDrawdownPct > 15 && (
                      <li>Implement tighter stop-loss rules to reduce maximum drawdown</li>
                    )}
                    {results.profitPct < 0 && (
                      <li>Test different timeframes or add additional confirmation indicators</li>
                    )}
                    {results.totalTrades < 20 && (
                      <li>Increase the test period or adjust parameters to generate more trade signals</li>
                    )}
                    <li>Consider testing the strategy with different RSI periods (9, 14, 21)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
  
          {/* Backtest error situation */}
          {hasError && (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-md p-3 border border-red-200">
                <h4 className="text-sm font-medium mb-1 text-red-700">Backtest Error</h4>
                <p className="text-sm text-red-600">{data.backtestError?.message}</p>
                <p className="text-sm text-gray-600 mt-2">{data.backtestError?.fallback}</p>
              </div>
  
              {hasEstimates && data.estimatedResults && (
                <div className="bg-gray-100 rounded-md p-3 space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Estimated Results</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-sm text-gray-600">Est. Trades:</span>
                      <span className="text-sm font-medium ml-2">{data.estimatedResults.totalTrades}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Est. Return:</span>
                      <span className={`text-sm font-medium ml-2 ${data.estimatedResults.estimatedProfitPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPercent(data.estimatedResults.estimatedProfitPct)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 italic">{data.estimatedResults.note}</p>
                </div>
              )}
            </div>
          )}
  
          {data.dataStatistics.timeRange && (
            <div className="text-xs text-gray-500 mt-2">
              Data period: {data.dataStatistics.timeRange}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  