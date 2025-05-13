import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export async function POST(request: NextRequest) {
  try {
    // Check user authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get chain information from request body
    const { chain } = await request.json();
    
    // Validate chain type
    if (chain !== 'base' && chain !== 'bsc') {
      return NextResponse.json({ error: 'Invalid chain' }, { status: 400 });
    }
    
    // Success response
    return NextResponse.json({ success: true, chain });
  } catch (error) {
    console.error('Error updating chain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 