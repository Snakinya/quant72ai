import { NextRequest, NextResponse } from 'next/server';

// 定义类型
interface Candlestick {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface DebugInfo {
  poolAddress: string | null;
  requestTime: string;
  apiUrl: string;
  candleCount: number;
}

interface KlineResponse {
  tokenSymbol: string;
  timeBucket: string;
  candlesticks: Candlestick[];
  debug?: DebugInfo;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const poolAddress = searchParams.get('poolAddress');
  const timeBucket = searchParams.get('timeBucket') || '15s';
  const limit = Number(searchParams.get('limit') || '100');
  const debug = searchParams.get('debug') === 'true';

  if (!poolAddress) {
    return NextResponse.json({ error: 'Pool address is required' }, { status: 400 });
  }
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
  try {
    const endTime = Math.floor(Date.now() / 1000);
    const apiUrl = `https://api.mevx.io/api/v1/candlesticks?chain=base&poolAddress=${actualPoolAddress}&timeBucket=${timeBucket}&endTime=${endTime}&outlier=true&limit=${limit}`;

    console.log(`Fetching K-line data from: ${apiUrl}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Failed to get K-line data: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`K-line data fetched successfully. Total candles: ${data.candlesticks?.length || 0}`);

    if (data.candlesticks && data.candlesticks.length > 0) {
      console.log('First candle:', JSON.stringify(data.candlesticks[0]));
      console.log('Last candle:', JSON.stringify(data.candlesticks[data.candlesticks.length - 1]));

      if (debug) {
        console.log('All candles (first 10):', JSON.stringify(data.candlesticks.slice(0, 10)));

        const firstTimestamp = data.candlesticks[0].timestamp;
        const lastTimestamp = data.candlesticks[data.candlesticks.length - 1].timestamp;
        const firstDate = new Date(firstTimestamp * 1000).toISOString();
        const lastDate = new Date(lastTimestamp * 1000).toISOString();
        console.log(`Time range: ${firstDate} to ${lastDate}`);

        const closes = data.candlesticks.map((c: Candlestick) => parseFloat(c.close));
        const minPrice = Math.min(...closes);
        const maxPrice = Math.max(...closes);
        console.log(`Price range: ${minPrice} to ${maxPrice}`);
      }
    }

    // 获取代币符号
    let tokenSymbol = 'Unknown';
    try {
      const tokenInfoResponse = await fetch(
        `https://api.mevx.io/api/v1/pools/search?q=${poolAddress}`
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

    // 构建返回对象，带类型 ✅
    let responseObj: KlineResponse = {
      tokenSymbol,
      timeBucket,
      candlesticks: data.candlesticks as Candlestick[],
    };

    if (debug) {
      responseObj = {
        ...responseObj,
        debug: {
          poolAddress,
          requestTime: new Date().toISOString(),
          apiUrl,
          candleCount: data.candlesticks?.length || 0,
        },
      };
    }

    return NextResponse.json(responseObj);
  } catch (error: any) {
    console.error('Failed to get kline data:', error);
    return NextResponse.json(
      { error: 'Failed to get kline data', message: error.message },
      { status: 500 }
    );
  }
}
