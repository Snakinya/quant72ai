import { tool } from 'ai';
import { z } from 'zod';

// 缓存系统，减少重复API调用
const cache = {
  tokenInfo: new Map<string, { data: any, timestamp: number }>(),
  klineData: new Map<string, { data: any, timestamp: number }>(),
  // 缓存有效期 (ms)
  TTL: {
    tokenInfo: 5 * 60 * 1000, // 5分钟
    klineData: 30 * 1000      // 30秒
  }
};

// 通用API请求函数，支持缓存
async function fetchWithCache(
  url: string, 
  cacheKey: string, 
  cacheType: 'tokenInfo' | 'klineData'
): Promise<any> {
  // 检查缓存
  const cachedItem = cache[cacheType].get(cacheKey);
  const now = Date.now();
  
  if (cachedItem && (now - cachedItem.timestamp < cache.TTL[cacheType])) {
    return cachedItem.data;
  }
  
  // 无缓存或缓存过期，发起请求
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // 更新缓存
  cache[cacheType].set(cacheKey, { data, timestamp: now });
  
  return data;
}

// 辅助函数：提取池地址
function extractPoolAddress(poolData: any): string | null {
  if (poolData?.pools?.length > 0) {
    return poolData.pools[0].poolAddress;
  }
  return null;
}

// 辅助函数：提取代币符号
function extractTokenSymbol(poolData: any): string {
  if (poolData?.pools?.length > 0 && poolData.pools[0].baseTokenInfo) {
    return poolData.pools[0].baseTokenInfo.symbol;
  }
  return 'Unknown';
}

export const getTokenInfo = tool({
  description: 'Get basic information and trading data for a token',
  parameters: z.object({
    poolAddress: z.string().describe('Pool address of the token'),
  }),
  execute: async ({ poolAddress }) => {
    try {
      const cacheKey = `info_${poolAddress}`;
      const tokenData = await fetchWithCache(
        `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
        cacheKey,
        'tokenInfo'
      );
      return tokenData;
    } catch (error) {
      console.error('获取代币信息失败:', error);
      throw new Error(`获取代币信息失败: ${error.message}`);
    }
  },
});

export const analyzeKline = tool({
  description: 'Get token K-line data and perform technical analysis',
  parameters: z.object({
    poolAddress: z.string().describe('Pool address of the token'),
    timeBucket: z.string().default('15s').describe('K-line time period, such as 15s, 1m, 5m, 15m, 1h'),
    limit: z.number().default(150).describe('Number of K-line candles to fetch'),
  }),
  execute: async ({ poolAddress, timeBucket, limit }) => {
    console.log(`analyzeKline called with: poolAddress=${poolAddress}, timeBucket=${timeBucket}, limit=${limit}`);
    
    try {
      // 获取当前时间戳 (秒)
      const endTime = Math.floor(Date.now() / 1000);
      
      // 一次性获取代币信息
      const tokenInfoCacheKey = `info_${poolAddress}`;
      const tokenData = await fetchWithCache(
        `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
        tokenInfoCacheKey,
        'tokenInfo'
      );
      
      // 提取实际池地址和代币符号
      const actualPoolAddress = extractPoolAddress(tokenData) || poolAddress;
      const tokenSymbol = extractTokenSymbol(tokenData);
      
      console.log(`Using pool address: ${actualPoolAddress} for token: ${tokenSymbol}`);
      
      // 获取K线数据
      const klineCacheKey = `kline_${actualPoolAddress}_${timeBucket}_${limit}_${endTime}`;
      const klineData = await fetchWithCache(
        `https://api.mevx.io/api/v1/candlesticks?chain=base&poolAddress=${actualPoolAddress}&timeBucket=${timeBucket}&endTime=${endTime}&outlier=true&limit=${limit}`,
        klineCacheKey,
        'klineData'
      );
      
      console.log(`K-line data fetched: ${klineData.candlesticks?.length || 0} candles`);
      
      // 计算技术指标
      const candles = klineData.candlesticks || [];
      const analysisResult = calculateIndicators(candles);
      
      // 只返回必要的分析数据
      const result = {
        tokenSymbol,
        timeBucket,
        poolAddress: actualPoolAddress,
        analysis: {
          trend: analysisResult.trend,
          confidence: analysisResult.confidence,
          reason: analysisResult.reason,
          indicators: {
            price: analysisResult.indicators?.price || 0,
            priceChange1h: analysisResult.indicators?.priceChange1h || 0,
            priceChange24h: analysisResult.indicators?.priceChange24h || 0,
            rsi: analysisResult.indicators?.rsi || 50,
            macd: {
              macd: analysisResult.indicators?.macd?.macd || 0,
              signal: analysisResult.indicators?.macd?.signal || 0,
              histogram: analysisResult.indicators?.macd?.histogram || 0
            },
            bollinger: {
              middle: analysisResult.indicators?.bollinger?.middle || 0
            },
            ma: {
              ma5: analysisResult.indicators?.ma?.ma5 || 0
            },
            conditions: {
              bollPosition: analysisResult.indicators?.conditions?.bollPosition || "No data",
              rsiCondition: analysisResult.indicators?.conditions?.rsiCondition || "No data",
              maCondition: analysisResult.indicators?.conditions?.maCondition || "No data",
              macdCondition: analysisResult.indicators?.conditions?.macdCondition || "No data"
            }
          }
        }
      };
      
      return result;
    } catch (error) {
      console.error('K线分析失败:', error);
      return {
        tokenSymbol: 'Unknown',
        timeBucket,
        poolAddress,
        analysis: {
          trend: 'Neutral',
          confidence: 50,
          reason: `分析失败: ${error.message}`,
          indicators: {}
        }
      };
    }
  },
});

