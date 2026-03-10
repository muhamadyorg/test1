import { type HikvisionEvent, type Employee, type InsertEmployee } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  addEvent(event: Omit<HikvisionEvent, "id" | "receivedAt">): Promise<HikvisionEvent | null>;
  getEvents(): Promise<HikvisionEvent[]>;
  clearEvents(): Promise<void>;
  addEmployee(data: InsertEmployee): Promise<Employee>;
  getEmployees(): Promise<Employee[]>;
  getEmployeeByNo(employeeNo: string): Promise<Employee | undefined>;
  updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private events: HikvisionEvent[] = [];
  private employees: Employee[] = [];
  private readonly maxEvents = 500;
  private recentEventKeys = new Map<string, number>();
  private readonly dedupWindowMs = 5000;

  async addEvent(data: Omit<HikvisionEvent, "id" | "receivedAt">): Promise<HikvisionEvent | null> {
    const key = `${data.employeeNo || data.cardNo || data.ipAddress || "unknown"}-${data.attendanceStatus || ""}`;
    const now = Date.now();

    const lastSeen = this.recentEventKeys.get(key);
    if (lastSeen && now - lastSeen < this.dedupWindowMs) {
      return null;
    }
    this.recentEventKeys.set(key, now);

    for (const [k, t] of this.recentEventKeys.entries()) {
      if (now - t > this.dedupWindowMs * 2) this.recentEventKeys.delete(k);
    }

    const employee = data.employeeNo ? await this.getEmployeeByNo(data.employeeNo) : undefined;
    const resolvedName = employee?.name || data.name || undefined;

    const event: HikvisionEvent = {
      ...data,
      resolvedName,
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

  async addEmployee(data: InsertEmployee): Promise<Employee> {
    const employee: Employee = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.employees.push(employee);
    return employee;
  }

  async getEmployees(): Promise<Employee[]> {
    return this.employees;
  }

  async getEmployeeByNo(employeeNo: string): Promise<Employee | undefined> {
    return this.employees.find(e => e.employeeNo === employeeNo);
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const idx = this.employees.findIndex(e => e.id === id);
    if (idx === -1) return undefined;
    this.employees[idx] = { ...this.employees[idx], ...data };
    return this.employees[idx];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const before = this.employees.length;
    this.employees = this.employees.filter(e => e.id !== id);
    return this.employees.length < before;
  }
}

export const storage = new MemStorage();
