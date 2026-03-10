import { z } from "zod";

export const hikvisionEventSchema = z.object({
  id: z.string(),
  receivedAt: z.string(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  deviceName: z.string().optional(),
  eventType: z.string().optional(),
  eventState: z.string().optional(),
  eventDescription: z.string().optional(),
  dateTime: z.string().optional(),
  name: z.string().optional(),
  cardNo: z.string().optional(),
  employeeNo: z.string().optional(),
  cardType: z.string().optional(),
  attendanceStatus: z.string().optional(),
  door: z.string().optional(),
  doorNo: z.string().optional(),
  verifyMode: z.string().optional(),
  majorEventType: z.string().optional(),
  subEventType: z.string().optional(),
  userType: z.string().optional(),
  rawBody: z.string(),
  contentType: z.string().optional(),
});

export type HikvisionEvent = z.infer<typeof hikvisionEventSchema>;