// Calculate technical indicators function - 优化计算效率
function calculateIndicators(candles: any[]) {
  console.log(`Starting technical analysis with ${candles.length} candles`);
  
  if (!candles || candles.length === 0) {
    return {
      trend: 'Neutral',
      confidence: 50,
      reason: 'Insufficient data for analysis',
      indicators: {}
    };
  }

  try {
    // 提取价格数据 - 一次性提取所有需要的数据
    const closes = candles.map(c => parseFloat(c.close));
    const highs = candles.map(c => parseFloat(c.high));
    const lows = candles.map(c => parseFloat(c.low));
    const volumes = candles.map(c => parseFloat(c.volume));
    const timestamps = candles.map(c => c.timestamp);
    
    const currentPrice = closes[closes.length - 1];
    
    // 计算技术指标 - 使用优化的计算方法
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes);
    const ma = calculateMovingAverages(closes);
    const volumeIndicators = calculateVolumeIndicators(volumes);
    
    // 计算价格变化
    const priceChanges = calculatePriceChanges(closes, timeBucketToSeconds(candles[0]?.timeBucket || '15s'));
    
    // 分析指标条件
    const currentRSI = rsi[rsi.length - 1];
    const currentMACD = {
      macd: macd.macd[macd.macd.length - 1],
      signal: macd.signal[macd.signal.length - 1],
      histogram: macd.histogram[macd.histogram.length - 1]
    };
    
    const bollPosition = getPricePositionInBollinger(currentPrice, bollinger);
    const rsiCondition = getRSICondition(currentRSI);
    const maCondition = getMACondition(ma);
    const macdCondition = getMACDCondition(currentMACD.macd, currentMACD.signal, currentMACD.histogram);
    const volumeCondition = getVolumeCondition(volumeIndicators.volumeRatio);
    
    // 生成综合分析
    const { trend, confidence, reason } = generateTrendAnalysis(
      bollPosition, rsiCondition, maCondition, macdCondition, volumeCondition, currentPrice
    );
    
    return {
      trend,
      confidence,
      reason,
      indicators: {
        price: currentPrice,
        priceChange1h: priceChanges.priceChange1h,
        priceChange24h: priceChanges.priceChange24h,
        rsi: currentRSI,
        macd: currentMACD,
        bollinger: {
          middle: bollinger.middle[bollinger.middle.length - 1],
          upper: bollinger.upper[bollinger.upper.length - 1],
          lower: bollinger.lower[bollinger.lower.length - 1]
        },
        ma: {
          ma5: ma.ma5[ma.ma5.length - 1],
          ma10: ma.ma10[ma.ma10.length - 1],
          ma20: ma.ma20[ma.ma20.length - 1]
        },
        volume: volumeIndicators,
        conditions: {
          bollPosition,
          rsiCondition,
          maCondition,
          macdCondition,
          volumeCondition
        }
      }
    };
  } catch (error) {
    console.error('Error in calculateIndicators:', error);
    return {
      trend: 'Neutral',
      confidence: 50,
      reason: 'Error in technical analysis',
      indicators: {}
    };
  }
}

