import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Product id is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.read();

    const product = db.data.products.find((p) => p.id === id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const inventory = db.data.inventory.find((inv) => inv.productId === id) || null;

    const supplier = product.supplierId
      ? db.data.suppliers.find((s) => s.id === product.supplierId) || null
      : null;

    const transitRecords = db.data.transit.filter((t) => t.productId === id);
    const poLinesById = new Map(db.data.poLines.map((l) => [l.id, l]));
    const posById = new Map(db.data.purchaseOrders.map((po) => [po.id, po]));
    const invoicesByPoId = new Map(
      db.data.invoices.map((inv) => [inv.purchaseOrderId, inv])
    );

    const transit = transitRecords
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((t) => {
        const po = posById.get(t.purchaseOrderId) || null;
        const poLine = poLinesById.get(t.poLineId) || null;
        const invoice = po ? invoicesByPoId.get(po.id) || null : null;

        return {
          transit: t,
          poLine,
          purchaseOrder: po,
          invoice,
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        product,
        inventory,
        supplier,
        transit,
      },
    });
  } catch (error) {
    console.error('Get product history error:', error);
    return NextResponse.json(
      { error: 'Failed to load product history' },
      { status: 500 }
    );
  }
}
