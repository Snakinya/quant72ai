import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { toast } from 'sonner';

// 定义轻量级图表库的全局类型
declare global {
  interface Window {
    LightweightCharts: any;
  }
}

// 引入轻量级图表库
const chartLibScript = `https://cdn.jsdelivr.net/npm/lightweight-charts@4.0.1/dist/lightweight-charts.standalone.production.js`;

interface KlineData {
  tokenSymbol?: string;
  timeBucket?: string;
  poolAddress?: string;
  candlesticks?: Array<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
  analysis: {
    trend: string;
    confidence: number;
    reason: string;
    indicators: {
      price: number;
      priceChange1h: number;
      priceChange24h: number;
      rsi: number;
      macd: {
        macd: number;
        signal: number;
        histogram: number;
      };
      bollinger: {
        middle: number;
      };
      ma: {
        ma5: number;
      };
      conditions: {
        bollPosition: string;
        rsiCondition: string;
        maCondition: string;
        macdCondition: string;
      };
    };
  };
}

interface KlineChartProps {
  data: KlineData;
  tokenSymbol?: string;
  timeBucket?: string;
}

// 添加蜡烛图类型定义
interface Candle {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

// 在文件顶部添加状态类型
interface BacktestResult {
  trades: any[];
  profitPct: number;
  maxDrawdownPct: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
}

export function KlineChart({ data, tokenSymbol = 'Unknown', timeBucket = '15s' }: KlineChartProps) {
  // 使用传入的或数据中的token symbol和time bucket
  const displaySymbol = data.tokenSymbol || tokenSymbol;
  const displayTimeBucket = data.timeBucket || timeBucket;
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ chart: IChartApi; handleResize: () => void; remove: () => void } | null>(null);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState<boolean>(false);
  const [candlesticks, setCandlesticks] = useState<any[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  
  // 改进formatNumber函数以更好地处理极小值
  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return 'N/A';
    if (num === 0) return '0';
    
    const absNum = Math.abs(num);
    
    // 对于极小的值使用科学计数法
    if (absNum < 0.00000001) {
      return num.toExponential(8);
    } 
    // 对于比较小的值使用更多小数位
    else if (absNum < 0.00001) {
      return num.toFixed(10);
    }
    else if (absNum < 0.001) {
      return num.toFixed(8);
    }
    else if (absNum < 0.1) {
      return num.toFixed(6);
    }
    else if (absNum < 1) {
      return num.toFixed(5);
    }
    else if (absNum < 100) {
      return num.toFixed(4);
    }
    
    return num.toFixed(2);
  };
  
  // 格式化百分比
  const formatPercent = (num: number) => {
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  // 加载图表库
  useEffect(() => {
    if (window.LightweightCharts) {
      setIsLibraryLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = chartLibScript;
    script.async = true;
    
    script.onload = () => {
      console.log('Lightweight Charts library loaded');
      setIsLibraryLoaded(true);
    };
    
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // 获取K线数据
  useEffect(() => {
    // 从分析数据中提取池地址
    const poolAddress = data.poolAddress;
    
    if (!poolAddress) {
      console.log('No pool address provided');
      return;
    }
    
    const fetchKlineData = async () => {
      setIsLoadingCandles(true);
      try {
        // 限制K线数据量为合理的数值，避免过多数据传输和处理
        // 大多数图表分析只需要200-500条数据就足够了
        const dataLimit = 500;
        const url = `/api/kline?poolAddress=${poolAddress}&timeBucket=${displayTimeBucket}&limit=${dataLimit}&debug=true`;
        console.log('Fetching K-line data from:', url);
        
        const response = await fetch(url);
        
        if (response.ok) {
          const klineData = await response.json();
          console.log('K-line data received:', {
            tokenSymbol: klineData.tokenSymbol,
            timeBucket: klineData.timeBucket,
            candleCount: klineData.candlesticks?.length
          });
          
          if (klineData.debug) {
            console.log('Debug info:', klineData.debug);
            setDebugInfo(klineData.debug);
          }
          
          if (klineData.candlesticks && klineData.candlesticks.length > 0) {
            console.log('Sample candle:', klineData.candlesticks[0]);
            
            // 检查数据结构是否正确
            const validData = klineData.candlesticks.every((candle: any) => 
              typeof candle.timestamp === 'number' && 
              typeof candle.open === 'string' && 
              typeof candle.high === 'string' && 
              typeof candle.low === 'string' && 
              typeof candle.close === 'string'
            );
            
            if (!validData) {
              console.error('Invalid candle data structure', klineData.candlesticks[0]);
            } else {
              setCandlesticks(klineData.candlesticks);
            }
          } else {
            console.log('No candlestick data received');
          }
        } else {
          console.error('Failed to fetch candle data:', await response.text());
        }
      } catch (error) {
        console.error('Failed to fetch candle data:', error);
      } finally {
        setIsLoadingCandles(false);
      }
    };
    
    fetchKlineData();
  }, [data.poolAddress, displayTimeBucket]);

  // 当K线数据和图表库都准备好时渲染图表
  useEffect(() => {
    if (isLibraryLoaded && candlesticks.length > 0) {
      renderChart();
    }
  }, [isLibraryLoaded, candlesticks]);

  // 简单计算移动平均线的辅助函数
  const calculateSMA = (data: number[], period: number) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += data[j];
        }
        result.push(sum / period);
      }
    }
    return result;
  };