// 辅助函数：将时间周期转换为秒
function timeBucketToSeconds(timeBucket: string): number {
  const unit = timeBucket.slice(-1);
  const value = parseInt(timeBucket.slice(0, -1));
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 15; // 默认为15秒
  }
}

// 计算价格变化 - 优化版本
function calculatePriceChanges(closes: number[], timeIntervalSeconds: number) {
  const currentPrice = closes[closes.length - 1];
  let priceChange1h = 0;
  let priceChange24h = 0;
  
  const candlesPerHour = Math.floor(3600 / timeIntervalSeconds);
  const candlesPer24h = Math.floor(24 * candlesPerHour);
  
  // 计算1小时价格变化
  if (closes.length > candlesPerHour) {
    const price1hAgo = closes[closes.length - 1 - candlesPerHour];
    priceChange1h = ((currentPrice - price1hAgo) / price1hAgo) * 100;
  }
  
  // 计算24小时价格变化
  if (closes.length > candlesPer24h) {
    const price24hAgo = closes[closes.length - 1 - candlesPer24h];
    priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
  } else if (closes.length > 1) {
    // 如果没有24小时的数据，使用最早可用的
    const oldestPrice = closes[0];
    priceChange24h = ((currentPrice - oldestPrice) / oldestPrice) * 100;
  }
  
  return { priceChange1h, priceChange24h };
}

// Calculate RSI
function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) {
    return Array(closes.length).fill(50);
  }
  
  const rsi = [];
  let gains = 0;
  let losses = 0;
  
  // Calculate first RSI
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  // Initialize
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // First fill the first period data as 50 (neutral value)
  for (let i = 0; i < period; i++) {
    rsi.push(50);
  }
  
  // Calculate subsequent RSI
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    let currentGain = 0;
    let currentLoss = 0;
    
    if (change >= 0) {
      currentGain = change;
    } else {
      currentLoss = -change;
    }
    
    // Use smoothed RSI formula
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

// Calculate MACD
function calculateMACD(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema12 = calculateEMA(closes, fastPeriod);
  const ema26 = calculateEMA(closes, slowPeriod);
  
  // Calculate MACD line = Fast line (EMA12) - Slow line (EMA26)
  const macdLine = ema12.map((e12, i) => {
    if (i < slowPeriod - 1) return 0;
    return e12 - ema26[i];
  });
  
  // Calculate signal line = 9-day EMA of MACD
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram = MACD line - signal line
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

// Calculate EMA (Exponential Moving Average)
function calculateEMA(data: number[], period: number) {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Initialize EMA value as simple average of the first n items
  let initialSMA = 0;
  for (let i = 0; i < period; i++) {
    initialSMA += data[i] || 0;
  }
  initialSMA = initialSMA / period;
  ema.push(initialSMA);
  
  // Calculate subsequent EMA
  for (let i = 1; i < data.length; i++) {
    const newEMA: number = (data[i] - ema[i-1]) * multiplier + ema[i-1];
    ema.push(newEMA);
  }
  
  return ema;
}

// Calculate Bollinger Bands
function calculateBollingerBands(closes: number[], period = 20, multiplier = 2) {
  const upperBand = [];
  const middleBand = [];
  const lowerBand = [];
  
  // Ensure there is enough data
  if (closes.length < period) {
    return {
      upper: Array(closes.length).fill(closes[closes.length - 1] * 1.05),
      middle: closes,
      lower: Array(closes.length).fill(closes[closes.length - 1] * 0.95)
    };
  }
  
  // Calculate moving average line (middle track)
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      middleBand.push(closes[i]);
      upperBand.push(closes[i] * 1.05);
      lowerBand.push(closes[i] * 0.95);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      const sma = sum / period;
      
      // Calculate standard deviation
      let squaredSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        squaredSum += Math.pow(closes[j] - sma, 2);
      }
      const stdDev = Math.sqrt(squaredSum / period);
      
      middleBand.push(sma);
      upperBand.push(sma + (multiplier * stdDev));
      lowerBand.push(sma - (multiplier * stdDev));
    }
  }
  
  return {
    upper: upperBand,
    middle: middleBand,
    lower: lowerBand
  };
}

