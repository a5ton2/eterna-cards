import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Define the database schema types
export interface Supplier {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  paymentTerms: string | null;
  createdAt: string;
}

export interface POLine {
  id: string;
  purchaseOrderId: string;
  description: string;
  supplierSku: string | null;
  quantity: number;
  unitCostExVAT: number;
  lineTotalExVAT: number;
}

export interface Totals {
  subTotalExVAT: number | null;
  vatTotal: number | null;
  grandTotal: number | null;
}

// Database file path (project root)
const dbPath = path.join(process.cwd(), 'data', 'db.json');

// Ensure the data directory exists under the project root
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Helper function to find or create a supplier
export async function findOrCreateSupplier(
  supplierData: Omit<Supplier, 'id' | 'createdAt'>
): Promise<string> {
  const database = await getDb();

  // Validate that supplier name is not null or empty
  if (!supplierData.name || supplierData.name.trim() === '') {
    throw new Error('Supplier name is required');
  }

  // Try to find existing supplier by name (case-insensitive)
  const existing = database.data.suppliers.find(
    (s) => s.name?.toLowerCase() === supplierData.name?.toLowerCase()
  );

  if (existing) {
    return existing.id;
  }

  // Create new supplier
  const newSupplier: Supplier = {
    id: crypto.randomUUID(),
    ...supplierData,
    createdAt: new Date().toISOString(),
  };

  database.data.suppliers.push(newSupplier);
  await database.write();

  return newSupplier.id;
}

// Helper function to create a purchase order
export async function createPurchaseOrder(
  poData: Omit<PurchaseOrder, 'id' | 'createdAt'>
): Promise<string> {
  const database = await getDb();

  const newPO: PurchaseOrder = {
    id: crypto.randomUUID(),
    ...poData,
    createdAt: new Date().toISOString(),
  };

  database.data.purchaseOrders.push(newPO);
  await database.write();

  return newPO.id;
}

// Helper function to update a purchase order
export async function updatePurchaseOrder(
  poId: string,
  updates: Partial<Omit<PurchaseOrder, 'id' | 'createdAt'>>
): Promise<PurchaseOrder | null> {
  const database = await getDb();

  const poIndex = database.data.purchaseOrders.findIndex(po => po.id === poId);
  if (poIndex === -1) {
    return null;
  }

  // Update the PO with the provided fields
  database.data.purchaseOrders[poIndex] = {
    ...database.data.purchaseOrders[poIndex],
    ...updates,
  };

  await database.write();
  return database.data.purchaseOrders[poIndex];
}

// Helper function to create PO lines
export async function createPOLines(
  lines: Omit<POLine, 'id'>[]
): Promise<POLine[]> {
  const database = await getDb();

  const newLines: POLine[] = lines.map((line) => ({
    id: crypto.randomUUID(),
    ...line,
  }));

  database.data.poLines.push(...newLines);
  await database.write();

  return newLines;
}

// Helper function to update a line item
export async function updatePOLine(
  lineId: string,
  updates: Partial<Omit<POLine, 'id' | 'purchaseOrderId'>>
): Promise<POLine | null> {
  const database = await getDb();

  const lineIndex = database.data.poLines.findIndex(line => line.id === lineId);
  if (lineIndex === -1) {
    return null;
  }

  // Update the line item with the provided fields
  database.data.poLines[lineIndex] = {
    ...database.data.poLines[lineIndex],
    ...updates,
  };

  await database.write();
  return database.data.poLines[lineIndex];
}

// Helper function to delete a line item
export async function deletePOLine(lineId: string): Promise<boolean> {
  const database = await getDb();

  const lineIndex = database.data.poLines.findIndex(line => line.id === lineId);
  if (lineIndex === -1) {
    return false;
  }

  database.data.poLines.splice(lineIndex, 1);
  await database.write();
  return true;
}

