import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateSupplier, createPurchaseOrder, createPOLines, syncInventoryFromPurchaseOrder, createOrUpdateInvoiceForPurchaseOrder } from '@/lib/db';

interface SavePORequest {
  supplier: {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
    vatNumber?: string;
  };
  purchaseOrder: {
    invoiceNumber?: string;
    invoiceDate?: string;
    originalCurrency?: string;
    paymentTerms?: string;
  };
  poLines: Array<{
    description: string;
    supplierSku?: string;
    quantity: number;
    unitCostExVAT: number;
    lineTotalExVAT: number;
  }>;
}

// POST endpoint to save approved purchase order data
export async function POST(request: NextRequest) {
  try {
    const data: SavePORequest = await request.json();

    // Validate required fields
    if (!data.supplier?.name) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    if (!data.poLines || data.poLines.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Save to database
    try {
      // Create or find supplier
      const supplierId = await findOrCreateSupplier({
        name: data.supplier.name,
        address: data.supplier.address || null,
        email: data.supplier.email || null,
        phone: data.supplier.phone || null,
        vatNumber: data.supplier.vatNumber || null,
      });

      // Create purchase order (always save as GBP since AI converts all prices)
      const purchaseOrderId = await createPurchaseOrder({
        supplierId,
        invoiceNumber: data.purchaseOrder.invoiceNumber || null,
        invoiceDate: data.purchaseOrder.invoiceDate || null,
        currency: 'GBP', // All prices are converted to GBP by AI
        paymentTerms: data.purchaseOrder.paymentTerms || null,
      });

      // Create or update invoice record linked to this purchase order
      const invoice = await createOrUpdateInvoiceForPurchaseOrder({
        purchaseOrderId,
        supplierId,
        invoiceNumber: data.purchaseOrder.invoiceNumber || null,
        invoiceDate: data.purchaseOrder.invoiceDate || null,
        currency: 'GBP',
      });

      // Create PO lines
      const poLines = await createPOLines(
        data.poLines.map((line) => ({
          purchaseOrderId,
          description: line.description,
          supplierSku: line.supplierSku || null,
          quantity: line.quantity,
          unitCostExVAT: line.unitCostExVAT,
          lineTotalExVAT: line.lineTotalExVAT,
        }))
      );

      // Mark all extracted items as in transit for inventory management
      const inventorySync = await syncInventoryFromPurchaseOrder({
        supplierId,
        purchaseOrderId,
        poLines,
      });

      return NextResponse.json({
        success: true,
        data: {
          supplierId,
          purchaseOrderId,
          savedLines: poLines.length,
          inventorySync,
          invoice,
        },
      });
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save data to database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
