import { tool } from 'ai';
import { z } from 'zod';

export const getTokenInfo = tool({
  description: 'Get basic information and trading data for a token',
  parameters: z.object({
    poolAddress: z.string().describe('Pool address of the token'),
  }),
  execute: async ({ poolAddress }) => {
    const response = await fetch(
      `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get token info: ${response.statusText}`);
    }

    const tokenData = await response.json();
    return tokenData;
  },
});

export const analyzeKline = tool({
  description: 'Get token K-line data and perform technical analysis',
  parameters: z.object({
    poolAddress: z.string().describe('Pool address of the token'),
    timeBucket: z.string().default('15s').describe('K-line time period, such as 15s, 1m, 5m, 15m, 1h'),
    limit: z.number().default(300).describe('Number of K-line candles to fetch'),
  }),
  execute: async ({ poolAddress, timeBucket, limit }) => {
    console.log(`analyzeKline called with: poolAddress=${poolAddress}, timeBucket=${timeBucket}, limit=${limit}`);
    
    // Get current timestamp (seconds)
    const endTime = Math.floor(Date.now() / 1000);
    
    // 先搜索获取真正的池地址
    let actualPoolAddress = poolAddress;
    try {
      const searchResponse = await fetch(
        `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
      );
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.pools && searchData.pools.length > 0) {
          actualPoolAddress = searchData.pools[0].poolAddress;
          console.log(`Found pool address: ${actualPoolAddress} for query: ${poolAddress}`);
        }
      }
    } catch (error) {
      console.error('Error searching for pool address:', error);
      // 继续使用原始输入的地址
    }


    const response = await fetch(
      `https://api.mevx.io/api/v1/candlesticks?chain=base&poolAddress=${actualPoolAddress}&timeBucket=${timeBucket}&endTime=${endTime}&outlier=true&limit=${limit}`,
    );

    if (!response.ok) {
      console.error(`Failed to get K-line data: ${response.statusText}`);
      throw new Error(`Failed to get K-line data: ${response.statusText}`);
    }

    const klineData = await response.json();
    console.log(`K-line data fetched from API: ${klineData.candlesticks?.length || 0} candles`);
    
    // Calculate technical indicators
    const candles = klineData.candlesticks;
    const analysisResult = calculateIndicators(candles);
    
    console.log('Analysis result:', {
      trend: analysisResult.trend,
      confidence: analysisResult.confidence,
      indicatorsCount: Object.keys(analysisResult.indicators || {}).length
    });
    
    // Get token symbol from original data
    let tokenSymbol = 'Unknown';
    try {
      // Try to get token info
      const tokenInfoResponse = await fetch(
        `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
      );
      
      if (tokenInfoResponse.ok) {
        const tokenData = await tokenInfoResponse.json();
        if (tokenData.pools && tokenData.pools.length > 0 && tokenData.pools[0].baseTokenInfo) {
          tokenSymbol = tokenData.pools[0].baseTokenInfo.symbol;
          console.log(`Token symbol found: ${tokenSymbol}`);
        }
      }
    } catch (error) {
      console.error('Failed to get token symbol:', error);
    }
    
    // Only return essential analysis data, exclude full candle data
    const result = {
      tokenSymbol,
      timeBucket,
      poolAddress, // Add poolAddress to the response
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
    
    console.log('Returning analysis result to AI');
    return result;
  },
});

// Calculate technical indicators function
function calculateIndicators(candles: any[]) {
  console.log(`Starting technical analysis with ${candles.length} candles`);
  
  if (!candles || candles.length === 0) {
    console.error('No candle data available for analysis');
    return {
      trend: 'Neutral',
      confidence: 50,
      reason: 'Insufficient data for analysis',
      indicators: {}
    };
  }

  try {
    // Extract close prices and volumes
    const closes = candles.map(c => parseFloat(c.close));
    const highs = candles.map(c => parseFloat(c.high));
    const lows = candles.map(c => parseFloat(c.low));
    const volumes = candles.map(c => parseFloat(c.volume));
    const timestamps = candles.map(c => c.timestamp);
    
    console.log('Data extraction complete:', {
      dataPoints: closes.length,
      currentPrice: closes[closes.length - 1],
      timeRange: `${new Date(timestamps[0] * 1000).toISOString()} to ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString()}`
    });

    // Calculate technical indicators
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes);
    const ma = calculateMovingAverages(closes);
    const volumeIndicators = calculateVolumeIndicators(volumes);
    
    console.log('Technical indicators calculated:', {
      rsi: rsi[rsi.length - 1],
      macdHistogram: macd.histogram[macd.histogram.length - 1],
      bollingerWidth: bollinger.upper[bollinger.upper.length - 1] - bollinger.lower[bollinger.lower.length - 1],
      ma5: ma.ma5[ma.ma5.length - 1]
    });

    // Get current price and calculate changes
    const currentPrice = closes[closes.length - 1];
    
    // Calculate price changes
    let priceChange1h = 0;
    let priceChange24h = 0;
    
    const candlesPerHour = 3600 / 15; // Assuming 15s candles
    const candlesPer24h = 24 * candlesPerHour;
    
    if (closes.length > candlesPerHour) {
      const price1hAgo = closes[closes.length - 1 - candlesPerHour];
      priceChange1h = ((currentPrice - price1hAgo) / price1hAgo) * 100;
    }
    
    if (closes.length > candlesPer24h) {
      const price24hAgo = closes[closes.length - 1 - candlesPer24h];
      priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
    } else if (closes.length > 1) {
      // If we don't have 24h of data, use the oldest available
      const oldestPrice = closes[0];
      priceChange24h = ((currentPrice - oldestPrice) / oldestPrice) * 100;
    }
    
    console.log('Price changes calculated:', {
      priceChange1h,
      priceChange24h
    });

    // Analyze price position in Bollinger Bands
    const bollPosition = getPricePositionInBollinger(currentPrice, bollinger);
    
    // Analyze RSI condition
    const rsiCondition = getRSICondition(rsi[rsi.length - 1]);
    
    // Analyze Moving Average system
    const maCondition = getMACondition(ma);
    
    // Analyze MACD
    const macdCondition = getMACDCondition(macd.macd[macd.macd.length - 1], macd.signal[macd.signal.length - 1], macd.histogram[macd.histogram.length - 1]);
    
    // Analyze Volume
    const volumeCondition = getVolumeCondition(volumeIndicators.volumeRatio);
    
    console.log('Condition analysis complete:', {
      bollPosition,
      rsiCondition,
      maCondition,
      macdCondition,
      volumeCondition
    });
    
    // Generate comprehensive analysis
    const { trend, confidence, reason } = generateTrendAnalysis(
      bollPosition, rsiCondition, maCondition, macdCondition, volumeCondition, currentPrice
    );
    
    console.log('Final trend analysis:', {
      trend,
      confidence,
      reason
    });
    
    return {
      trend,
      confidence,
      reason,
      indicators: {
        price: currentPrice,
        priceChange1h,
        priceChange24h,
        rsi: rsi[rsi.length - 1],
        macd: {
          macd: macd.macd[macd.macd.length - 1],
          signal: macd.signal[macd.signal.length - 1],
          histogram: macd.histogram[macd.histogram.length - 1]
        },
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