// Helper function to delete a supplier
export async function deleteSupplier(supplierId: string): Promise<{
  success: boolean;
  deletedPurchaseOrders: number;
  deletedLines: number;
}> {
  const database = await getDb();

  // Find all purchase orders for this supplier
  const supplierPOs = database.data.purchaseOrders.filter(
    (po) => po.supplierId === supplierId
  );
  const poIds = supplierPOs.map((po) => po.id);

  // Delete all line items for these purchase orders
  const linesBefore = database.data.poLines.length;
  database.data.poLines = database.data.poLines.filter(
    (line) => !poIds.includes(line.purchaseOrderId)
  );
  const deletedLines = linesBefore - database.data.poLines.length;

  // Delete all purchase orders for this supplier
  database.data.purchaseOrders = database.data.purchaseOrders.filter(
    (po) => po.supplierId !== supplierId
  );

  // Delete the supplier
  database.data.suppliers = database.data.suppliers.filter(
    (s) => s.id !== supplierId
  );

  await database.write();

  return {
    success: true,
    deletedPurchaseOrders: supplierPOs.length,
    deletedLines,
  };
}

// New inventory and product types
export interface Product {
  id: string;
  name: string;
  primarySku: string | null;
  supplierSku: string | null;
  barcodes: string[];
  aliases: string[];
  supplierId: string | null;
  category: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRecord {
  id: string;
  productId: string;
  quantityOnHand: number;
  averageCostGBP: number;
  lastUpdated: string;
}

export type TransitStatus = 'in_transit' | 'partially_received' | 'received';

export interface TransitRecord {
  id: string;
  productId: string;
  purchaseOrderId: string;
  poLineId: string;
  supplierId: string;
  quantity: number;
  remainingQuantity: number;
  unitCostGBP: number;
  status: TransitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  createdAt: string;
}

export async function createOrUpdateInvoiceForPurchaseOrder(params: {
  purchaseOrderId: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
}): Promise<Invoice> {
  const database = await getDb();

  if (!Array.isArray(database.data.invoices)) {
    database.data.invoices = [];
  }

  const existing = database.data.invoices.find(
    (inv) => inv.purchaseOrderId === params.purchaseOrderId
  );

  if (existing) {
    existing.supplierId = params.supplierId;
    existing.invoiceNumber = params.invoiceNumber;
    existing.invoiceDate = params.invoiceDate;
    existing.currency = params.currency;
    await database.write();
    return existing;
  }

  const now = new Date().toISOString();
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    purchaseOrderId: params.purchaseOrderId,
    supplierId: params.supplierId,
    invoiceNumber: params.invoiceNumber,
    invoiceDate: params.invoiceDate,
    currency: params.currency,
    createdAt: now,
  };

  database.data.invoices.push(invoice);
  await database.write();

