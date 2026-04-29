import { Link, Route, Switch } from "wouter";
import { useAuth } from "./auth-provider";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { 
  PackageSearch, 
  Settings, 
  Users, 
  LogOut, 
  Sun, 
  Moon, 
  Wifi,
  Menu
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { isConnected } = useWebSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        window.location.href = "/login";
      }
    });
  };

  const NavLinks = () => (
    <>
      <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
        <PackageSearch className="h-4 w-4" />
        Catalog
      </Link>
      {isAdmin && (
        <>
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Admin
          </div>
          <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
            <Users className="h-4 w-4" />
            Users
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary text-sm font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm sticky top-0 h-screen">
        <div className="h-14 flex items-center px-4 border-b border-border gap-2">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <PackageSearch className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight">Shop Catalog</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-border space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-destructive animate-pulse"}`} />
              {isConnected ? "Live" : "Reconnecting"}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <span className="font-medium text-xs">{user?.username?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <PackageSearch className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight">Shop Catalog</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="h-14 flex items-center px-4 border-b border-border gap-2">
                <span className="font-bold tracking-tight">Menu</span>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <NavLinks />
              </nav>
              <div className="p-4 border-t border-border">
                <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
