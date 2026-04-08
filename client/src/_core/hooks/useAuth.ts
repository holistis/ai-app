import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useCallback } from "react";

export function useAuth(options?: { redirectOnUnauthenticated?: boolean; redirectPath?: string }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const logout = useCallback(async () => {
    window.location.href = "/sign-in";
  }, []);

  // ✅ Rol komt nu uit Clerk publicMetadata
  const role = (clerkUser?.publicMetadata?.role as string) ?? "user";

  return {
    user: isSignedIn ? {
      id: clerkUser?.id ?? "",
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? "",
      name: clerkUser?.fullName ?? "",
      role: role,
    } : null,
    loading: !isLoaded,
    error: null,
    isAuthenticated: Boolean(isSignedIn),
    refresh: () => {},
    logout,
  };
}
