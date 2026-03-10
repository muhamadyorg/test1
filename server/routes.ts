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

function parseHikvisionBody(rawBody: string, contentType: string) {
  const isXml =
    contentType.includes("xml") ||
    rawBody.trimStart().startsWith("<?xml") ||
    rawBody.trimStart().startsWith("<");

  if (isXml) {
    // Try multiple field names for employee number
    const employeeNo =
      extractXml(rawBody, "employeeNoString") ||
      extractXml(rawBody, "employeeNo") ||
      extractXml(rawBody, "empNo") ||
      extractXml(rawBody, "userID") ||
      extractXml(rawBody, "userid") ||
      extractXml(rawBody, "UserID");

    return {
      ipAddress: extractXml(rawBody, "ipAddress"),
      macAddress: extractXml(rawBody, "macAddress"),
      deviceName: extractXml(rawBody, "deviceName"),
      eventType: extractXml(rawBody, "eventType"),
      eventState: extractXml(rawBody, "eventState"),
      eventDescription: extractXml(rawBody, "eventDescription"),
      dateTime: extractXml(rawBody, "dateTime"),
      name: extractXml(rawBody, "name"),
      cardNo: extractXml(rawBody, "cardNo"),
      employeeNo,
      cardType: extractXml(rawBody, "cardType"),
      attendanceStatus: extractXml(rawBody, "attendanceStatus"),
      door: extractXml(rawBody, "door"),
      doorNo: extractXml(rawBody, "doorNo"),
      verifyMode: extractXml(rawBody, "currentVerifyMode"),
      majorEventType: extractXml(rawBody, "majorEventType"),
      subEventType: extractXml(rawBody, "subEventType"),
      userType: extractXml(rawBody, "userType"),
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

      // Log key fields for debugging
      const status = (parsed.attendanceStatus || "").toLowerCase();
      log(
        `Event from ${req.ip} | sub=${parsed.subEventType || "-"} | emp=${parsed.employeeNo || "-"} | name=${parsed.name || "-"} | status=${status || "-"} | ${rawBody.length}B`,
        "hikvision"
      );

      // Save if: attendance button pressed (checkIn/checkOut) OR face/card/fp verified (verifyMode set)
      // Reject pure system events with no person data (no verifyMode, no status, no employee, no name)
      const verifyMode = (parsed.verifyMode || "").toLowerCase();
      const validStatuses = ["checkin", "checkout", "breakin", "breakout", "normal", "overtime", "other"];
      const hasStatus = validStatuses.includes(status);
      const hasVerify = verifyMode.length > 0;
      const hasPerson = !!(parsed.employeeNo || parsed.name);

      if (!hasStatus && !hasVerify && !hasPerson) {
        log(`Ignored: no person/verify data (status="${status||"empty"}", verifyMode="${verifyMode||"empty"}")`, "hikvision");
        return res.status(200).send("OK");
      }

      const event = await storage.addEvent({
        ...parsed,
        rawBody: rawBody || "(empty body)",
        contentType,
      });

      if (event) {
        broadcast({ type: "new_event", event });
        log(`Saved: ${event.resolvedName || event.name || event.employeeNo || "unknown"} — ${event.attendanceStatus || "entry"}`, "hikvision");
      } else {
        log(`Duplicate skipped (${parsed.employeeNo || "unknown"})`, "hikvision");
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

  return httpServer;
}
