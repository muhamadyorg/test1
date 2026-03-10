import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertEmployeeSchema } from "@shared/schema";
import { log } from "./index";

function extractXml(xml: string, field: string): string {
  const re = new RegExp(`<${field}[^>]*>([^<]*)<\/${field}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractXmlFromMultipart(rawBody: string): string {
  // Find XML portion inside multipart/form-data body
  const xmlStart = rawBody.indexOf("<?xml");
  if (xmlStart === -1) {
    // Try without XML declaration
    const tagStart = rawBody.indexOf("<EventNotificationAlert");
    if (tagStart === -1) return "";
    const tagEnd = rawBody.indexOf("</EventNotificationAlert>");
    if (tagEnd === -1) return rawBody.slice(tagStart);
    return rawBody.slice(tagStart, tagEnd + "</EventNotificationAlert>".length);
  }
  // Find end of XML (stop at binary/boundary data)
  const xmlEnd = rawBody.indexOf("</EventNotificationAlert>");
  if (xmlEnd === -1) return rawBody.slice(xmlStart);
  return rawBody.slice(xmlStart, xmlEnd + "</EventNotificationAlert>".length);
}

function parseHikvisionBody(rawBody: string, contentType: string) {
  // If multipart, extract the XML part first
  let bodyToParse = rawBody;
  if (contentType.includes("multipart")) {
    bodyToParse = extractXmlFromMultipart(rawBody);
  }

  const isXml =
    contentType.includes("xml") ||
    contentType.includes("multipart") ||
    bodyToParse.trimStart().startsWith("<?xml") ||
    bodyToParse.trimStart().startsWith("<") ||
    rawBody.trimStart().startsWith("<?xml") ||
    rawBody.includes("<EventNotificationAlert");

  if (isXml) {
    const x = bodyToParse || rawBody;
    const employeeNo =
      extractXml(x, "employeeNoString") ||
      extractXml(x, "employeeNo") ||
      extractXml(x, "empNo") ||
      extractXml(x, "userID") ||
      extractXml(x, "userid") ||
      extractXml(x, "UserID");

    return {
      ipAddress: extractXml(x, "ipAddress"),
      macAddress: extractXml(x, "macAddress"),
      deviceName: extractXml(x, "deviceName"),
      eventType: extractXml(x, "eventType"),
      eventState: extractXml(x, "eventState"),
      eventDescription: extractXml(x, "eventDescription"),
      dateTime: extractXml(x, "dateTime"),
      name: extractXml(x, "name"),
      cardNo: extractXml(x, "cardNo"),
      employeeNo,
      cardType: extractXml(x, "cardType"),
      attendanceStatus: extractXml(x, "attendanceStatus"),
      door: extractXml(x, "door"),
      doorNo: extractXml(x, "doorNo"),
      verifyMode: extractXml(x, "currentVerifyMode"),
      majorEventType: extractXml(x, "majorEventType"),
      subEventType: extractXml(x, "subEventType"),
      userType: extractXml(x, "userType"),
    };
  }

  try {
    const j = JSON.parse(rawBody);
    const ace = j.AccessControllerEvent || j.accessControllerEvent || {};
    const employeeNo =
      ace.employeeNoString || ace.employeeNo || ace.empNo || ace.userID || "";
    return {
      ipAddress: j.ipAddress || "",
      macAddress: j.macAddress || "",
      deviceName: ace.deviceName || j.deviceName || "",
      eventType: j.eventType || "",
      eventState: j.eventState || "",
      eventDescription: j.eventDescription || "",
      dateTime: j.dateTime || "",
      name: ace.name || "",
      cardNo: ace.cardNo || "",
      employeeNo,
      cardType: ace.cardType || "",
      attendanceStatus: ace.attendanceStatus || "",
      door: ace.door?.toString() || "",
      doorNo: ace.doorNo?.toString() || "",
      verifyMode: ace.currentVerifyMode || "",
      majorEventType: ace.majorEventType?.toString() || "",
      subEventType: ace.subEventType?.toString() || "",
      userType: ace.userType || "",
    };
  } catch {
    return {};
  }
}


// ---- Diagnostics buffer ----
interface DiagEntry {
  time: string;
  ip: string;
  contentType: string;
  bodySize: number;
  rawBody: string;
  parsed: Record<string, string | undefined>;
  decision: "saved" | "duplicate" | "ignored";
  reason: string;
}
const diagLog: DiagEntry[] = [];
const MAX_DIAG = 50;
function addDiag(entry: DiagEntry) {
  diagLog.unshift(entry);
  if (diagLog.length > MAX_DIAG) diagLog.pop();
}
// ----------------------------

let wss: WebSocketServer;

function broadcast(data: object) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws) => {
    log("WebSocket client connected", "ws");
    ws.on("close", () => log("WebSocket client disconnected", "ws"));
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      const contentType = req.headers["content-type"] || "";
      let rawBody = "";

      if (typeof req.body === "string" && req.body.length > 0) {
        rawBody = req.body;
      } else if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
        rawBody = req.rawBody.toString("utf8");
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        rawBody = req.body.toString("utf8");
      } else if (typeof req.body === "object" && req.body !== null) {
        rawBody = JSON.stringify(req.body, null, 2);
      }

      const parsed = parseHikvisionBody(rawBody, contentType);

      const status = (parsed.attendanceStatus || "").toLowerCase();
      const verifyMode = (parsed.verifyMode || "").toLowerCase();
      log(
        `Event ${req.ip} | sub=${parsed.subEventType||"-"} | emp=${parsed.employeeNo||"-"} | verify=${verifyMode||"-"} | status=${status||"-"} | ${rawBody.length}B`,
        "hikvision"
      );

      // No filtering — save everything, dedup handles duplicates
      const event = await storage.addEvent({
        ...parsed,
        rawBody: rawBody || "(empty body)",
        contentType,
      });

      if (event) {
        broadcast({ type: "new_event", event });
        const who = event.resolvedName || event.name || event.employeeNo || "Noma'lum";
        const reason = `Saqlandi: ${who} | verify=${event.verifyMode||"-"} | status=${event.attendanceStatus||"-"} | sub=${event.subEventType||"-"}`;
        log(reason, "hikvision");
        addDiag({ time: new Date().toISOString(), ip: req.ip || "", contentType, bodySize: rawBody.length, rawBody: rawBody.slice(0, 2000), parsed: parsed as Record<string, string>, decision: "saved", reason });
      } else {
        const reason = `Dublikat (5s): emp=${parsed.employeeNo||"?"} | sub=${parsed.subEventType||"?"}`;
        log(`Duplicate skipped`, "hikvision");
        addDiag({ time: new Date().toISOString(), ip: req.ip || "", contentType, bodySize: rawBody.length, rawBody: rawBody.slice(0, 2000), parsed: parsed as Record<string, string>, decision: "duplicate", reason });
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error processing event:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/events", async (_req: Request, res: Response) => {
    const events = await storage.getEvents();
    res.json(events);
  });

  app.delete("/api/events", async (_req: Request, res: Response) => {
    await storage.clearEvents();
    broadcast({ type: "cleared" });
    res.json({ success: true });
  });

  app.post("/api/events/test", async (_req: Request, res: Response) => {
    const employees = await storage.getEmployees();
    const testEmployee = employees[0];
    const sampleXml = `<?xml version='1.0' encoding='utf-8'?>
<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <ipAddress>192.168.1.65</ipAddress>
  <macAddress>AA:BB:CC:DD:EE:FF</macAddress>
  <dateTime>${new Date().toISOString()}</dateTime>
  <eventType>AccessControllerEvent</eventType>
  <eventState>active</eventState>
  <eventDescription>Access Controller Event</eventDescription>
  <AccessControllerEvent>
    <deviceName>DS-K1T343EFWX - Kirish eshigi</deviceName>
    <majorEventType>5</majorEventType>
    <subEventType>75</subEventType>
    <name>${testEmployee?.name || "Test Foydalanuvchi"}</name>
    <cardNo>00481234</cardNo>
    <cardType>normalCard</cardType>
    <attendanceStatus>checkIn</attendanceStatus>
    <door>1</door>
    <doorNo>1</doorNo>
    <employeeNoString>${testEmployee?.employeeNo || "9999"}</employeeNoString>
    <userType>normal</userType>
    <currentVerifyMode>face</currentVerifyMode>
  </AccessControllerEvent>
</EventNotificationAlert>`;

    const parsed = parseHikvisionBody(sampleXml, "application/xml");
    const event = await storage.addEvent({
      ...parsed,
      rawBody: sampleXml,
      contentType: "application/xml (test)",
    });

    if (event) broadcast({ type: "new_event", event });
    res.json({ success: true, event });
  });

  app.get("/api/employees", async (_req: Request, res: Response) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post("/api/employees", async (req: Request, res: Response) => {
    const parsed = insertEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const existing = await storage.getEmployeeByNo(parsed.data.employeeNo);
    if (existing) {
      return res.status(409).json({ error: "Bu Employee ID allaqachon mavjud" });
    }
    const employee = await storage.addEmployee(parsed.data);
    broadcast({ type: "employee_added", employee });
    res.status(201).json(employee);
  });

  app.put("/api/employees/:id", async (req: Request, res: Response) => {
    const parsed = insertEmployeeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const employee = await storage.updateEmployee(req.params.id, parsed.data);
    if (!employee) return res.status(404).json({ error: "Topilmadi" });
    broadcast({ type: "employee_updated", employee });
    res.json(employee);
  });

  app.delete("/api/employees/:id", async (req: Request, res: Response) => {
    const ok = await storage.deleteEmployee(req.params.id);
    if (!ok) return res.status(404).json({ error: "Topilmadi" });
    broadcast({ type: "employee_deleted", id: req.params.id });
    res.json({ success: true });
  });

  // ---- /diagnos — diagnostics page ----
  app.get("/diagnos", async (_req: Request, res: Response) => {
    const events = await storage.getEvents();
    const employees = await storage.getEmployees();
    const uptime = Math.floor(process.uptime());
    const mem = process.memoryUsage();

    const decisionColor = (d: string) =>
      d === "saved" ? "#16a34a" : d === "duplicate" ? "#ca8a04" : "#dc2626";
    const decisionLabel = (d: string) =>
      d === "saved" ? "✅ SAQLANDI" : d === "duplicate" ? "⚠️ DUBLIKAT" : "❌ IGNORE";

    const rows = diagLog.map((e, i) => {
      const p = e.parsed;
      const fields = [
        ["eventType", p.eventType], ["subEventType", p.subEventType],
        ["employeeNo", p.employeeNo], ["name", p.name],
        ["attendanceStatus", p.attendanceStatus], ["verifyMode", p.verifyMode],
        ["ipAddress", p.ipAddress], ["majorEventType", p.majorEventType],
      ].filter(([, v]) => v).map(([k, v]) => `<span style="background:#1e293b;padding:2px 6px;border-radius:4px;margin:2px;display:inline-block"><b style="color:#94a3b8">${k}:</b> <span style="color:#f1f5f9">${v}</span></span>`).join(" ");

      const rawEscaped = e.rawBody.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

      return `<div style="border:1px solid #334155;border-radius:8px;padding:12px;margin-bottom:12px;background:#0f172a">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="color:#64748b;font-size:12px">#${diagLog.length - i} &nbsp; ${e.time.replace("T"," ").slice(0,19)}</span>
          <span style="font-weight:bold;color:${decisionColor(e.decision)}">${decisionLabel(e.decision)}</span>
        </div>
        <div style="margin-bottom:6px;font-size:12px">
          <span style="color:#64748b">IP:</span> <b style="color:#e2e8f0">${e.ip}</b> &nbsp;
          <span style="color:#64748b">CT:</span> <span style="color:#e2e8f0">${e.contentType}</span> &nbsp;
          <span style="color:#64748b">Hajm:</span> <span style="color:#e2e8f0">${e.bodySize}B</span>
        </div>
        <div style="margin-bottom:8px;font-size:12px">${fields || '<span style="color:#ef4444">Hech qanday maydon topilmadi!</span>'}</div>
        <div style="font-size:12px;color:${decisionColor(e.decision)};margin-bottom:6px"><b>Sabab:</b> ${e.reason}</div>
        <details style="margin-top:4px">
          <summary style="cursor:pointer;color:#60a5fa;font-size:12px">Raw body ko'rish (${e.bodySize}B)</summary>
          <pre style="background:#020617;color:#a5f3fc;padding:10px;border-radius:6px;margin-top:6px;overflow-x:auto;font-size:11px;white-space:pre-wrap;word-break:break-all">${rawEscaped}</pre>
        </details>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnostika — Hikvision Listener</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #020617; color: #e2e8f0; font-family: 'Consolas', monospace; padding: 20px; }
  h1 { color: #38bdf8; margin-bottom: 4px; }
  h2 { color: #94a3b8; font-size: 14px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 20px; }
  .stat { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; }
  .stat-val { font-size: 24px; font-weight: bold; color: #38bdf8; }
  .stat-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
  .rule { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 13px; }
  .refresh { color: #60a5fa; font-size: 13px; margin-bottom: 16px; display: block; }
</style>
<meta http-equiv="refresh" content="10">
</head>
<body>
<h1>🔍 Hikvision — Diagnostika Sahifasi</h1>
<a class="refresh" href="/diagnos">↻ Yangilash (har 10s avtomatik yangilanadi)</a>

<h2>📊 Server holati</h2>
<div class="stat-grid">
  <div class="stat"><div class="stat-val">${uptime}s</div><div class="stat-lbl">Ishlash vaqti</div></div>
  <div class="stat"><div class="stat-val">${events.length}</div><div class="stat-lbl">Saqlangan hodisalar</div></div>
  <div class="stat"><div class="stat-val">${employees.length}</div><div class="stat-lbl">Xodimlar</div></div>
  <div class="stat"><div class="stat-val">${diagLog.length}</div><div class="stat-lbl">So'nggi so'rovlar (bufer)</div></div>
  <div class="stat"><div class="stat-val">${diagLog.filter(d=>d.decision==="saved").length}</div><div class="stat-lbl">Saqlangan (bufer)</div></div>
  <div class="stat"><div class="stat-val">${diagLog.filter(d=>d.decision==="ignored").length}</div><div class="stat-lbl">Ignore qilingan</div></div>
  <div class="stat"><div class="stat-val">${diagLog.filter(d=>d.decision==="duplicate").length}</div><div class="stat-lbl">Dublikat</div></div>
  <div class="stat"><div class="stat-val">${Math.round(mem.rss/1024/1024)}MB</div><div class="stat-lbl">Xotira (RSS)</div></div>
</div>

<h2>📋 Filtr qoidalari (hozirgi holat)</h2>
<div class="rule">✅ <b>Barcha kelgan so'rovlar saqlanadi</b> — hech qanday filtr yo'q</div>
<div class="rule">⚠️ <b>Dublikat</b> — bir xil hodisa 5 soniya ichida qayta kelsa (bir martadan ko'p hisoblanmaydi)</div>

<h2>📡 Xodimlar ro'yxati (${employees.length} ta)</h2>
${employees.length ? `<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px;font-size:13px">
${employees.map(e=>`<div style="padding:4px 0;border-bottom:1px solid #1e293b"><b style="color:#38bdf8">${e.employeeNo}</b> → ${e.name} ${e.position?`<span style="color:#64748b">(${e.position})</span>`:""}</div>`).join("")}
</div>` : `<div style="color:#ef4444;padding:12px;background:#0f172a;border-radius:8px;border:1px solid #334155">⚠️ Hech qanday xodim qo'shilmagan! Dashboard → Xodimlar tabiga qo'shing.</div>`}

<h2>📥 So'nggi ${diagLog.length} ta so'rov (yangi → eski)</h2>
${diagLog.length === 0
  ? `<div style="color:#64748b;padding:20px;text-align:center;border:1px dashed #334155;border-radius:8px">Hali hech qanday so'rov kelmagan.<br>Qurilma sozlamalarini tekshiring: IP=${_req.hostname}, port=4637, URL=/api/events</div>`
  : rows}

<p style="color:#334155;font-size:12px;margin-top:20px">Sahifa har 10 soniyada avtomatik yangilanadi. Oxirgi ${MAX_DIAG} ta so'rov saqlanadi.</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
  // ------------------------------------

  return httpServer;
}