// Calculate Moving Average system
function calculateMovingAverages(closes: number[]) {
  return {
    ma5: calculateSMA(closes, 5),
    ma10: calculateSMA(closes, 10),
    ma20: calculateSMA(closes, 20),
    ma50: calculateSMA(closes, 50)
  };
}

// Calculate Simple Moving Average
function calculateSMA(data: number[], period: number) {
  const sma = [];
  
  // For the first period-1 points, use the average of the existing data
  for (let i = 0; i < period - 1; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += data[j];
    }
    sma.push(sum / (i + 1));
  }
  
  // Calculate subsequent SMA
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    sma.push(sum / period);
  }
  
  return sma;
}

// Calculate KDJ indicator
function calculateKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number[], d: number[], j: number[] } {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];
  
  // Calculate %K value
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      // Initialize KDJ values as 50 (neutral value)
      k.push(50);
      d.push(50);
      j.push(50);
    } else {
      // Calculate the latest n-day high and low
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      
      for (let j = i - period + 1; j <= i; j++) {
        highestHigh = Math.max(highestHigh, highs[j]);
        lowestLow = Math.min(lowestLow, lows[j]);
      }
      
      // Calculate unmatured random value RSV
      const rsv = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100 || 50;
      
      // Calculate K value (3-day EMA of RSV)
      const kValue = i === period - 1 ? rsv : (2/3 * k[i-1] + 1/3 * rsv);
      k.push(kValue);
      
      // Calculate D value (3-day EMA of K)
      const dValue = i === period - 1 ? kValue : (2/3 * d[i-1] + 1/3 * kValue);
      d.push(dValue);
      
      // Calculate J value (3*K - 2*D)
      const jValue = 3 * kValue - 2 * dValue;
      j.push(jValue);
    }
  }
  
  return { k, d, j };
}

// Calculate Volume related indicators
function calculateVolumeIndicators(volumes: number[]): { current: number, volumeMA5: number, volumeRatio: number } {
  const volumeMA5 = calculateSMA(volumes, 5);
  
  // Calculate volume ratio (current volume to 5-day average volume)
  const volumeRatio = volumes.length > 5 
    ? volumes[volumes.length - 1] / volumeMA5[volumeMA5.length - 1]
    : 1;
  
  return {
    current: volumes[volumes.length - 1],
    volumeMA5: volumeMA5[volumeMA5.length - 1],
    volumeRatio
  };
}

// Analyze price position in Bollinger Bands
function getPricePositionInBollinger(price: any, bollinger: any) {
  if (price > bollinger.upper) {
    return "Above upper band, possible overbought";
  } else if (price < bollinger.lower) {
    return "Below lower band, possible oversold";
  } else if (price > bollinger.middle) {
    return "Between middle and upper bands, bullish";
  } else {
    return "Between middle and lower bands, bearish";
  }
}

// Analyze RSI condition
function getRSICondition(rsi: any) {
  if (rsi > 70) {
    return "Overbought condition, possible pullback";
  } else if (rsi < 30) {
    return "Oversold condition, possible rebound";
  } else if (rsi > 50) {
    return "Bullish zone";
  } else {
    return "Bearish zone";
  }
}

// Analyze Moving Average system
function getMACondition(ma: any) {
  if (ma.ma5 > ma.ma10 && ma.ma10 > ma.ma20 && ma.ma20 > ma.ma50) {
    return "Bullish alignment, strong uptrend";
  } else if (ma.ma50 > ma.ma20 && ma.ma20 > ma.ma10 && ma.ma10 > ma.ma5) {
    return "Bearish alignment, strong downtrend";
  } else if (ma.ma5 > ma.ma10) {
    return "Short-term MA crossed above, bullish signal";
  } else if (ma.ma5 < ma.ma10) {
    return "Short-term MA crossed below, bearish signal";
  } else {
    return "MAs entangled, trend unclear";
  }
}

// Analyze MACD condition
function getMACDCondition(macd: any, signal: any, histogram: any) {
  if (macd > signal && histogram > 0) {
    return "Golden cross, bullish signal";
  } else if (macd < signal && histogram < 0) {
    return "Death cross, bearish signal";
  } else if (macd > 0 && signal > 0) {
    return "Above zero line, bullish";
  } else {
    return "Below zero line, bearish";
  }
}

