// Clerk auth middleware
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // ✅ Gebruik correct Clerk method
      const session = await app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = await clerkClient.verifyToken(token);
      (req as any).auth = { userId: decoded.sub };
    }
  } catch (error) {
    console.log("[Auth error]", error);
  }
  next();
});(token);

      // ✅ Wijs alleen session.userId toe
      (req as any).auth = { userId: session.userId };
    }
  } catch (error) {
    console.log("[Auth error]", error);
    (req as any).auth = { userId: null }; // fallback
  }
  next();
});
