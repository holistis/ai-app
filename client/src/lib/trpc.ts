import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

// 👇 Voeg dit toe waar je TRPC provider initieert
export const trpcClient = trpc.createClient({
  url: "/api/trpc",
  async headers() {
    let token = "";
    try {
      token = await window.Clerk?.session?.getToken();
    } catch (e) {
      console.warn("Clerk token ophalen mislukt:", e);
    }
    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  },
});
