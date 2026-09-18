import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Application chrome.
 *
 * Auto-layout notes (Apple HIG equivalent):
 * - Desktop (regular width): a translucent macOS source list sidebar sized by
 *   content constraints (w-[268px] vs w-[76px]), the main panel flex-1 taking
 *   every remaining pixel — no fixed pixel widths on content.
 * - Compact (phone): the sidebar moves into a drawer and navigation becomes the
 *   bottom tab bar, which respects the home-indicator safe area.
 * - Safe areas: the top bar sits under the status bar/notch via `.safe-top`,
 *   and the tab bar pads with `env(safe-area-inset-bottom)`.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapse = useCallback(() => setCollapsed((value) => !value), []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full w-full overflow-hidden bg-background">
        {/* macOS-style translucent source list — regular widths only */}
        <aside
          className={cn(
            "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-300 ease-out md:block",
            collapsed ? "w-[76px]" : "w-[268px]",
          )}
        >
          <AppSidebar
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        </aside>

        {/* Compact-width drawer (full navigation) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[300px] max-w-[85vw] border-sidebar-border p-0">
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

          {/* Bottom padding clears the floating iOS tab bar on phones. */}
          <main className="talent-scroll flex-1 overflow-y-auto px-4 py-5 pb-32 md:px-6 md:py-6 md:pb-8">
            <div className="mx-auto w-full max-w-[1600px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        <MobileTabBar />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </MotionConfig>
  );
}