  return invoice;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface InventoryItemView {
  product: Product;
  inventory: InventoryRecord | null;
  quantityInTransit: number;
}

// Updated database schema including inventory-related collections
export interface DatabaseSchema {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: POLine[];
  products: Product[];
  inventory: InventoryRecord[];
  transit: TransitRecord[];
  invoices: Invoice[];
  tasks: Task[];
}

// Helper to build default empty schema
function createDefaultDatabase(): DatabaseSchema {
  return {
    suppliers: [],
    purchaseOrders: [],
    poLines: [],
    products: [],
    inventory: [],
    transit: [],
    invoices: [],
    tasks: [],
  };
}

// Initialize the database
let db: Low<DatabaseSchema> | null = null;

export async function getDb(): Promise<Low<DatabaseSchema>> {
  if (db) return db;

  ensureDataDirectory();

  // Create adapter and database instance
  const adapter = new JSONFile<DatabaseSchema>(dbPath);
  db = new Low<DatabaseSchema>(adapter, createDefaultDatabase());

  // Read data from JSON file (or use default if file doesn't exist)
  await db.read();

  // Initialize with default data if empty, and backfill any missing collections
  if (!db.data) {
    db.data = createDefaultDatabase();
    await db.write();
  } else {
    // Backwards compatible: ensure all collections exist
    if (!Array.isArray(db.data.suppliers)) db.data.suppliers = [];
    if (!Array.isArray(db.data.purchaseOrders)) db.data.purchaseOrders = [];
    if (!Array.isArray(db.data.poLines)) db.data.poLines = [];
    if (!Array.isArray(db.data.products)) db.data.products = [];
    if (!Array.isArray(db.data.inventory)) db.data.inventory = [];
    if (!Array.isArray(db.data.transit)) db.data.transit = [];
    if (!Array.isArray(db.data.invoices)) db.data.invoices = [];
    if (!Array.isArray(db.data.tasks)) db.data.tasks = [];
    await db.write();
  }

  return db;
}

// Interface for duplicate detection result
export interface DuplicateMatch {
  purchaseOrder: PurchaseOrder;
  supplier: Supplier;
  matchScore: number;
  matchReasons: string[];
  lineCount: number;
}

// Helper function to detect duplicate purchase orders
export async function findDuplicatePurchaseOrders(
  supplierName: string,
  invoiceNumber: string | null,
  invoiceDate: string | null,
  poLines: Array<{ description: string; quantity: number; unitCostExVAT: number }>
): Promise<DuplicateMatch[]> {
  const database = await getDb();
  const duplicates: DuplicateMatch[] = [];

  // Find supplier by name (case-insensitive)
  const supplier = database.data.suppliers.find(
    (s) => s.name?.toLowerCase() === supplierName?.toLowerCase()
  );

  if (!supplier) {
    // No supplier found, so no duplicates possible
    return [];
  }

  // Get all purchase orders for this supplier
  const supplierPOs = database.data.purchaseOrders.filter(
    (po) => po.supplierId === supplier.id
  );

  for (const po of supplierPOs) {
    const matchReasons: string[] = [];
    let matchScore = 0;

    // Check invoice number match (strong indicator)
    if (invoiceNumber && po.invoiceNumber &&
        invoiceNumber.toLowerCase() === po.invoiceNumber.toLowerCase()) {
      matchReasons.push('Same invoice number');
      matchScore += 50;
    }

    // Check invoice date match
    if (invoiceDate && po.invoiceDate && invoiceDate === po.invoiceDate) {
      matchReasons.push('Same invoice date');
      matchScore += 20;
    }

    // Get line items for this PO
    const existingLines = database.data.poLines.filter(
      (line) => line.purchaseOrderId === po.id
    );

    // Check if line items are similar
    if (existingLines.length === poLines.length && poLines.length > 0) {
      matchReasons.push('Same number of line items');
      matchScore += 10;

      // Check for matching line items
      let matchingLines = 0;
      for (const newLine of poLines) {
        const similarLine = existingLines.find(
          (existingLine) =>
            existingLine.description.toLowerCase().includes(newLine.description.toLowerCase().substring(0, 20)) ||
            newLine.description.toLowerCase().includes(existingLine.description.toLowerCase().substring(0, 20)) ||
            (Math.abs(existingLine.unitCostExVAT - newLine.unitCostExVAT) < 0.01 &&
             existingLine.quantity === newLine.quantity)
        );
        if (similarLine) {
          matchingLines++;
        }
      }

      if (matchingLines > 0) {
        const matchPercentage = (matchingLines / poLines.length) * 100;
        matchReasons.push(`${matchingLines}/${poLines.length} similar line items`);
        matchScore += matchPercentage * 0.2; // Up to 20 points for 100% match
      }
    }

    // If match score is significant, add to duplicates
    if (matchScore >= 30) {
      duplicates.push({
        purchaseOrder: po,
        supplier,
        matchScore,
        matchReasons,
        lineCount: existingLines.length,
      });
    }
  }

  // Sort by match score (highest first)
  duplicates.sort((a, b) => b.matchScore - a.matchScore);

  return duplicates;
}

// --- Inventory & transit helpers ---

// Normalize text into tokens for fuzzy matching
function normalizeTextForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['the', 'and', 'with', 'card', 'cards', 'booster', 'box', 'boxes', 'ver', 'version'].includes(token));
}

