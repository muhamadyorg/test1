import { type HikvisionEvent } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  addEvent(event: Omit<HikvisionEvent, "id" | "receivedAt">): Promise<HikvisionEvent>;
  getEvents(): Promise<HikvisionEvent[]>;
  clearEvents(): Promise<void>;
}

export class MemStorage implements IStorage {
  private events: HikvisionEvent[] = [];
  private readonly maxEvents = 200;

  async addEvent(data: Omit<HikvisionEvent, "id" | "receivedAt">): Promise<HikvisionEvent> {
    const event: HikvisionEvent = {
      ...data,
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
    };
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    return event;
  }

  async getEvents(): Promise<HikvisionEvent[]> {
    return this.events;
  }

  async clearEvents(): Promise<void> {
    this.events = [];
  }
}

export const storage = new MemStorage();
