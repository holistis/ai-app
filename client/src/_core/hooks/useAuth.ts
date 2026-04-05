import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useCallback } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/sign-in" } = options ?? {};
  const { isLoaded, userId, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const logout = useCallback(async () => {
    window.location.href = "/sign-in";
  }, []);

  return {
    user: isSignedIn ? {
      id: userId,
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
