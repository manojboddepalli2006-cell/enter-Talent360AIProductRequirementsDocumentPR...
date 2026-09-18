import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Application chrome: a permanently dark sidebar beside a light canvas, with the
 * sidebar collapsing to an icon rail on desktop and to a drawer below `md`.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleCollapse = useCallback(() => setCollapsed((value) => !value), []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:block",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Talent360 AI navigation</SheetTitle>
          <AppSidebar
            collapsed={false}
            onToggleCollapse={() => setMobileOpen(false)}
            onOpenPalette={() => {
              setMobileOpen(false);
              setPaletteOpen(true);
            }}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="talent-scroll flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
