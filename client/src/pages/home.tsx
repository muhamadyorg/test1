import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { HikvisionEvent, Employee } from "@shared/schema";
import { insertEmployeeSchema } from "@shared/schema";
import type { InsertEmployee } from "@shared/schema";
import {
  Wifi, WifiOff, DoorOpen, User, Clock, Trash2, FlaskConical,
  ChevronDown, ChevronRight, Fingerprint, CreditCard, Radio,
  RefreshCw, Settings, Sun, Moon, Plus, Pencil, UserCheck,
  BadgeCheck, Phone, Briefcase, AlertCircle, Users,
} from "lucide-react";

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("uz-UZ", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

function getAttendanceBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "checkin": return { label: "Kirish ↓", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    case "checkout": return { label: "Chiqish ↑", color: "bg-orange-500/15 text-orange-500 border-orange-500/30" };
    case "breakin": return { label: "Tanaffus kirish", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" };
    case "breakout": return { label: "Tanaffus chiqish", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" };
    default: return { label: status || "Hodisa", color: "bg-muted text-muted-foreground border-border" };
  }
}

function EmployeeAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500", "bg-cyan-500", "bg-amber-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-lg" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials || <User className="w-4 h-4" />}
    </div>
  );
}

function EventCard({ event, isNew, employees }: { event: HikvisionEvent; isNew: boolean; employees: Employee[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const attendance = getAttendanceBadge(event.attendanceStatus || "");
  const employee = event.employeeNo ? employees.find(e => e.employeeNo === event.employeeNo) : undefined;
  const displayName = event.resolvedName || employee?.name || event.name || null;
  const isUnknown = !displayName;

  return (
    <div
      data-testid={`event-card-${event.id}`}
      className={`border border-card-border rounded-xl bg-card overflow-hidden transition-all duration-300 ${isNew ? "ring-2 ring-primary/50 shadow-lg shadow-primary/10" : ""}`}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          {displayName ? (
            <EmployeeAvatar name={displayName} />
          ) : (
            <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${isUnknown ? "text-muted-foreground italic" : "text-foreground"}`}>
              {displayName || "Noma'lum xodim"}
            </span>
            {isNew && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse">YANGI</span>
            )}
            {employee?.position && (
              <span className="text-[11px] text-muted-foreground">{employee.position}</span>
            )}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${attendance.color}`}>
              {attendance.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {event.employeeNo && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />ID: {event.employeeNo}
              </span>
            )}
            {event.doorNo && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DoorOpen className="w-3 h-3" />Eshik #{event.doorNo}
              </span>
            )}
            {event.verifyMode && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Fingerprint className="w-3 h-3" />{event.verifyMode}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatTime(event.receivedAt)}
            </span>
          </div>
        </div>

        <div className="text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-card-border bg-muted/20">
          <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              ["IP Manzil", event.ipAddress], ["MAC", event.macAddress],
              ["Qurilma", event.deviceName], ["Hodisa turi", event.eventType],
              ["Karta raqami", event.cardNo], ["Karta turi", event.cardType],
              ["Foydalanuvchi turi", event.userType], ["Tekshiruv usuli", event.verifyMode],
              ["Sana/Vaqt", event.dateTime],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</span>
                <span className="text-foreground font-mono break-all">{value as string}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-card-border px-4 pb-4 pt-2">
            <button className="text-xs text-primary flex items-center gap-1 hover:underline mb-2" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Raw XML/JSON ({event.rawBody.length} bytes)
            </button>
            {showRaw && (
              <pre className="bg-background border border-border rounded-lg p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-56 overflow-y-auto">
                {event.rawBody}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      employeeNo: employee?.employeeNo || "",
      name: employee?.name || "",
      position: employee?.position || "",
      phone: employee?.phone || "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertEmployee) =>
      employee
        ? apiRequest("PUT", `/api/employees/${employee.id}`, data)
        : apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: employee ? "Yangilandi" : "Qo'shildi", description: `Xodim muvaffaqiyatli ${employee ? "yangilandi" : "qo'shildi"}` });
      onClose();
    },
    onError: async (err: any) => {
      const msg = err?.message || "Xato yuz berdi";
      toast({ title: "Xato", description: msg, variant: "destructive" });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <FormField control={form.control} name="employeeNo" render={({ field }) => (
          <FormItem>
            <FormLabel>Employee ID *</FormLabel>
            <FormControl>
              <Input data-testid="input-employee-no" placeholder="1001" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Ism Familiya *</FormLabel>
            <FormControl>
              <Input data-testid="input-name" placeholder="Alisher Karimov" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="position" render={({ field }) => (
          <FormItem>
            <FormLabel>Lavozim</FormLabel>
            <FormControl>
              <Input data-testid="input-position" placeholder="Dasturchi" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Telefon</FormLabel>
            <FormControl>
              <Input data-testid="input-phone" placeholder="+998 90 123 45 67" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={mutation.isPending} className="flex-1" data-testid="button-save-employee">
            {mutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {employee ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Bekor</Button>
        </div>
      </form>
    </Form>
  );
}

function EmployeeCard({ employee, onEdit }: { employee: Employee; onEdit: () => void }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/employees/${employee.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "O'chirildi", description: `${employee.name} o'chirildi` });
    },
  });

  return (
    <div data-testid={`employee-card-${employee.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-card-border bg-card hover:bg-accent/10 transition-colors">
      <EmployeeAvatar name={employee.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{employee.name}</span>
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">#{employee.employeeNo}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {employee.position && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Briefcase className="w-3 h-3" />{employee.position}
            </span>
          )}
          {employee.phone && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" />{employee.phone}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-${employee.id}`} className="h-8 w-8 p-0">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
          data-testid={`button-delete-${employee.id}`} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SetupGuide() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Hikvision DS-K1T343EFWX — HTTP Sozlamalari</h3>
        </div>
        <ol className="space-y-4">
          {[
            { step: 1, title: "Qurilma veb-sahifasiga kiring", desc: "http://192.168.1.65 (qurilmaning IP manzili)" },
            { step: 2, title: "System → Network → Network Service", desc: "HTTP(S) tabini oching" },
            { step: 3, title: "HTTP Listening sozlang", fields: [["Event Alarm IP", "89.167.32.140"], ["URL", "/api/events"], ["Port", "4637"], ["Protocol", "HTTP"]] },
            { step: 4, title: "Save tugmasini bosing", desc: "Endi eshikdan o'tilganda bu sahifada ko'rinadi" },
          ].map(item => (
            <li key={item.step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{item.step}</div>
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                {item.desc && <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>}
                {item.fields && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {item.fields.map(([k, v]) => (
                          <tr key={k} className="border-b border-border last:border-0">
                            <td className="px-3 py-1.5 text-muted-foreground">{k}</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-primary">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400 flex gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Muhim</p>
          <p>Qurilmadagi xodim Employee ID lari bilan bu saytdagi xodim ID lari bir xil bo'lishi kerak. Aks holda "Noma'lum xodim" ko'rinadi.</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const { dark, toggle: toggleTheme } = useTheme();
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: events = [], isLoading: eventsLoading } = useQuery<HikvisionEvent[]>({ queryKey: ["/api/events"] });
  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/events"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events"] }); toast({ title: "Tozalandi" }); },
  });

  const testMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/events/test"),
    onSuccess: () => toast({ title: "Test hodisa yuborildi!" }),
  });

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus("connected");
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "new_event" && data.event) {
          queryClient.setQueryData<HikvisionEvent[]>(["/api/events"], (old = []) => [data.event, ...old].slice(0, 500));
          setNewEventIds(prev => { const n = new Set(prev); n.add(data.event.id); return n; });
          setTimeout(() => setNewEventIds(prev => { const n = new Set(prev); n.delete(data.event.id); return n; }), 6000);
          const name = data.event.resolvedName || data.event.name || data.event.employeeNo || "Noma'lum";
          const status = data.event.attendanceStatus?.toLowerCase() === "checkin" ? "kirdi" : data.event.attendanceStatus?.toLowerCase() === "checkout" ? "chiqdi" : "hodisa";
          toast({ title: `${name} ${status}!`, description: formatTime(data.event.receivedAt) });
        } else if (data.type === "cleared") {
          queryClient.setQueryData(["/api/events"], []);
        } else if (data.type === "employee_added" || data.type === "employee_updated" || data.type === "employee_deleted") {
          queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        }
      } catch {}
    };
    ws.onclose = () => { setWsStatus("disconnected"); reconnectRef.current = setTimeout(connectWs, 3000); };
    ws.onerror = () => ws.close();
  }, [toast]);

  useEffect(() => { connectWs(); return () => { wsRef.current?.close(); if (reconnectRef.current) clearTimeout(reconnectRef.current); }; }, [connectWs]);

  const todayEvents = events.filter(e => new Date(e.receivedAt).toDateString() === new Date().toDateString());
  const checkIns = events.filter(e => e.attendanceStatus?.toLowerCase() === "checkin").length;
  const checkOuts = events.filter(e => e.attendanceStatus?.toLowerCase() === "checkout").length;

  return (
    <div className="min-h-screen bg-background transition-colors">
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Radio className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none">Hikvision Event Listener</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">DS-K1T343EFWX</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div data-testid="ws-status" className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
              wsStatus === "connected" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : wsStatus === "connecting" ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
              : "bg-red-500/10 border-red-500/30 text-red-500"}`}>
              {wsStatus === "connected" ? <><Wifi className="w-3 h-3" /> Ulangan</>
               : wsStatus === "connecting" ? <><RefreshCw className="w-3 h-3 animate-spin" /> Ulanmoqda</>
               : <><WifiOff className="w-3 h-3" /> Uzilgan</>}
            </div>
            <Button variant="ghost" size="sm" onClick={toggleTheme} data-testid="button-theme" className="h-8 w-8 p-0">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Jami hodisalar", value: events.length, icon: <Radio className="w-4 h-4" />, color: "text-primary" },
            { label: "Bugun", value: todayEvents.length, icon: <Clock className="w-4 h-4" />, color: "text-blue-500" },
            { label: "Kirishlar", value: checkIns, icon: <DoorOpen className="w-4 h-4" />, color: "text-emerald-500" },
            { label: "Chiqishlar", value: checkOuts, icon: <UserCheck className="w-4 h-4" />, color: "text-orange-500" },
          ].map(stat => (
            <Card key={stat.label} className="border-card-border bg-card">
              <CardContent className="p-4">
                <div className={`${stat.color} mb-1.5`}>{stat.icon}</div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="events">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <TabsList data-testid="tabs-list">
              <TabsTrigger value="events" data-testid="tab-events">
                Hodisalar {events.length > 0 && <span className="ml-1 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{events.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="employees" data-testid="tab-employees">
                Xodimlar {employees.length > 0 && <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{employees.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="setup" data-testid="tab-setup">Sozlash</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-test-event" className="text-xs h-8">
                <FlaskConical className="w-3.5 h-3.5 mr-1.5" />Test
              </Button>
              <Button variant="outline" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending || events.length === 0} data-testid="button-clear" className="text-xs h-8 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Tozalash
              </Button>
            </div>
          </div>

          <TabsContent value="events">
            {eventsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-card border border-card-border animate-pulse" />)}</div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Radio className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">Hodisalar yo'q</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">Hikvision qurilmasidan hodisalar kutilmoqda</p>
                <Button size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-test-empty">
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />Test event yuborish
                </Button>
              </div>
            ) : (
              <div className="space-y-2" data-testid="events-list">
                {events.map(event => (
                  <EventCard key={event.id} event={event} isNew={newEventIds.has(event.id)} employees={employees} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="employees">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{employees.length} ta xodim ro'yxatda</p>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-employee" className="h-8 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Xodim qo'shish
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Yangi xodim qo'shish</DialogTitle>
                  </DialogHeader>
                  <EmployeeForm onClose={() => setAddOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>

            {employeesLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-card border border-card-border animate-pulse" />)}</div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Xodimlar yo'q</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                  Qurilmadagi xodim Employee ID lari bilan xodimlarni qo'shing. Shunda "Noma'lum" o'rniga ism ko'rinadi.
                </p>
                <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-first-employee" className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Birinchi xodimni qo'shish
                </Button>
              </div>
            ) : (
              <div className="space-y-2" data-testid="employees-list">
                {employees.map(emp => (
                  <EmployeeCard key={emp.id} employee={emp} onEdit={() => setEditingEmployee(emp)} />
                ))}
              </div>
            )}

            <Dialog open={!!editingEmployee} onOpenChange={open => { if (!open) setEditingEmployee(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Xodimni tahrirlash</DialogTitle>
                </DialogHeader>
                {editingEmployee && <EmployeeForm employee={editingEmployee} onClose={() => setEditingEmployee(null)} />}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="setup">
            <SetupGuide />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