function computeTokenSimilarity(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection++;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

// Sync purchase order lines into products + transit records
export async function syncInventoryFromPurchaseOrder(params: {
  supplierId: string;
  purchaseOrderId: string;
  poLines: POLine[];
}): Promise<{
  productsCreated: number;
  productsMatched: number;
  transitCreated: number;
}> {
  const database = await getDb();

  if (!Array.isArray(database.data.products)) {
    database.data.products = [];
  }
  if (!Array.isArray(database.data.transit)) {
    database.data.transit = [];
  }

  let productsCreated = 0;
  let productsMatched = 0;
  let transitCreated = 0;

  const products = database.data.products;

  for (const line of params.poLines) {
    const rawDescription = line.description?.trim();
    if (!rawDescription) {
      continue;
    }

    const supplierSku = line.supplierSku?.trim() || null;

    // 1. Try exact SKU/barcode match first
    let matchedProduct: Product | null = null;
    if (supplierSku) {
      const skuLower = supplierSku.toLowerCase();
      matchedProduct =
        products.find(
          (p) =>
            p.primarySku?.toLowerCase() === skuLower ||
            p.supplierSku?.toLowerCase() === skuLower ||
            (p.barcodes || []).some((code) => code.toLowerCase() === skuLower)
        ) || null;
    }

    // 2. Fuzzy match on description if no SKU match
    if (!matchedProduct) {
      const lineTokens = normalizeTextForMatch(rawDescription);
      let bestScore = 0;
      for (const candidate of products) {
        const nameTokens = normalizeTextForMatch(candidate.name || '');
        let score = computeTokenSimilarity(lineTokens, nameTokens);

        if ((candidate.aliases || []).length > 0) {
          for (const alias of candidate.aliases) {
            const aliasTokens = normalizeTextForMatch(alias);
            const aliasScore = computeTokenSimilarity(lineTokens, aliasTokens);
            if (aliasScore > score) {
              score = aliasScore;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          matchedProduct = candidate;
        }
      }

      // Require a reasonable similarity threshold to avoid bad matches
      if (bestScore < 0.5) {
        matchedProduct = null;
      }
    }

    const now = new Date().toISOString();
    let product: Product;

    if (matchedProduct) {
      productsMatched++;
      // Update aliases/supplier linkage if needed
      if (!matchedProduct.aliases.includes(rawDescription)) {
        matchedProduct.aliases.push(rawDescription);
      }
      if (!matchedProduct.supplierId) {
        matchedProduct.supplierId = params.supplierId;
      }
      matchedProduct.updatedAt = now;
      product = matchedProduct;
    } else {
      // Create new product
      const newProduct: Product = {
        id: crypto.randomUUID(),
        name: rawDescription,
        primarySku: supplierSku,
        supplierSku,
        barcodes: [],
        aliases: [rawDescription],
        supplierId: params.supplierId,
        category: null,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      products.push(newProduct);
      productsCreated++;
      product = newProduct;
    }

    // Validate quantity and unit cost before creating transit
    const quantity = typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 0;
    const unitCost = typeof line.unitCostExVAT === 'number' && line.unitCostExVAT >= 0
      ? Number(line.unitCostExVAT.toFixed(4))
      : 0;

    if (quantity <= 0) {
      continue;
    }

    const transitRecord: TransitRecord = {
      id: crypto.randomUUID(),
      productId: product.id,
      purchaseOrderId: params.purchaseOrderId,
      poLineId: line.id,
      supplierId: params.supplierId,
      quantity,
      remainingQuantity: quantity,
      unitCostGBP: unitCost,
      status: 'in_transit',
      createdAt: now,
      updatedAt: now,
    };

    database.data.transit.push(transitRecord);
    transitCreated++;
  }

  await database.write();

  return {
    productsCreated,
    productsMatched,
    transitCreated,
  };
}

// Get an inventory snapshot (products + on-hand + quantity in transit)
export async function getInventorySnapshot(): Promise<InventoryItemView[]> {
  const database = await getDb();

  const products = database.data.products || [];
  const inventory = database.data.inventory || [];
  const transit = database.data.transit || [];

  const items: InventoryItemView[] = products.map((product) => {
    const inv = inventory.find((i) => i.productId === product.id) || null;
    const quantityInTransit = transit
      .filter((t) => t.productId === product.id && t.remainingQuantity > 0)
      .reduce((sum, t) => sum + t.remainingQuantity, 0);

    return {
      product,
      inventory: inv,
      quantityInTransit,
    };
  });

  return items;
}

export interface ReceiveStockResult {
  productId: string;
  receivedQuantity: number;
  remainingRequestedQuantity: number;
  newQuantityOnHand: number;
  newAverageCostGBP: number;
  affectedTransitIds: string[];
}

// Move quantities from transit to on-hand inventory using dollar cost averaging
export async function receiveStockForProduct(params: {
  productId: string;
  quantity: number;
}): Promise<ReceiveStockResult> {
  const { productId, quantity } = params;

  if (!productId) {
    throw new Error('productId is required');
  }

  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive number');
  }

  const database = await getDb();

  const product = database.data.products.find((p) => p.id === productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const now = new Date().toISOString();

  if (!Array.isArray(database.data.inventory)) {
    database.data.inventory = [];
  }

  let inventoryRecord = database.data.inventory.find((inv) => inv.productId === productId) || null;
  if (!inventoryRecord) {
    inventoryRecord = {
      id: crypto.randomUUID(),
      productId,
      quantityOnHand: 0,
      averageCostGBP: 0,
      lastUpdated: now,
    };
    database.data.inventory.push(inventoryRecord);
  }

  const transitRecords = (database.data.transit || [])
    .filter((t) => t.productId === productId && t.remainingQuantity > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (transitRecords.length === 0) {
    throw new Error('No in-transit quantity available for this product');
  }

  let remainingToReceive = quantity;
  let receivedQuantity = 0;
  let incomingTotalValue = 0;
  const affectedTransitIds: string[] = [];

  for (const t of transitRecords) {
    if (remainingToReceive <= 0) break;

    const available = t.remainingQuantity;
    if (available <= 0) continue;

    const take = Math.min(remainingToReceive, available);
    const unitCost = typeof t.unitCostGBP === 'number' && t.unitCostGBP >= 0 ? t.unitCostGBP : 0;

    incomingTotalValue += take * unitCost;
    receivedQuantity += take;
    t.remainingQuantity = available - take;
    t.status = t.remainingQuantity > 0 ? 'partially_received' : 'received';
    t.updatedAt = now;
    affectedTransitIds.push(t.id);

    remainingToReceive -= take;
  }

  if (receivedQuantity <= 0) {
    throw new Error('Unable to receive stock: no available in-transit quantity for this product');
  }

  const currentOnHand = inventoryRecord.quantityOnHand;
  const currentAvg = inventoryRecord.averageCostGBP;
  const currentValue = currentOnHand * currentAvg;

  const newOnHand = currentOnHand + receivedQuantity;
  const newAvg = newOnHand > 0
    ? Number(((currentValue + incomingTotalValue) / newOnHand).toFixed(4))
    : 0;

  inventoryRecord.quantityOnHand = newOnHand;
  inventoryRecord.averageCostGBP = newAvg;
  inventoryRecord.lastUpdated = now;

  await database.write();

  return {
    productId,
    receivedQuantity,
    remainingRequestedQuantity: remainingToReceive,
    newQuantityOnHand: newOnHand,
    newAverageCostGBP: newAvg,
    affectedTransitIds,
  };
}

// Attach a barcode to a product (used for scanner-based lookup)
export async function addBarcodeToProduct(
  productId: string,
  barcode: string
): Promise<Product> {
  const trimmed = (barcode || '').trim();
  if (!productId) {
    throw new Error('productId is required');
  }
  if (!trimmed) {
    throw new Error('Barcode is required');
  }
  if (trimmed.length > 128) {
    throw new Error('Barcode is too long');
  }

  const database = await getDb();

  const product = database.data.products.find((p) => p.id === productId);
  if (!product) {
    throw new Error('Product not found');
  }

  if (!Array.isArray(product.barcodes)) {
    product.barcodes = [];
  }

  if (!product.barcodes.includes(trimmed)) {
    product.barcodes.push(trimmed);
    product.updatedAt = new Date().toISOString();
    await database.write();
  }

  return product;
}
