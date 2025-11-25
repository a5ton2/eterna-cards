import { NextResponse } from 'next/server';
import { getDb, syncInventoryFromPurchaseOrder, type POLine } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    await db.read();

    const purchaseOrders = db.data.purchaseOrders || [];
    const poLines = db.data.poLines || [];
    const existingTransit = db.data.transit || [];

    const poIdsWithTransit = new Set(existingTransit.map((t) => t.purchaseOrderId));

    const linesByPo = new Map<string, POLine[]>();
    for (const line of poLines) {
      const arr = linesByPo.get(line.purchaseOrderId) || [];
      arr.push(line);
      linesByPo.set(line.purchaseOrderId, arr);
    }

    let purchaseOrdersProcessed = 0;
    let productsCreated = 0;
    let productsMatched = 0;
    let transitCreated = 0;

    for (const po of purchaseOrders) {
      const lines = linesByPo.get(po.id) || [];
      if (lines.length === 0) continue;
      if (poIdsWithTransit.has(po.id)) continue; // already synced

      const result = await syncInventoryFromPurchaseOrder({
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        poLines: lines,
      });

      purchaseOrdersProcessed += 1;
      productsCreated += result.productsCreated;
      productsMatched += result.productsMatched;
      transitCreated += result.transitCreated;
    }

    return NextResponse.json({
      success: true,
      data: {
        purchaseOrdersProcessed,
        productsCreated,
        productsMatched,
        transitCreated,
      },
    });
  } catch (error) {
    console.error('Inventory backfill error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill inventory from purchase orders' },
      { status: 500 }
    );
  }
}