// Analyze Volume condition
function getVolumeCondition(volumeRatio: any) {
  if (volumeRatio > 1.5) {
    return "Significant volume increase, watch for trend change";
  } else if (volumeRatio < 0.7) {
    return "Significant volume decrease, possible consolidation";
  } else {
    return "Normal trading volume";
  }
}

// Generate trend analysis based on various indicators
function generateTrendAnalysis(bollPosition: any, rsiCondition: any, maCondition: any, macdCondition: any, volumeCondition: any, currentPrice: any) {
  // Assign weights to each indicator
  let bullishPoints = 0;
  let bearishPoints = 0;
  
  // Analyze Bollinger Bands position
  if (bollPosition.includes("Above upper band")) {
    bearishPoints += 2; // Overbought may pullback
  } else if (bollPosition.includes("Below lower band")) {
    bullishPoints += 2; // Oversold may rebound
  } else if (bollPosition.includes("bullish")) {
    bullishPoints += 1;
  } else if (bollPosition.includes("bearish")) {
    bearishPoints += 1;
  }
  
  // Analyze RSI
  if (rsiCondition.includes("Overbought")) {
    bearishPoints += 2;
  } else if (rsiCondition.includes("Oversold")) {
    bullishPoints += 2;
  } else if (rsiCondition.includes("Bullish")) {
    bullishPoints += 1;
  } else if (rsiCondition.includes("Bearish")) {
    bearishPoints += 1;
  }
  
  // Analyze Moving Average system
  if (maCondition.includes("Bullish alignment")) {
    bullishPoints += 3;
  } else if (maCondition.includes("Bearish alignment")) {
    bearishPoints += 3;
  } else if (maCondition.includes("bullish signal")) {
    bullishPoints += 2;
  } else if (maCondition.includes("bearish signal")) {
    bearishPoints += 2;
  }
  
  // Analyze MACD
  if (macdCondition.includes("Golden cross")) {
    bullishPoints += 3;
  } else if (macdCondition.includes("Death cross")) {
    bearishPoints += 3;
  } else if (macdCondition.includes("bullish")) {
    bullishPoints += 1;
  } else if (macdCondition.includes("bearish")) {
    bearishPoints += 1;
  }
  
  // Analyze Volume
  if (volumeCondition.includes("Significant volume increase")) {
    // Volume typically follows trend, strengthening current trend
    if (bullishPoints > bearishPoints) {
      bullishPoints += 1;
    } else {
      bearishPoints += 1;
    }
  }
  
  // Calculate total score and determine trend
  const totalPoints = bullishPoints + bearishPoints;
  let trend;
  let confidence;
  let reason;
  
  if (bullishPoints > bearishPoints) {
    trend = "Bullish";
    confidence = Math.min(Math.round((bullishPoints / totalPoints) * 100), 100);
    
    // Generate reason
    const reasons = [];
    if (bollPosition.includes("Below lower band") || bollPosition.includes("bullish")) {
      reasons.push(bollPosition);
    }
    if (rsiCondition.includes("Oversold") || rsiCondition.includes("Bullish")) {
      reasons.push(rsiCondition);
    }
    if (maCondition.includes("Bullish") || maCondition.includes("bullish")) {
      reasons.push(maCondition);
    }
    if (macdCondition.includes("Golden") || macdCondition.includes("bullish")) {
      reasons.push(macdCondition);
    }
    
    reason = reasons.join("; ") || "Technical indicators are leaning bullish";
  } else {
    trend = "Bearish";
    confidence = Math.min(Math.round((bearishPoints / totalPoints) * 100), 100);
    
    // Generate reason
    const reasons = [];
    if (bollPosition.includes("Above upper band") || bollPosition.includes("bearish")) {
      reasons.push(bollPosition);
    }
    if (rsiCondition.includes("Overbought") || rsiCondition.includes("Bearish")) {
      reasons.push(rsiCondition);
    }
    if (maCondition.includes("Bearish") || maCondition.includes("bearish")) {
      reasons.push(maCondition);
    }
    if (macdCondition.includes("Death") || macdCondition.includes("bearish")) {
      reasons.push(macdCondition);
    }
    
    reason = reasons.join("; ") || "Technical indicators are leaning bearish";
  }
  
  return { trend, confidence, reason };
}
