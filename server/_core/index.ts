// Clerk auth middleware
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // ✅ Gebruik correct Clerk method
      const session = await clerkClient.sessions.verifySessionToken(token);

      // ✅ Wijs alleen session.userId toe
      (req as any).auth = { userId: session.userId };
    }
  } catch (error) {
    console.log("[Auth error]", error);
    (req as any).auth = { userId: null }; // fallback
  }
  next();
});
