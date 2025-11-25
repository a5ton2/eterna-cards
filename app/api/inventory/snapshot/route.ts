import { NextResponse } from 'next/server';
import { getDb, getInventorySnapshot } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    await db.read();

    const snapshot = await getInventorySnapshot();

    const suppliersById = new Map(db.data.suppliers.map((s) => [s.id, s]));

    const enriched = snapshot.map((item) => ({
      product: item.product,
      inventory: item.inventory,
      quantityInTransit: item.quantityInTransit,
      supplier: item.product.supplierId ? suppliersById.get(item.product.supplierId) ?? null : null,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Inventory snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to load inventory snapshot' },
      { status: 500 }
    );
  }
}
