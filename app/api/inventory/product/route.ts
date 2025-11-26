import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET product + inventory + transit history for /inventory/[productId]
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

    // 1) Load the product row first
    const { data: productRow, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (productError || !productRow) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // 2) Load related entities in parallel
    const [inventoryRes, supplierRes, transitRes, poLinesRes, purchaseOrdersRes, invoicesRes] =
      await Promise.all([
        supabase.from('inventory').select('*').eq('productid', id),
        productRow.supplierid
          ? supabase.from('suppliers').select('*').eq('id', productRow.supplierid).single()
          : Promise.resolve({ data: null } as any),
        supabase.from('transit').select('*').eq('productid', id),
        supabase.from('polines').select('*'),
        supabase.from('purchaseorders').select('*'),
        supabase.from('invoices').select('*'),
      ]);

    const inventoryRows = inventoryRes.data || [];
    const supplierRow = (supplierRes as any).data || null;
    const transitRows = transitRes.data || [];
    const poLineRows = poLinesRes.data || [];
    const poRows = purchaseOrdersRes.data || [];
    const invoiceRows = invoicesRes.data || [];

    // Map product to camelCase DTO
    const product = {
      id: productRow.id,
      name: productRow.name,
      primarySku: productRow.primarysku ?? null,
      supplierSku: productRow.suppliersku ?? null,
      barcodes: productRow.barcodes ?? [],
      aliases: productRow.aliases ?? [],
      supplierId: productRow.supplierid ?? null,
      category: productRow.category ?? null,
      tags: productRow.tags ?? [],
      createdAt: productRow.created_at,
      updatedAt: productRow.updated_at,
    };

    const inventory =
      inventoryRows[0]
        ? {
            id: inventoryRows[0].id,
            productId: inventoryRows[0].productid,
            quantityOnHand: Number(inventoryRows[0].quantityonhand ?? 0),
            averageCostGBP: Number(inventoryRows[0].averagecostgbp ?? 0),
            lastUpdated: inventoryRows[0].lastupdated,
          }
        : null;

    const supplier = supplierRow
      ? {
          id: supplierRow.id,
          name: supplierRow.name,
          address: supplierRow.address ?? null,
          email: supplierRow.email ?? null,
          phone: supplierRow.phone ?? null,
          vatNumber: null,
          createdAt: supplierRow.created_at,
        }
      : null;

    const poLinesById = new Map(
      poLineRows.map((l: any) => [
        l.id,
        {
          id: l.id,
          purchaseOrderId: l.purchaseorderid,
          description: l.description,
          supplierSku: l.suppliersku ?? null,
          quantity: Number(l.quantity ?? 0),
          unitCostExVAT: Number(l.unitcostexvat ?? 0),
          lineTotalExVAT: Number(l.linetotalexvat ?? 0),
        },
      ])
    );

    const posById = new Map(
      poRows.map((po: any) => [
        po.id,
        {
          id: po.id,
          supplierId: po.supplierid,
          invoiceNumber: po.invoicenumber ?? null,
          invoiceDate: po.invoicedate ?? null,
          currency: po.currency,
          paymentTerms: po.paymentterms ?? null,
          createdAt: po.created_at,
        },
      ])
    );

    const invoicesByPoId = new Map(
      invoiceRows.map((inv: any) => [
        inv.purchaseorderid,
        {
          id: inv.id,
          purchaseOrderId: inv.purchaseorderid,
          supplierId: inv.supplierid,
          invoiceNumber: inv.invoicenumber ?? null,
          invoiceDate: inv.invoicedate ?? null,
          currency: inv.currency,
          createdAt: inv.created_at,
        },
      ])
    );

    const transit = transitRows
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((t: any) => {
        const transitRecord = {
          id: t.id,
          productId: t.productid,
          purchaseOrderId: t.purchaseorderid,
          poLineId: t.polineid,
          supplierId: t.supplierid,
          quantity: Number(t.quantity ?? 0),
          remainingQuantity: Number(t.remainingquantity ?? 0),
          unitCostGBP: Number(t.unitcostgbp ?? 0),
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        };

        const po = posById.get(t.purchaseorderid) || null;
        const poLine = poLinesById.get(t.polineid) || null;
        const invoice = po ? invoicesByPoId.get(po.id) || null : null;

        return {
          transit: transitRecord,
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
