import { Link, useNavigate } from "react-router-dom";
import { Compass, Home, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/states";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="This page does not exist"
          description="The route you followed is not part of Talent360 AI. Use the workspace navigation, or head back to your landing surface."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={() => navigate("/app")}>
                <Home className="h-3.5 w-3.5" />
                Go to my workspace
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/login">
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
