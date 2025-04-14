import { NextRequest, NextResponse } from 'next/server';
import { runRSIBacktest } from '@/lib/backtest/rsi-strategy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candleData, rsiPeriod, oversoldThreshold, overboughtThreshold } = body;

    if (!candleData || !Array.isArray(candleData)) {
      return NextResponse.json({ error: 'Invalid candle data' }, { status: 400 });
    }

    const result = await runRSIBacktest(
      candleData,
      rsiPeriod || 14,
      oversoldThreshold || 30,
      overboughtThreshold || 70
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Backtest error:', error);
    return NextResponse.json(
      { error: 'Failed to run backtest', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 