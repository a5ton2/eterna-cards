import { NextRequest, NextResponse } from 'next/server';
import { addBarcodeToProduct } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = body?.productId as string | undefined;
    const barcode = body?.barcode as string | undefined;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json(
        { error: 'barcode is required' },
        { status: 400 }
      );
    }

    const product = await addBarcodeToProduct(productId, barcode);

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Add barcode error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add barcode' },
      { status: 500 }
    );
  }
}
