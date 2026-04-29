import { useState, useRef, useEffect } from "react";
import { useChangePassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  Download,
  Upload,
  Send,
  Bot,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export default function AdminSettings() {
  // --- Change password ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // --- Telegram settings ---
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaved, setTgSaved] = useState(false);

  // --- Backup operations ---
  const [importing, setImporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [importResult, setImportResult] = useState<{
    catalogsRestored: number;
    productsRestored: number;
  } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const changePassword = useChangePassword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Parol o'zgartirildi" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (err: any) => {
        toast({
          title: "Xato",
          description: err.error || "Xato yuz berdi",
          variant: "destructive",
        });
      },
    },
  });

  // Load TG settings on mount
  useEffect(() => {
    apiFetch("/api/backup/settings")
      .then((data) => {
        setTgBotToken(data.tgBotToken || "");
        setTgChatId(data.tgChatId || "");
      })
      .catch(() => {});
  }, []);

  const handleSaveTg = async () => {
    setTgSaving(true);
    setTgSaved(false);
    try {
      await apiFetch("/api/backup/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgBotToken: tgBotToken.trim(), tgChatId: tgChatId.trim() }),
      });
      setTgSaved(true);
      toast({ title: "Telegram sozlamalari saqlandi" });
      setTimeout(() => setTgSaved(false), 3000);
    } catch (err: any) {
      toast({ title: "Xato", description: err.message, variant: "destructive" });
    } finally {
      setTgSaving(false);
    }
  };

  const handleExport = async () => {
    const res = await fetch("/api/backup/export", { credentials: "include" });
    if (!res.ok) {
      toast({ title: "Eksport xatosi", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup yuklab olindi" });
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await apiFetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      setImportResult(result);
      toast({
        title: "Import muvaffaqiyatli",
        description: `${result.catalogsRestored} katalog, ${result.productsRestored} mahsulot tiklandi`,
      });
    } catch (err: any) {
      toast({
        title: "Import xatosi",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleSendTelegram = async () => {
    setSending(true);
    try {
      const result = await apiFetch("/api/backup/send-telegram", { method: "POST" });
      toast({ title: "Telegram", description: result.message || "Yuborildi" });
    } catch (err: any) {
      toast({
        title: "Telegram xatosi",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Parollar mos emas", variant: "destructive" });
      return;
    }
    changePassword.mutate({ data: { currentPassword, newPassword } });
  };

  const tgConfigured = tgBotToken.trim() && tgChatId.trim();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sozlamalar</h1>
        <p className="text-muted-foreground mt-1">
          Admin panel sozlamalari va backup boshqaruvi
        </p>
      </div>

      {/* ── Telegram Settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-400" />
            Telegram Bot Sozlamalari
          </CardTitle>
          <CardDescription>
            Backup faylini Telegramga yuborish uchun bot tokenini va chat ID ni kiriting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tg-token">Bot Token</Label>
            <Input
              id="tg-token"
              type="password"
              placeholder="123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={tgBotToken}
              onChange={(e) => setTgBotToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              @BotFather dan olingan bot token
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tg-chat">Chat ID (User ID)</Label>
            <Input
              id="tg-chat"
              placeholder="123456789"
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Backup qabul qiluvchi foydalanuvchining Telegram ID si.{" "}
              <span className="font-mono text-primary/70">@userinfobot</span>{" "}
              orqali ID ni bilib oling
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSaveTg}
            disabled={tgSaving || !tgBotToken.trim() || !tgChatId.trim()}
            className="gap-2"
          >
            {tgSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : tgSaved ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : null}
            {tgSaved ? "Saqlandi" : "Saqlash"}
          </Button>
        </CardFooter>
      </Card>

      {/* ── Backup & Restore ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            Backup va Tiklash
          </CardTitle>
          <CardDescription>
            Barcha katalog va mahsulotlarni eksport/import qiling yoki Telegramga yuboring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary/40 border border-border/50">
            <div className="min-w-0">
              <p className="font-medium text-sm">Eksport (Yuklab olish)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Barcha ma'lumotlarni JSON formatida yuklab oling
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              Yuklab olish
            </Button>
          </div>

          {/* Import */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-secondary/40 border border-border/50">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">Import (Tiklash)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JSON backup faylidan ma'lumotlarni tiklang.{" "}
                <span className="text-destructive font-medium">
                  Mavjud ma'lumotlar o'chiriladi!
                </span>
              </p>
              {importResult && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    {importResult.catalogsRestored} katalog tiklandi
                  </Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    {importResult.productsRestored} mahsulot tiklandi
                  </Badge>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              disabled={importing}
              onClick={() => importRef.current?.click()}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importing ? "Tiklanmoqda..." : "Faylni tanlang"}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Send to Telegram */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary/40 border border-border/50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Telegramga yuborish</p>
                {tgConfigured ? (
                  <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                    <CheckCircle className="h-2.5 w-2.5 text-green-400" />
                    Sozlangan
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Sozlanmagan
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tgConfigured
                  ? `Backup faylini Telegram ID: ${tgChatId} ga yuborish`
                  : "Avval yuqorida Telegram sozlamalarini kiriting"}
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700"
              disabled={sending || !tgConfigured}
              onClick={handleSendTelegram}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Yuborilmoqda..." : "Yuborish"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Change Password ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Parolni o'zgartirish
          </CardTitle>
          <CardDescription>
            Hisobingizni himoya qilish uchun parolni yangilang
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Joriy parol</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new">Yangi parol</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Yangi parolni tasdiqlang</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                changePassword.isPending
              }
            >
              {changePassword.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saqlanmoqda...
                </>
              ) : (
                "Parolni o'zgartirish"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
