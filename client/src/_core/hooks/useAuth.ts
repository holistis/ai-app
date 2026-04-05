import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useCallback } from "react";

export function useAuth(options?: { redirectOnUnauthenticated?: boolean; redirectPath?: string }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const logout = useCallback(async () => {
    window.location.href = "/sign-in";
  }, []);

  return {
    user: isSignedIn ? {
      id: clerkUser?.id ?? "",
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? "",
      name: clerkUser?.fullName ?? "",
      role: "user",
    } : null,
    loading: !isLoaded,
    error: null,
    isAuthenticated: Boolean(isSignedIn),
    refresh: () => {},
    logout,
  };
}
