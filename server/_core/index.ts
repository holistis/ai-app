import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// Clerk auth handled in context.ts
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { reports } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure CORS for iFrame embedding
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('X-Frame-Options', 'ALLOWALL');
    res.header('Access-Control-Max-Age', '3600');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // PDF Download endpoint - Express GET route (not tRPC)
  app.get("/api/pdf/:reportId", async (req, res) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      if (isNaN(reportId)) {
        console.log(`[PDF-Download] Invalid reportId: ${req.params.reportId}`);
        return res.status(400).json({ error: "Invalid report ID" });
      }

      // Authenticate user via Clerk
      const clerkUserId = (req as any).auth?.userId;
      if (!clerkUserId) {
        console.log(`[PDF-Download] No Clerk user ID`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await db.getUserByClerkId(clerkUserId);
      if (!user) {
        console.log(`[PDF-Download] User not found in database for Clerk ID: ${clerkUserId}`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Fetch report from database
      const dbInstance = await getDb();
      if (!dbInstance) {
        console.error(`[PDF-Download] Database not available`);
        return res.status(500).json({ error: "Database unavailable" });
      }

      const whereConditions = [eq(reports.id, reportId)];
      if (user.role !== "admin") {
        whereConditions.push(eq(reports.userId, user.id));
      }

      const reportData = await dbInstance
        .select()
        .from(reports)
        .where(and(...whereConditions))
        .limit(1);

      if (!reportData.length) {
        console.log(`[PDF-Download] Report ${reportId} not found for user ${user.id}`);
        return res.status(404).json({ error: "Report not found" });
      }

      const report = reportData[0];

      // Case 1: pdfUrl is base64 encoded
      if (report.pdfUrl && report.pdfUrl.startsWith("data:application/pdf;base64,")) {
        console.log(`[PDF-Download] Report ${reportId} - Decoding base64 PDF`);
        try {
          const base64Data = report.pdfUrl.replace("data:application/pdf;base64,", "");
          const pdfBuffer = Buffer.from(base64Data, 'base64');
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="rapport-${reportId}.pdf"`);
          console.log(`[PDF-Download] Sending base64 PDF (${pdfBuffer.length} bytes)`);
          return res.send(pdfBuffer);
        } catch (error) {
          console.error(`[PDF-Download] Base64 decode failed:`, error);
          return res.status(500).json({ error: "Failed to decode PDF" });
        }
      }

      // Case 2: pdfUrl is HTTP URL (redirect to S3/CDN)
      if (report.pdfUrl && report.pdfUrl.startsWith("http")) {
        console.log(`[PDF-Download] Report ${reportId} - Redirecting to HTTP URL`);
        return res.redirect(report.pdfUrl);
      }

      // Case 3: No pdfUrl - generate on the fly
      if (!report.pdfUrl) {
        console.log(`[PDF-Download] Report ${reportId} - Generating PDF on the fly`);
        try {
          const { buildReportHTML, generatePDFBuffer } = await import("../_core/pdfGenerator");
          const html = buildReportHTML({
            title: report.title || "Rapport",
            content: report.content || "",
            summary: report.summary || "",
            keyInsights: report.keyInsights ? (typeof report.keyInsights === 'string' ? JSON.parse(report.keyInsights) : report.keyInsights) : [],
            recommendations: report.recommendations ? (typeof report.recommendations === 'string' ? JSON.parse(report.recommendations) : report.recommendations) : [],
            protocols: report.protocols ? (typeof report.protocols === 'string' ? JSON.parse(report.protocols) : report.protocols) : {},
            scientificReferences: report.scientificReferences ? (typeof report.scientificReferences === 'string' ? JSON.parse(report.scientificReferences) : report.scientificReferences) : [],
          });
          const pdfBuffer = await generatePDFBuffer(html);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="rapport-${reportId}.pdf"`);
          console.log(`[PDF-Download] Sending generated PDF (${pdfBuffer.length} bytes)`);
          return res.send(pdfBuffer);
        } catch (error) {
          console.error(`[PDF-Download] PDF generation failed:`, error);
          return res.status(500).json({ error: "Failed to generate PDF" });
        }
      }
    } catch (error) {
      console.error("[PDF-Download] Unexpected error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
