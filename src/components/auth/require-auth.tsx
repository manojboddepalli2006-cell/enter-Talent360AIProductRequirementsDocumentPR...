import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function FullScreenLoader({ label = "Preparing your workspace" }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-[13px] font-semibold">{label}…</span>
    </div>
  );
}

/** Gate for authenticated areas. RLS remains the real authorization boundary. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useSession();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
