import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { HikvisionEvent } from "@shared/schema";
import {
  Wifi,
  WifiOff,
  DoorOpen,
  User,
  Clock,
  Trash2,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  Fingerprint,
  CreditCard,
  Monitor,
  Radio,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  Settings,
} from "lucide-react";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getAttendanceBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "checkin":
      return { label: "Kirish", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    case "checkout":
      return { label: "Chiqish", color: "bg-orange-500/15 text-orange-500 border-orange-500/30" };
    case "breakin":
      return { label: "Tanaffus kirish", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" };
    case "breakout":
      return { label: "Tanaffus chiqish", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" };
    default:
      return { label: status || "Noma'lum", color: "bg-muted text-muted-foreground border-border" };
  }
}

function getVerifyModeIcon(mode: string) {
  if (mode?.toLowerCase().includes("face")) return <Fingerprint className="w-3 h-3" />;
  if (mode?.toLowerCase().includes("card")) return <CreditCard className="w-3 h-3" />;
  return <User className="w-3 h-3" />;
}

function EventCard({ event, isNew }: { event: HikvisionEvent; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const attendance = getAttendanceBadge(event.attendanceStatus || "");

  return (
    <div
      data-testid={`event-card-${event.id}`}
      className={`border border-card-border rounded-lg bg-card overflow-hidden transition-all duration-300 ${
        isNew ? "ring-2 ring-primary/40 shadow-lg shadow-primary/10" : ""
      }`}
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`event-toggle-${event.id}`}
      >
        <div className="mt-0.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${
            event.attendanceStatus?.toLowerCase() === "checkin"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : event.attendanceStatus?.toLowerCase() === "checkout"
              ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
              : "bg-primary/10 border-primary/30 text-primary"
          }`}>
            <DoorOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span data-testid={`event-name-${event.id}`} className="font-semibold text-sm text-foreground">
              {event.name || "Noma'lum shaxs"}
            </span>
            {isNew && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse">
                YANGI
              </span>
            )}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${attendance.color}`}>
              {attendance.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {event.employeeNo && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                #{event.employeeNo}
              </span>
            )}
            {event.cardNo && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                {event.cardNo}
              </span>
            )}
            {event.verifyMode && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {getVerifyModeIcon(event.verifyMode)}
                {event.verifyMode}
              </span>
            )}
            {event.doorNo && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DoorOpen className="w-3 h-3" />
                Eshik #{event.doorNo}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(event.receivedAt)}
            </span>
            {event.ipAddress && (
              <span className="text-xs text-muted-foreground font-mono">{event.ipAddress}</span>
            )}
          </div>
        </div>

        <div className="text-muted-foreground mt-1">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-card-border bg-muted/30">
          <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              ["IP Manzil", event.ipAddress],
              ["MAC Manzil", event.macAddress],
              ["Qurilma nomi", event.deviceName],
              ["Hodisa turi", event.eventType],
              ["Hodisa holati", event.eventState],
              ["Tavsif", event.eventDescription],
              ["Sana/Vaqt", event.dateTime],
              ["Karta turi", event.cardType],
              ["Foydalanuvchi turi", event.userType],
              ["Major turi", event.majorEventType],
              ["Sub turi", event.subEventType],
              ["Tekshiruv usuli", event.verifyMode],
              ["Content-Type", event.contentType],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</span>
                <span className="text-foreground font-mono break-all">{value as string}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-card-border px-4 pb-4 pt-3">
            <button
              className="text-xs text-primary flex items-center gap-1 hover:underline mb-2"
              onClick={() => setShowRaw(!showRaw)}
              data-testid={`raw-toggle-${event.id}`}
            >
              {showRaw ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Raw body ({event.rawBody.length} bytes)
            </button>
            {showRaw && (
              <pre className="bg-background border border-border rounded-md p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                {event.rawBody}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SetupGuide() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-card-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Hikvision DS-K1T343EFWX - HTTP Sozlamalari</h3>
            <p className="text-xs text-muted-foreground">Qurilmada qanday sozlash kerak</p>
          </div>
        </div>

        <ol className="space-y-4">
          {[
            {
              step: 1,
              title: "Qurilma veb-sahifasiga kiring",
              desc: "Brauzer orqali qurilmaning IP manziliga o'ting (masalan: http://192.168.1.65)",
              note: "Default login: admin / 12345",
            },
            {
              step: 2,
              title: "System and Maintenance → Network → Network Service",
              desc: "Chap menyu: System Configuration → Network → Network Service bo'limiga o'ting",
            },
            {
              step: 3,
              title: "HTTP Listening sozlamalari",
              desc: "HTTP(S) tabini ochib, quyidagi ma'lumotlarni kiriting:",
              fields: [
                ["Event Alarm IP/Domain Name", window.location.hostname || "your-server-ip"],
                ["URL", "/api/events"],
                ["Port", "5000"],
                ["Protocol", "HTTP"],
              ],
            },
            {
              step: 4,
              title: "Save tugmasini bosing",
              desc: "Sozlamalarni saqlang. Endi qurilma har bir eshikdan o'tish hodisasini serverga yuboradi.",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                {item.step}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                {item.note && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    {item.note}
                  </div>
                )}
                {item.fields && (
                  <div className="mt-2 rounded-md border border-border bg-background overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {item.fields.map(([k, v]) => (
                          <tr key={k} className="border-b border-border last:border-0">
                            <td className="px-3 py-1.5 text-muted-foreground w-1/2">{k}</td>
                            <td className="px-3 py-1.5 font-mono font-semibold text-primary">{v}</td>
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

      <div className="rounded-lg border border-card-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Server ma'lumotlari</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            ["Endpoint URL", `http://${window.location.hostname}:5000/api/events`],
            ["Metod", "POST"],
            ["Port", "5000"],
            ["Format qo'llab-quvvatlash", "XML va JSON"],
          ].map(([k, v]) => (
            <div key={k} className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">{k}</div>
              <div className="font-mono font-semibold text-foreground break-all">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-amber-600 dark:text-amber-400">
            <p className="font-semibold mb-1">Muhim eslatma</p>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Server va qurilma bir xil tarmoqda bo'lishi yoki server public IP orqali kirish mumkin bo'lishi kerak</li>
              <li>Firewall da 5000-port ochiq bo'lishi kerak</li>
              <li>Test uchun yuqoridagi "Test Event Yuborish" tugmasidan foydalaning</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: events = [], isLoading } = useQuery<HikvisionEvent[]>({
    queryKey: ["/api/events"],
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/events"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Tozalandi", description: "Barcha hodisalar o'chirildi" });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/events/test"),
    onSuccess: () => {
      toast({ title: "Test hodisa yuborildi!", description: "Sahifada yangi event ko'rinishi kerak" });
    },
  });

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "new_event" && data.event) {
          queryClient.setQueryData<HikvisionEvent[]>(["/api/events"], (old = []) => {
            return [data.event, ...old].slice(0, 200);
          });
          setNewEventIds((prev) => {
            const next = new Set(prev);
            next.add(data.event.id);
            return next;
          });
          setTimeout(() => {
            setNewEventIds((prev) => {
              const next = new Set(prev);
              next.delete(data.event.id);
              return next;
            });
          }, 5000);
          toast({
            title: "Yangi hodisa!",
            description: `${data.event.name || "Noma'lum"} — ${data.event.attendanceStatus || "hodisa"}`,
          });
        } else if (data.type === "cleared") {
          queryClient.setQueryData(["/api/events"], []);
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      reconnectRef.current = setTimeout(connectWs, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [toast]);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWs]);

  const totalToday = events.filter((e) => {
    const d = new Date(e.receivedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const checkIns = events.filter((e) => e.attendanceStatus?.toLowerCase() === "checkin").length;
  const checkOuts = events.filter((e) => e.attendanceStatus?.toLowerCase() === "checkout").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Radio className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none">Hikvision Event Listener</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">DS-K1T343EFWX — Yuz Tanish Terminali</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              data-testid="ws-status"
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                wsStatus === "connected"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : wsStatus === "connecting"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-red-500/10 border-red-500/30 text-red-500"
              }`}
            >
              {wsStatus === "connected" ? (
                <><Wifi className="w-3 h-3" /> Ulangan</>
              ) : wsStatus === "connecting" ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> Ulanmoqda</>
              ) : (
                <><WifiOff className="w-3 h-3" /> Uzilgan</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Jami hodisalar", value: events.length, icon: <Radio className="w-4 h-4" />, color: "text-primary" },
            { label: "Bugun", value: totalToday, icon: <Clock className="w-4 h-4" />, color: "text-blue-500" },
            { label: "Kirishlar", value: checkIns, icon: <DoorOpen className="w-4 h-4" />, color: "text-emerald-500" },
            { label: "Chiqishlar", value: checkOuts, icon: <User className="w-4 h-4" />, color: "text-orange-500" },
          ].map((stat) => (
            <Card key={stat.label} className="border-card-border bg-card">
              <CardContent className="p-4">
                <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="events">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <TabsList data-testid="tabs-list">
              <TabsTrigger value="events" data-testid="tab-events">
                Hodisalar {events.length > 0 && <span className="ml-1.5 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{events.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="setup" data-testid="tab-setup">Sozlash yo'riqnomasi</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                data-testid="button-test-event"
                className="text-xs"
              >
                <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                Test event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending || events.length === 0}
                data-testid="button-clear"
                className="text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Tozalash
              </Button>
            </div>
          </div>

          <TabsContent value="events">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-card border border-card-border animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Radio className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Hodisalar yo'q</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Hikvision qurilmangizdan hodisalar kutilmoqda. "Test event" yuborish uchun tugmani bosing.
                </p>
                <Button
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  data-testid="button-test-empty"
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                  Test event yuborish
                </Button>
              </div>
            ) : (
              <div className="space-y-2" data-testid="events-list">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isNew={newEventIds.has(event.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="setup">
            <SetupGuide />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
