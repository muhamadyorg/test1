import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody, MoveProductBody, BulkDeleteProductsBody, BulkMoveProductsBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { broadcast } from "../lib/ws.js";
import { nanoid } from "nanoid";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price: Number(p.price),
    attributes: (p.attributes as { key: string; value: string }[]) ?? [],
  };
}

router.get("/", requireAuth, async (req, res) => {
  const catalogId = Number(req.query.catalogId);
  if (isNaN(catalogId)) {
    res.status(400).json({ error: "catalogId required" });
    return;
  }
  const products = await db.select().from(productsTable).where(eq(productsTable.catalogId, catalogId)).orderBy(productsTable.name);
  res.json(products.map(formatProduct));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { name, price, catalogId, imageUrl, attributes, productId } = parsed.data;
  const pid = productId || nanoid(10).toUpperCase();
  const [product] = await db
    .insert(productsTable)
    .values({
      productId: pid,
      name,
      price: String(price),
      catalogId,
      imageUrl: imageUrl ?? null,
      attributes: (attributes as { key: string; value: string }[]) ?? [],
    })
    .returning();
  const result = formatProduct(product);
  broadcast({ type: "product_created", product: result });
  res.status(201).json(result);
});

router.get("/bulk-delete", requireAuth, requireAdmin, async (_req, res) => {
  res.status(405).json({ error: "Use POST" });
});

router.post("/bulk-delete", requireAuth, requireAdmin, async (req, res) => {
  const parsed = BulkDeleteProductsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { ids } = parsed.data;
  await db.delete(productsTable).where(inArray(productsTable.id, ids));
  broadcast({ type: "products_bulk_deleted", ids });
  res.status(204).send();
});

router.post("/bulk-move", requireAuth, requireAdmin, async (req, res) => {
  const parsed = BulkMoveProductsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { ids, newCatalogId } = parsed.data;
  await db.update(productsTable).set({ catalogId: newCatalogId }).where(inArray(productsTable.id, ids));
  broadcast({ type: "products_bulk_moved", ids, newCatalogId });
  res.status(204).send();
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(formatProduct(product));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.price !== undefined) update.price = String(parsed.data.price);
  if (parsed.data.imageUrl !== undefined) update.imageUrl = parsed.data.imageUrl;
  if (parsed.data.attributes !== undefined) update.attributes = parsed.data.attributes;
  if (parsed.data.productId !== undefined) update.productId = parsed.data.productId;
  const [product] = await db.update(productsTable).set(update).where(eq(productsTable.id, id)).returning();
  const result = formatProduct(product);
  broadcast({ type: "product_updated", product: result });
  res.json(result);
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  broadcast({ type: "product_deleted", id });
  res.status(204).send();
});

router.post("/:id/move", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = MoveProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set({ catalogId: parsed.data.newCatalogId, updatedAt: new Date() })
    .where(eq(productsTable.id, id))
    .returning();
  const result = formatProduct(product);
  broadcast({ type: "product_moved", product: result });
  res.json(result);
});

export default router;
