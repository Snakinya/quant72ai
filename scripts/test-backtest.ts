import { runRSIBacktest } from "../lib/backtest/rsi-strategy";

// 解析命令行参数
function parseCommandLineArgs() {
  const args: Record<string, any> = {
    poolAddress: "0x385B47e56b73eb6549378f78F7c7Cbc42C56C9e0",
    timeBucket: "15s",
    limit: 300,
    rsiPeriod: 14,
    oversoldThreshold: 30,
    overboughtThreshold: 70
  };
  
  // 解析命令行参数
  process.argv.slice(2).forEach(arg => {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');
      if (key === 'limit' || key === 'rsiPeriod' || key === 'oversoldThreshold' || key === 'overboughtThreshold') {
        args[key] = parseInt(value, 10);
      } else {
        args[key] = value;
      }
    }
  });
  
  return args;
}

// 测试直接调用K线API和回测函数
async function testBacktest() {
  try {
    console.log("开始回测测试...");

    // 从命令行获取参数
    const args = parseCommandLineArgs();
    const { poolAddress, timeBucket, limit, rsiPeriod, oversoldThreshold, overboughtThreshold } = args;

    console.log(`使用参数: poolAddress=${poolAddress}, timeBucket=${timeBucket}, limit=${limit}`);

    // 获取当前时间戳（秒）
    const endTime = Math.floor(Date.now() / 1000);
    
    // 获取K线数据
    console.log("正在获取K线数据...");
    const response = await fetch(
      `https://api.mevx.io/api/v1/candlesticks?chain=base&poolAddress=${poolAddress}&timeBucket=${timeBucket}&endTime=${endTime}&outlier=true&limit=${limit}`,
    );

    if (!response.ok) {
      throw new Error(`获取K线数据失败: ${response.statusText}`);
    }

    const klineData = await response.json();
    console.log(`获取到${klineData.candlesticks?.length || 0}条K线数据`);
    
    if (!klineData.candlesticks || klineData.candlesticks.length === 0) {
      throw new Error('没有获取到K线数据');
    }

    // 打印前5条K线数据，查看数据结构
    console.log("K线数据前5条样本:");
    for (let i = 0; i < Math.min(5, klineData.candlesticks.length); i++) {
      const candle = klineData.candlesticks[i];
      console.log(`[${i}] time=${candle.time}, timestamp=${candle.timestamp}, open=${candle.open}, close=${candle.close}`);
    }

    // 检查每条K线数据是否都有timestamp字段
    const missingTimestamps = klineData.candlesticks.filter((c: any) => !c.timestamp);
    if (missingTimestamps.length > 0) {
      console.warn(`警告: ${missingTimestamps.length}条K线数据缺少timestamp字段!`);
      
      // 尝试修复数据：如果有time字段但没有timestamp字段，使用time字段作为timestamp
      klineData.candlesticks = klineData.candlesticks.map((candle: any) => {
        if (!candle.timestamp && candle.time) {
          return { ...candle, timestamp: candle.time };
        }
        return candle;
      });
      
      console.log("已尝试修复timestamp字段");
    }

    // 运行RSI回测
    console.log("开始执行RSI回测...");
    const backtestResult = await runRSIBacktest(
      klineData.candlesticks,
      rsiPeriod,
      oversoldThreshold,
      overboughtThreshold
    );

    console.log("\n===== 回测结果 =====");
    console.log(`总交易次数: ${backtestResult.trades.length}`);
    console.log(`总收益率: ${backtestResult.profitPct.toFixed(2)}%`);
    console.log(`最大回撤: ${Math.abs(backtestResult.maxDrawdownPct).toFixed(2)}%`);
    console.log(`胜率: ${(backtestResult.winRate * 100).toFixed(2)}%`);
    console.log(`平均盈利: ${backtestResult.avgWinPct.toFixed(2)}%`);
    console.log(`平均亏损: ${Math.abs(backtestResult.avgLossPct).toFixed(2)}%`);

    if (backtestResult.trades.length > 0) {
      // 打印第一笔和最后一笔交易
      const firstTrade = backtestResult.trades[0];
      const lastTrade = backtestResult.trades[backtestResult.trades.length - 1];
      
      console.log("\n第一笔交易:");
      console.log(`入场时间: ${new Date(firstTrade.entryTime).toISOString()}`);
      console.log(`入场价格: ${firstTrade.entryPrice}`);
      if (firstTrade.exitTime) {
        console.log(`出场时间: ${new Date(firstTrade.exitTime).toISOString()}`);
        console.log(`出场价格: ${firstTrade.exitPrice}`);
      }
      console.log(`盈亏: ${firstTrade.profit.toFixed(2)}%`);
      
      console.log("\n最后一笔交易:");
      console.log(`入场时间: ${new Date(lastTrade.entryTime).toISOString()}`);
      console.log(`入场价格: ${lastTrade.entryPrice}`);
      if (lastTrade.exitTime) {
        console.log(`出场时间: ${new Date(lastTrade.exitTime).toISOString()}`);
        console.log(`出场价格: ${lastTrade.exitPrice}`);
      }
      console.log(`盈亏: ${lastTrade.profit.toFixed(2)}%`);
    }

  } catch (error) {
    console.error("测试过程中出错:", error);
  }
}

// 运行测试
testBacktest()
  .then(() => console.log("测试完成"))
  .catch(error => console.error("测试失败:", error)); 