  const renderChart = () => {
    if (!chartContainerRef.current || !window.LightweightCharts || !candlesticks.length) {
      console.log('Chart container, library not ready, or no candlestick data', {
        containerReady: !!chartContainerRef.current,
        libraryReady: !!window.LightweightCharts,
        candlesCount: candlesticks.length
      });
      return;
    }
    
    try {
      console.log('Rendering chart with', candlesticks.length, 'candles');
      
      // 如果已经有图表，先清除
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      
      // 创建图表
      const { createChart } = window.LightweightCharts;
      
      if (typeof createChart !== 'function') {
        console.error('LightweightCharts.createChart is not a function', window.LightweightCharts);
        return;
      }
      
      // 专门为蜡烛图优化数据格式
      const candleData = candlesticks.map(candle => {
        // 确保时间戳格式正确
        const time = Math.floor(Number(candle.timestamp));
        
        // 确保所有价格数据都是有效数字
        const open = Number(parseFloat(candle.open).toFixed(12));
        const high = Number(parseFloat(candle.high).toFixed(12));
        const low = Number(parseFloat(candle.low).toFixed(12));
        const close = Number(parseFloat(candle.close).toFixed(12));
        
        // 检查数据有效性
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(time)) {
          console.error('Invalid candle data:', { time, open, high, low, close });
          return null;
        }
        
        // 确保high >= low
        const validHigh = Math.max(high, low, open, close);
        const validLow = Math.min(low, high, open, close);
        
        // 确保开盘和收盘价不完全相同，给蜡烛一些"厚度"
        let validOpen = open;
        let validClose = close;
        
        // 如果开盘价和收盘价完全相同，稍微修改使它们有差异
        if (Math.abs(validOpen - validClose) < 0.000000000001) {
          // 添加一个微小差异，约为价格的0.01%
          const priceDiff = validOpen * 0.0001;
          validClose = validClose + priceDiff;
        }
        
        return {
          time,
          open: validOpen,
          high: validHigh,
          low: validLow,
          close: validClose
        };
      }).filter(candle => candle !== null);
      
      // 确保数据按时间升序排列（注意之前是降序）
      candleData.sort((a, b) => a.time - b.time);
      
      // 打印数据样本
      if (candleData.length > 0) {
        console.log('First candle:', candleData[0]);
        console.log('Last candle:', candleData[candleData.length - 1]);
        console.log('Sample candles (first 3):', candleData.slice(0, 3));
        console.log('Time span:', 
          new Date(candleData[0].time * 1000).toLocaleString(),
          'to',
          new Date(candleData[candleData.length - 1].time * 1000).toLocaleString(),
          `(${candleData.length} candles)`
        );
      }
      
      // 创建图表
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { type: 'solid', color: '#FFFFFF' },
          textColor: '#333333',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#E0E0E0' },
          horzLines: { color: '#E0E0E0' },
        },
        crosshair: {
          mode: 1,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          borderColor: '#E0E0E0',
          barSpacing: 18,  // 增大蜡烛间距，使蜡烛更宽
          rightOffset: 5,
          minBarSpacing: 10, // 增大最小间距
          fixLeftEdge: true,
          fixRightEdge: true,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000);
            return date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0');
          }
        },
        localization: {
          timeFormatter: (timestamp: number) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleTimeString();
          },
        },
        priceScale: {
          autoScale: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          borderVisible: true,
        },
      });
      
      // 确保高度和宽度设置正确
      if (chartContainerRef.current) {
        chart.resize(
          chartContainerRef.current.clientWidth, 
          chartContainerRef.current.clientHeight
        );
      }
      
      // 配置蜡烛图系列
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickVisible: true,
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 10,
          minMove: 0.0000000001,
        },
        lastValueVisible: true,
      });
      
      // 处理数据中重复的时间戳
      const timeMap = new Map();
      const uniqueCandleData = [];
      
      for (const candle of candleData) {
        if (!timeMap.has(candle.time)) {
          timeMap.set(candle.time, true);
          uniqueCandleData.push(candle);
        } else {
          console.log('Duplicate timestamp found:', candle.time);
        }
      }
      
      console.log(`Removed ${candleData.length - uniqueCandleData.length} duplicate candles.`);
      
      // 确保数据点差异足够大
      const processedData = uniqueCandleData.map(candle => {
        // 原始价格
        const origOpen = candle.open;
        const origHigh = candle.high;
        const origLow = candle.low;
        const origClose = candle.close;
        
        // 价格平均值
        const avgPrice = (origHigh + origLow) / 2;
        
        // 确保高点和低点有明显区别
        const heightFactor = Math.max(avgPrice * 0.001, 0.00000000001); // 至少0.1%的差距
        const newHigh = origHigh + heightFactor;
        const newLow = Math.max(origLow - heightFactor, 0); // 确保不为负
        
        // 确保开盘价和收盘价有区别
        let newOpen, newClose;
        
        // 如果开盘收盘价几乎相同，则进行调整
        if (Math.abs(origOpen - origClose) < heightFactor / 2) {
          // 增加50%幅度的价差
          newOpen = avgPrice - (heightFactor / 4); 
          newClose = avgPrice + (heightFactor / 4);
        } else {
          // 保持原有涨跌方向，但确保价差足够明显
          if (origClose > origOpen) {
            newOpen = origOpen;
            newClose = Math.max(origOpen + heightFactor/2, origClose);
          } else {
            newClose = origClose;
            newOpen = Math.max(origClose + heightFactor/2, origOpen);
          }
        }
        
        return {
          time: candle.time,
          open: newOpen,
          high: newHigh,
          low: newLow,
          close: newClose
        };
      });
      
      // 打印处理后的数据样本
      if (processedData.length > 0) {
        console.log('Processed first candle:', processedData[0]);
        console.log('Processed last candle:', processedData[processedData.length - 1]);
      }
      
      // 设置蜡烛图数据
      try {
        console.log(`Setting ${processedData.length} processed candles to chart`);
        candlestickSeries.setData(processedData);
        console.log('Candle data set to chart successfully');
      } catch (error) {
        console.error('Error setting candle data:', error);
      }
      
      // 添加移动平均线
      const closes = processedData.map(d => d.close);
      
      // MA5
      const ma5 = calculateSMA(closes, 5);
      const ma5Series = chart.addLineSeries({
        color: '#2196F3',
        lineWidth: 1,
        title: 'MA5',
      });
      
      const ma5Data = ma5
        .map((value, index) => value !== null ? { time: processedData[index].time, value } : null)
        .filter(item => item !== null);
      
      ma5Series.setData(ma5Data);
      
      // MA10
      const ma10 = calculateSMA(closes, 10);
      const ma10Series = chart.addLineSeries({
        color: '#FF9800',
        lineWidth: 1,
        title: 'MA10',
      });
      
      const ma10Data = ma10
        .map((value, index) => value !== null ? { time: processedData[index].time, value } : null)
        .filter(item => item !== null);
      
      ma10Series.setData(ma10Data);
      
      // 自动调整到可见区域
      chart.timeScale().fitContent();
      
      // 添加调整大小的监听器
      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          chart.resize(
            chartContainerRef.current.clientWidth, 
            chartContainerRef.current.clientHeight
          );
          chart.timeScale().fitContent();
        }
      };
      
      // 监听窗口大小变化
      window.addEventListener('resize', handleResize);
      
      // 初始调整一次大小
      setTimeout(handleResize, 100);
      
      // 保存图表引用
      chartRef.current = {
        chart,
        handleResize,
        remove: () => {
          window.removeEventListener('resize', handleResize);
          chart.remove();
        }
      };
    } catch (error) {
      console.error('Error rendering chart:', error);
    }
  };
  
  // 运行RSI回测
  const runBacktest = async () => {
    try {
      setIsBacktesting(true);
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candleData: candlesticks,
          rsiPeriod: 14,
          oversoldThreshold: 30,
          overboughtThreshold: 70
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run backtest');
      }

      const result = await response.json();
      setBacktestResult(result);
      toast.success('Backtest completed successfully');
    } catch (error) {
      console.error('Backtest error:', error);
      toast.error('Failed to run backtest');
    } finally {
      setIsBacktesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">{displaySymbol} Technical Analysis</CardTitle>
          <CardDescription>Timeframe: {displayTimeBucket}</CardDescription>
        </div>
        <Badge variant={data.analysis.trend === 'Bullish' ? 'success' : 'destructive'}>
          Forecast: {data.analysis.trend} ({data.analysis.confidence}% confidence)
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 价格信息 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">Current Price</div>
            <div className="text-xl font-semibold">{formatNumber(data.analysis.indicators.price)}</div>
          </div>
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">1h Change</div>
            <div className={`text-xl font-semibold ${data.analysis.indicators.priceChange1h > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(data.analysis.indicators.priceChange1h)}
            </div>
          </div>
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">24h Change</div>
            <div className={`text-xl font-semibold ${data.analysis.indicators.priceChange24h > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(data.analysis.indicators.priceChange24h)}
            </div>
          </div>
        </div>
        
        {/* K线图 */}
        <div className="w-full h-[400px] bg-white border border-gray-200 rounded-md relative" ref={chartContainerRef}>
          {(!isLibraryLoaded || isLoadingCandles || candlesticks.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              {isLoadingCandles ? 'Loading chart data...' : 
               !isLibraryLoaded ? 'Loading chart library...' : 
               'No chart data available'}
            </div>
          )}
        </div>
        
        {/* 技术指标信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">RSI</div>
            <div className={`text-base font-semibold ${
              data.analysis.indicators.rsi >= 50 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatNumber(data.analysis.indicators.rsi)}
            </div>
            <div className="text-xs text-gray-500 overflow-hidden text-ellipsis">
              {data.analysis.indicators.conditions.rsiCondition}
            </div>
          </div>
          
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">MACD</div>
            <div className={`text-base font-semibold ${
              data.analysis.indicators.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatNumber(data.analysis.indicators.macd.histogram)}
            </div>
            <div className="text-xs text-gray-500 overflow-hidden text-ellipsis">
              {data.analysis.indicators.conditions.macdCondition}
            </div>
          </div>
          
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">Bollinger Bands</div>
            <div className="text-base font-semibold text-gray-800">
              Middle: {formatNumber(data.analysis.indicators.bollinger.middle)}
            </div>
            <div className="text-xs text-gray-600">{data.analysis.indicators.conditions.bollPosition}</div>
          </div>
          
          <div className="bg-gray-100 rounded-md p-2">
            <div className="text-sm text-gray-600">Moving Averages</div>
            <div className="text-base font-semibold text-gray-800">
              MA5: {formatNumber(data.analysis.indicators.ma.ma5)}
            </div>
            <div className="text-xs text-gray-600">{data.analysis.indicators.conditions.maCondition}</div>
          </div>
        </div>
        
        {/* 分析结论 */}
        <div className="bg-gray-100 rounded-md p-3 mt-4">
          <div className="text-sm font-medium mb-1 text-gray-700">Analysis Reasoning</div>
          <div className="text-sm text-gray-600">{data.analysis.reason}</div>
        </div>
        
        {/* 添加回测控制和结果显示 */}
        <div className="mt-4 space-y-4">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={runBacktest}
              variant="outline"
              disabled={isBacktesting || !candlesticks.length}
            >
              {isBacktesting ? 'Running...' : 'Run RSI Backtest'}
            </Button>
          </div>
          
          {/* 回测结果显示区域 */}
          {backtestResult && (
            <div className="bg-gray-100 rounded-md p-3">
              <div className="text-sm font-medium mb-2">Backtest Results</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="bg-white rounded p-2">
                  <div className="text-xs text-gray-500">Total Profit</div>
                  <div className={`text-sm font-medium ${backtestResult.profitPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {backtestResult.profitPct.toFixed(2)}%
                  </div>
                </div>
                
                <div className="bg-white rounded p-2">
                  <div className="text-xs text-gray-500">Max Drawdown</div>
                  <div className="text-sm font-medium text-red-600">
                    {backtestResult.maxDrawdownPct.toFixed(2)}%
                  </div>
                </div>
                
                <div className="bg-white rounded p-2">
                  <div className="text-xs text-gray-500">Win Rate</div>
                  <div className="text-sm font-medium">
                    {(backtestResult.winRate * 100).toFixed(1)}%
                  </div>
                </div>
                
                <div className="bg-white rounded p-2">
                  <div className="text-xs text-gray-500">Avg Win</div>
                  <div className="text-sm font-medium text-green-600">
                    {backtestResult.avgWinPct.toFixed(2)}%
                  </div>
                </div>
                
                <div className="bg-white rounded p-2">
                  <div className="text-xs text-gray-500">Avg Loss</div>
                  <div className="text-sm font-medium text-red-600">
                    {backtestResult.avgLossPct.toFixed(2)}%
                  </div>
                </div>
                
                <div className="bg-white rounded p-2">
                  <div className="text-xs text-gray-500">Total Trades</div>
                  <div className="text-sm font-medium">
                    {backtestResult.trades.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}