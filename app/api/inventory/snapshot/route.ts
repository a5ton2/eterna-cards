import { NextResponse } from 'next/server';
import { getInventorySnapshot } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const snapshot = await getInventorySnapshot();

    // Get suppliers for enrichment
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('*');
    
    const suppliersById = new Map(suppliers?.map((s) => [s.id, s]) || []);

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
