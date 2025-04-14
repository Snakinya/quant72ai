import { tool } from 'ai';
import { z } from 'zod';
import { runRSIBacktest } from '@/lib/backtest/rsi-strategy';

export const backtestRSIStrategy = tool({
  description: 'Get backtest results for an RSI trading strategy using historical price data',
  parameters: z.object({
    poolAddress: z.string().describe('Pool address of the token'),
    timeBucket: z.string().default('15s').describe('K-line time period, such as 15s, 1m, 5m, 15m, 1h'),
    limit: z.number().default(10000).describe('Number of K-line candles to fetch'),
    rsiPeriod: z.number().default(14).describe('RSI calculation period'),
    oversoldThreshold: z.number().default(30).describe('RSI oversold threshold'),
    overboughtThreshold: z.number().default(70).describe('RSI overbought threshold'),
  }),
  execute: async ({ poolAddress, timeBucket, limit, rsiPeriod, oversoldThreshold, overboughtThreshold }) => {
    console.log("[BACKTEST] Starting with params:", { poolAddress, timeBucket, limit });
    
    try {
      // Get current timestamp (seconds)
      const requestEndTime = Math.floor(Date.now() / 1000);
      
      // Fetch K-line data
      console.log("[BACKTEST] Fetching K-line data...");
      const response = await fetch(
        `https://api.mevx.io/api/v1/candlesticks?chain=base&poolAddress=${poolAddress}&timeBucket=${timeBucket}&endTime=${requestEndTime}&outlier=true&limit=${limit}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch K-line data: ${response.status} ${response.statusText}`);
      }

      const klineData = await response.json();
      const candles = klineData.candlesticks || [];
      console.log(`[BACKTEST] Received ${candles.length} candles`);
      
      if (candles.length === 0) {
        return {
          tokenSymbol: "Unknown",
          poolAddress,
          timeBucket,
          dataStatistics: {
            totalCandles: 0,
            message: "No candlestick data available"
          },
          backtestResults: null
        };
      }
      
      // Fix missing timestamp fields if needed
      for (let i = 0; i < candles.length; i++) {
        if (!candles[i].timestamp && candles[i].time) {
          candles[i].timestamp = candles[i].time;
        }
      }
      
      // Get token info (optional)
      let tokenSymbol = 'Unknown';
      try {
        const tokenInfoResponse = await fetch(
          `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
        );
        
        if (tokenInfoResponse.ok) {
          const tokenData = await tokenInfoResponse.json();
          if (tokenData.pools && tokenData.pools.length > 0 && tokenData.pools[0].baseTokenInfo) {
            tokenSymbol = tokenData.pools[0].baseTokenInfo.symbol || 'Unknown';
          }
        }
      } catch (error) {
        console.error('[BACKTEST] Error getting token symbol:', error);
      }
      
      // Calculate basic statistics
      const startPrice = parseFloat(candles[0].close);
      const endPrice = parseFloat(candles[candles.length - 1].close);
      const startTimeStr = new Date(candles[0].timestamp * 1000).toISOString();
      const endTimeStr = new Date(candles[candles.length - 1].timestamp * 1000).toISOString();
      const priceChangePct = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
      
      // Run actual RSI backtest
      console.log("[BACKTEST] Running RSI backtest strategy...");
      try {
        const backtestResult = await runRSIBacktest(
          candles,
          rsiPeriod,
          oversoldThreshold,
          overboughtThreshold
        );
        
        console.log(`[BACKTEST] Backtest completed with ${backtestResult.trades.length} trades`);

        // Process and return simplified trade data
        const sampleTrades = [];
        if (backtestResult.trades.length > 0) {
          // Add first trade
          const firstTrade = backtestResult.trades[0];
          sampleTrades.push({
            type: "first",
            entryTime: new Date(firstTrade.entryTime).toISOString(),
            entryPrice: firstTrade.entryPrice,
            exitTime: firstTrade.exitTime ? new Date(firstTrade.exitTime).toISOString() : null,
            exitPrice: firstTrade.exitPrice,
            profit: parseFloat(firstTrade.profit.toFixed(2))
          });
          
          // Add last trade if different from first
          if (backtestResult.trades.length > 1) {
            const lastTrade = backtestResult.trades[backtestResult.trades.length - 1];
            sampleTrades.push({
              type: "last",
              entryTime: new Date(lastTrade.entryTime).toISOString(),
              entryPrice: lastTrade.entryPrice,
              exitTime: lastTrade.exitTime ? new Date(lastTrade.exitTime).toISOString() : null,
              exitPrice: lastTrade.exitPrice,
              profit: parseFloat(lastTrade.profit.toFixed(2))
            });
          }
        }
        
        // Generate conclusion
        let conclusion = "";
        if (backtestResult.trades.length < 5) {
          conclusion = "Insufficient trades to draw reliable conclusions. Consider increasing the backtest time range.";
        } else if (backtestResult.profitPct > 5) {
          conclusion = "Strategy shows positive performance with good returns.";
        } else if (backtestResult.profitPct > 0) {
          conclusion = "Strategy shows modest profit, but returns are limited.";
        } else {
          conclusion = "Strategy lost money during the test period and needs improvement.";
        }
        
        // Add win rate assessment
        if (backtestResult.trades.length >= 5) {
          if (backtestResult.winRate > 0.6) {
            conclusion += " Win rate is good.";
          } else if (backtestResult.winRate > 0.4) {
            conclusion += " Win rate is average.";
          } else {
            conclusion += " Win rate is poor, consider re-evaluating entry signals.";
          }
        }
        
        // Final result with all components
        const result = {
          tokenSymbol,
          poolAddress,
          timeBucket,
          dataStatistics: {
            totalCandles: candles.length,
            timeRange: `${startTimeStr} to ${endTimeStr}`,
            startPrice,
            endPrice,
            priceChangePct: parseFloat(priceChangePct.toFixed(2))
          },
          backtestResults: {
            totalTrades: backtestResult.trades.length,
            profitPct: parseFloat(backtestResult.profitPct.toFixed(2)),
            maxDrawdownPct: parseFloat(Math.abs(backtestResult.maxDrawdownPct).toFixed(2)),
            winRate: parseFloat((backtestResult.winRate * 100).toFixed(2)),
            avgWinPct: parseFloat(backtestResult.avgWinPct.toFixed(2)),
            avgLossPct: parseFloat(Math.abs(backtestResult.avgLossPct).toFixed(2)),
            sampleTrades: sampleTrades.length > 0 ? sampleTrades : null,
            conclusion
          }
        };
        
        console.log("[BACKTEST] Successfully returning result");
        return result;
      } catch (backtestError) {
        console.error("[BACKTEST] Error during backtest execution:", backtestError);
        
        // Return basic data with error info
        return {
          tokenSymbol,
          poolAddress,
          timeBucket,
          dataStatistics: {
            totalCandles: candles.length,
            timeRange: `${startTimeStr} to ${endTimeStr}`,
            startPrice,
            endPrice,
            priceChangePct: parseFloat(priceChangePct.toFixed(2))
          },
          backtestError: {
            message: backtestError instanceof Error ? backtestError.message : "Unknown backtest error",
            fallback: "Failed to execute RSI strategy backtest, but market data is available"
          },
          // Fallback to simplified estimation
          estimatedResults: {
            totalTrades: Math.floor(candles.length / 50),
            estimatedProfitPct: parseFloat((priceChangePct * 0.7).toFixed(2)),
            note: "These are estimated values since the backtest failed to execute"
          }
        };
      }
    } catch (error) {
      console.error("[BACKTEST] Critical error:", error);
      // Return minimal error response
      return {
        error: true,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        poolAddress,
        timeBucket
      };
    }
  },
}); 