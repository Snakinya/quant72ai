import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const poolAddress = searchParams.get('poolAddress');
  const timeBucket = searchParams.get('timeBucket') || '15s';
  const limit = Number(searchParams.get('limit') || '100');
  const debug = searchParams.get('debug') === 'true';
  
  if (!poolAddress) {
    return NextResponse.json({ error: 'Pool address is required' }, { status: 400 });
  }
  
  try {
    const endTime = Math.floor(Date.now() / 1000);
    const apiUrl = `https://api.mevx.io/api/v1/candlesticks?chain=base&poolAddress=${poolAddress}&timeBucket=${timeBucket}&endTime=${endTime}&outlier=true&limit=${limit}`;
    
    console.log(`Fetching K-line data from: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to get K-line data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 打印K线数据摘要
    console.log(`K-line data fetched successfully. Total candles: ${data.candlesticks?.length || 0}`);
    
    if (data.candlesticks && data.candlesticks.length > 0) {
      // 打印第一条和最后一条数据作为示例
      console.log('First candle:', JSON.stringify(data.candlesticks[0]));
      console.log('Last candle:', JSON.stringify(data.candlesticks[data.candlesticks.length - 1]));
      
      if (debug) {
        console.log('All candles (first 10):', JSON.stringify(data.candlesticks.slice(0, 10)));
        
        // 打印时间范围
        const firstTimestamp = data.candlesticks[0].timestamp;
        const lastTimestamp = data.candlesticks[data.candlesticks.length - 1].timestamp;
        const firstDate = new Date(firstTimestamp * 1000).toISOString();
        const lastDate = new Date(lastTimestamp * 1000).toISOString();
        console.log(`Time range: ${firstDate} to ${lastDate}`);
        
        // 打印价格范围
        const closes = data.candlesticks.map(c => parseFloat(c.close));
        const minPrice = Math.min(...closes);
        const maxPrice = Math.max(...closes);
        console.log(`Price range: ${minPrice} to ${maxPrice}`);
      }
    }
    
    // 获取代币符号
    let tokenSymbol = 'Unknown';
    try {
      const tokenInfoResponse = await fetch(
        `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`,
      );
      
      if (tokenInfoResponse.ok) {
        const tokenData = await tokenInfoResponse.json();
        if (tokenData.pools && tokenData.pools.length > 0 && tokenData.pools[0].baseTokenInfo) {
          tokenSymbol = tokenData.pools[0].baseTokenInfo.symbol;
          console.log(`Token symbol: ${tokenSymbol}`);
          
          if (debug) {
            console.log('Pool info:', JSON.stringify(tokenData.pools[0]));
          }
        }
      }
    } catch (error) {
      console.error('Failed to get token symbol:', error);
    }
    
    // 构建返回对象
    let responseObj = {
      tokenSymbol,
      timeBucket,
      candlesticks: data.candlesticks
    };
    
    // 如果是调试模式，添加更多信息
    if (debug) {
      responseObj = {
        ...responseObj,
        debug: {
          poolAddress,
          requestTime: new Date().toISOString(),
          apiUrl,
          candleCount: data.candlesticks?.length || 0
        }
      };
    }
    
    // 返回数据
    return NextResponse.json(responseObj);
  } catch (error) {
    console.error('Failed to get kline data:', error);
    return NextResponse.json(
      { error: 'Failed to get kline data', message: error.message }, 
      { status: 500 }
    );
  }
} 