import { IDataFrame, DataFrame, Series } from 'data-forge';
import { IStrategy, IBar, backtest } from 'grademark';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
  timestamp: number;
}

interface ExtendedBar extends IBar {
  rsi: number;
}

interface BacktestOptions<T> {
  entryPrice: (bar: T) => number;
  exitPrice: (bar: T) => number;
  commission: number;
  stopLoss: number;
}

// RSI计算函数
function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;

  // 初始化第一个RSI值
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // 计算第一个RSI
  for (let i = 0; i < period; i++) {
    rsi.push(50); // 初始值设为中性
  }

  // 计算后续的RSI
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    let currentGain = 0;
    let currentLoss = 0;

    if (diff >= 0) {
      currentGain = diff;
    } else {
      currentLoss = -diff;
    }

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }

  return rsi;
}

// RSI策略
const createRSIStrategy = (
  rsiPeriod: number = 14,
  oversoldThreshold: number = 30,
  overboughtThreshold: number = 70
) => {
  let position: 'long' | 'short' | 'none' = 'none';

  return {
    entryRule: (enterPosition: any, args: any) => {
      const rsi = args.bar.rsi;
      if (rsi < oversoldThreshold && position !== 'long') {
        position = 'long';
        enterPosition({ direction: "long" });
      }
    },

    exitRule: (exitPosition: any, args: any) => {
      const rsi = args.bar.rsi;
      if (rsi > overboughtThreshold && position === 'long') {
        position = 'none';
        exitPosition();
      }
    },

    stopLoss: () => {
      return 5; // 5% 止损
    }
  };
};

// 回测函数
export async function runRSIBacktest(
  candleData: CandleData[],
  rsiPeriod: number = 14,
  oversoldThreshold: number = 30,
  overboughtThreshold: number = 70
) {
  try {
    console.log('RSI回测开始，处理K线数据...');
    
    // 首先检查时间顺序，并且排序
    if (candleData.length > 1) {
      // 输出前10条数据的时间戳，用于调试
      console.log('初始K线时间顺序 (前10条):');
      candleData.slice(0, 10).forEach((candle, i) => {
        console.log(`[${i}] timestamp: ${candle.timestamp}, 时间: ${new Date(candle.timestamp * 1000).toISOString()}`);
      });
      
      // 检查是否需要排序（从过去到现在）
      const isDescending = candleData.length > 1 && candleData[0].timestamp > candleData[1].timestamp;
      
      if (isDescending) {
        console.log('检测到K线数据是倒序排列的，正在重新排序...');
        // 按照时间戳升序排序（从过去到现在）
        candleData.sort((a, b) => a.timestamp - b.timestamp);
        
        // 再次输出排序后的前10条数据
        console.log('排序后K线时间顺序 (前10条):');
        candleData.slice(0, 10).forEach((candle, i) => {
          console.log(`[${i}] timestamp: ${candle.timestamp}, 时间: ${new Date(candle.timestamp * 1000).toISOString()}`);
        });
      }
      
      // 输出时间范围
      if (candleData.length > 0) {
        const firstTime = new Date(candleData[0].timestamp * 1000).toISOString();
        const lastTime = new Date(candleData[candleData.length - 1].timestamp * 1000).toISOString();
        console.log(`K线数据时间范围: ${firstTime} 到 ${lastTime}`);
      }
    }
    
    console.log(`K线数据样本: ${JSON.stringify(candleData[0])}`);
    console.log(`K线数量: ${candleData.length}`);
    
    // 转换数据格式
    const dataFrame = new DataFrame({
      values: candleData.map(candle => {
        // 使用timestamp字段作为时间
        const timestamp = candle.timestamp || candle.time;
        const date = new Date(timestamp * 1000); // 转为毫秒
        
        return {
          time: date,
          open: parseFloat(candle.open.toString()),
          high: parseFloat(candle.high.toString()),
          low: parseFloat(candle.low.toString()),
          close: parseFloat(candle.close.toString()),
          volume: parseFloat(candle.volume)
        };
      })
    });
    
    console.log('DataFrame创建完成');

    // 计算RSI值
    const closes = dataFrame.getSeries("close").toArray();
    console.log(`收盘价数组长度: ${closes.length}`);
    
    const rsiValues = calculateRSI(closes, rsiPeriod);
    console.log(`RSI值数组长度: ${rsiValues.length}`);
    
    const rsiSeries = new Series(rsiValues);
    const dataFrameWithRSI = dataFrame.withSeries("rsi", rsiSeries);
    console.log('添加RSI指标完成');

    // 创建策略
    const strategy = createRSIStrategy(rsiPeriod, oversoldThreshold, overboughtThreshold);
    console.log('创建策略完成');

    // 执行回测
    console.log('开始执行回测...');
    const result = await backtest(strategy, dataFrameWithRSI);
    console.log(`回测完成，获得${result.length}笔交易`);
    
    // 计算回测结果
    const trades = result.map(trade => {
      // 计算每笔交易的盈亏百分比
      const profitPct = trade.direction === "long" 
        ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - trade.exitPrice) / trade.entryPrice) * 100;
        
      // 将原始日期对象转为时间戳
      return {
        ...trade,
        entryTime: trade.entryTime.getTime(),
        exitTime: trade.exitTime ? trade.exitTime.getTime() : null,
        profit: profitPct // 使用计算出的百分比替换原始profit
      };
    });
    
    let profitPct = 0;
    if (trades.length > 0) {
      profitPct = trades.reduce((acc, trade) => acc + trade.profit, 0);
    }
    
    let maxDrawdownPct = 0;
    if (trades.length > 0) {
      const profits = trades.map(trade => trade.profit);
      maxDrawdownPct = Math.min(...profits);
    }
    
    let winRate = 0;
    let avgWinPct = 0;
    let avgLossPct = 0;
    
    if (trades.length > 0) {
      const winningTrades = trades.filter(trade => trade.profit > 0);
      const losingTrades = trades.filter(trade => trade.profit <= 0);
      
      winRate = winningTrades.length / trades.length;
      
      if (winningTrades.length > 0) {
        avgWinPct = winningTrades.reduce((acc, trade) => acc + trade.profit, 0) / winningTrades.length;
      }
      
      if (losingTrades.length > 0) {
        avgLossPct = losingTrades.reduce((acc, trade) => acc + trade.profit, 0) / losingTrades.length;
      }
    }
    
    console.log('回测统计计算完成');
    
    return {
      trades,
      profitPct,
      maxDrawdownPct,
      winRate,
      avgWinPct,
      avgLossPct,
    };
  } catch (error) {
    console.error('RSI回测过程中出错:', error);
    throw error;
  }
} 