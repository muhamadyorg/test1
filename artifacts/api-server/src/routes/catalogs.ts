import { Router } from "express";
import { db, catalogsTable, productsTable } from "@workspace/db";
import { eq, isNull, count, sql } from "drizzle-orm";
import { CreateCatalogBody, UpdateCatalogBody, MoveCatalogBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { broadcast } from "../lib/ws.js";

const router = Router();

async function catalogWithCounts(id: number) {
  const [cat] = await db.select().from(catalogsTable).where(eq(catalogsTable.id, id));
  if (!cat) return null;
  const [{ childCount }] = await db
    .select({ childCount: count() })
    .from(catalogsTable)
    .where(eq(catalogsTable.parentId, id));
  const [{ productCount }] = await db
    .select({ productCount: count() })
    .from(productsTable)
    .where(eq(productsTable.catalogId, id));
  return { ...cat, childCount: Number(childCount), productCount: Number(productCount) };
}

router.get("/", requireAuth, async (req, res) => {
  const parentId = req.query.parentId !== undefined ? Number(req.query.parentId) : null;
  let catalogs;
  if (parentId === null || isNaN(parentId as number)) {
    catalogs = await db.select().from(catalogsTable).where(isNull(catalogsTable.parentId)).orderBy(catalogsTable.sortOrder, catalogsTable.name);
  } else {
    catalogs = await db.select().from(catalogsTable).where(eq(catalogsTable.parentId, parentId as number)).orderBy(catalogsTable.sortOrder, catalogsTable.name);
  }
  const withCounts = await Promise.all(
    catalogs.map(async (cat) => {
      const [{ childCount }] = await db.select({ childCount: count() }).from(catalogsTable).where(eq(catalogsTable.parentId, cat.id));
      const [{ productCount }] = await db.select({ productCount: count() }).from(productsTable).where(eq(productsTable.catalogId, cat.id));
      return { ...cat, childCount: Number(childCount), productCount: Number(productCount) };
    })
  );
  res.json(withCounts);
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { name, parentId, imageUrl, sortOrder } = parsed.data;
  const [cat] = await db
    .insert(catalogsTable)
    .values({ name, parentId: parentId ?? null, imageUrl: imageUrl ?? null, sortOrder: sortOrder ?? 0 })
    .returning();
  const result = await catalogWithCounts(cat.id);
  broadcast({ type: "catalog_created", catalog: result });
  res.status(201).json(result);
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const result = await catalogWithCounts(id);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.imageUrl !== undefined) update.imageUrl = parsed.data.imageUrl;
  if (parsed.data.sortOrder !== undefined) update.sortOrder = parsed.data.sortOrder;
  await db.update(catalogsTable).set(update).where(eq(catalogsTable.id, id));
  const result = await catalogWithCounts(id);
  broadcast({ type: "catalog_updated", catalog: result });
  res.json(result);
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(catalogsTable).where(eq(catalogsTable.id, id));
  broadcast({ type: "catalog_deleted", id });
  res.status(204).send();
});

router.post("/:id/move", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = MoveCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const newParentId = (parsed.data as { newParentId?: number | null }).newParentId ?? null;
  await db.update(catalogsTable).set({ parentId: newParentId }).where(eq(catalogsTable.id, id));
  const result = await catalogWithCounts(id);
  broadcast({ type: "catalog_moved", catalog: result });
  res.json(result);
});

router.get("/:id/breadcrumb", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const breadcrumb: { id: number; name: string }[] = [];
  let currentId: number | null = id;
  while (currentId !== null) {
    const [cat] = await db.select().from(catalogsTable).where(eq(catalogsTable.id, currentId));
    if (!cat) break;
    breadcrumb.unshift({ id: cat.id, name: cat.name });
    currentId = cat.parentId ?? null;
  }
  res.json(breadcrumb);
});

export default router;
