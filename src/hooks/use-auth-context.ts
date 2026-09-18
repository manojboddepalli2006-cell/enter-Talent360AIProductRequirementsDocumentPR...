import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/components/auth/auth-context";

/** Reads the auth context. Throws when used outside the provider. */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Auth context is missing. Wrap the app in AuthProvider.");
  return context;
}
