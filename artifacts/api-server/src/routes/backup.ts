import { Router } from "express";
import { db, catalogsTable, productsTable, settingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { eq } from "drizzle-orm";
import https from "https";
import { Readable } from "stream";

const router = Router();

const TG_TOKEN_KEY = "tg_bot_token";
const TG_CHAT_ID_KEY = "tg_chat_id";

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

async function buildBackup() {
  const catalogs = await db.select().from(catalogsTable).orderBy(catalogsTable.id);
  const products = await db.select().from(productsTable).orderBy(productsTable.id);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    catalogs,
    products,
  };
}

// GET /api/backup/settings
router.get("/settings", requireAdmin, async (req, res) => {
  const token = await getSetting(TG_TOKEN_KEY);
  const chatId = await getSetting(TG_CHAT_ID_KEY);
  res.json({ tgBotToken: token ?? "", tgChatId: chatId ?? "" });
});

// PUT /api/backup/settings
router.put("/settings", requireAdmin, async (req, res) => {
  const { tgBotToken, tgChatId } = req.body as { tgBotToken: string; tgChatId: string };
  if (tgBotToken !== undefined) await setSetting(TG_TOKEN_KEY, tgBotToken);
  if (tgChatId !== undefined) await setSetting(TG_CHAT_ID_KEY, tgChatId);
  res.json({ ok: true });
});

// GET /api/backup/export — download JSON
router.get("/export", requireAdmin, async (req, res) => {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const filename = `shop-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(json);
});

// POST /api/backup/import — upload JSON and restore
router.post("/import", requireAdmin, async (req, res) => {
  try {
    const { catalogs, products } = req.body as {
      catalogs?: any[];
      products?: any[];
      version?: number;
    };

    if (!catalogs || !products) {
      res.status(400).json({ error: "Invalid backup file: missing catalogs or products" });
      return;
    }

    // Restore catalogs first (preserve original IDs)
    if (catalogs.length > 0) {
      await db.delete(productsTable);
      await db.delete(catalogsTable);
      for (const cat of catalogs) {
        await db.insert(catalogsTable).values({
          id: cat.id,
          name: cat.name,
          parentId: cat.parentId ?? null,
          imageUrl: cat.imageUrl ?? null,
          sortOrder: cat.sortOrder ?? 0,
          createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
        });
      }
    }

    // Restore products
    if (products.length > 0) {
      for (const prod of products) {
        await db.insert(productsTable).values({
          id: prod.id,
          productId: prod.productId,
          name: prod.name,
          price: prod.price,
          catalogId: prod.catalogId,
          imageUrl: prod.imageUrl ?? null,
          attributes: prod.attributes ?? [],
          createdAt: prod.createdAt ? new Date(prod.createdAt) : new Date(),
          updatedAt: prod.updatedAt ? new Date(prod.updatedAt) : new Date(),
        });
      }
    }

    // Reset auto-increment sequences
    const maxCatalogId = catalogs.length > 0 ? Math.max(...catalogs.map((c: any) => c.id)) : 0;
    const maxProductId = products.length > 0 ? Math.max(...products.map((p: any) => p.id)) : 0;
    if (maxCatalogId > 0) {
      await db.execute(`ALTER SEQUENCE catalogs_id_seq RESTART WITH ${maxCatalogId + 1}` as any);
    }
    if (maxProductId > 0) {
      await db.execute(`ALTER SEQUENCE products_id_seq RESTART WITH ${maxProductId + 1}` as any);
    }

    res.json({
      ok: true,
      catalogsRestored: catalogs.length,
      productsRestored: products.length,
    });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err?.message || "Import failed" });
  }
});

// POST /api/backup/send-telegram
router.post("/send-telegram", requireAdmin, async (req, res) => {
  const token = await getSetting(TG_TOKEN_KEY);
  const chatId = await getSetting(TG_CHAT_ID_KEY);

  if (!token || !chatId) {
    res.status(400).json({ error: "Telegram bot token yoki chat ID kiritilmagan" });
    return;
  }

  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const filename = `shop-backup-${new Date().toISOString().slice(0, 10)}.json`;

  // Build multipart form manually
  const boundary = `----BotBoundary${Date.now()}`;
  const textEncoder = new TextEncoder();

  const captionPart = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="chat_id"`,
    "",
    chatId,
    `--${boundary}`,
    `Content-Disposition: form-data; name="caption"`,
    "",
    `📦 Shop Catalog Backup\n📅 ${new Date().toLocaleString("uz-UZ")}\n📁 Kataloglar: ${backup.catalogs.length} ta\n🛍 Mahsulotlar: ${backup.products.length} ta`,
    `--${boundary}`,
    `Content-Disposition: form-data; name="document"; filename="${filename}"`,
    `Content-Type: application/json`,
    "",
    json,
    `--${boundary}--`,
  ].join("\r\n");

  const body = Buffer.from(textEncoder.encode(captionPart));

  await new Promise<void>((resolve, reject) => {
    const options = {
      hostname: "api.telegram.org",
      path: `/bot${token}/sendDocument`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    };

    const request = https.request(options, (tgRes) => {
      let data = "";
      tgRes.on("data", (chunk) => (data += chunk));
      tgRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            res.json({ ok: true, message: "Backup Telegramga yuborildi" });
            resolve();
          } else {
            res.status(400).json({ error: parsed.description || "Telegram error" });
            resolve();
          }
        } catch {
          res.status(500).json({ error: "Telegram response parse failed" });
          resolve();
        }
      });
    });

    request.on("error", (err) => {
      res.status(500).json({ error: err.message });
      reject(err);
    });

    const readable = Readable.from([body]);
    readable.pipe(request);
  });
});

export default router;
