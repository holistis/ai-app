// FILE: server/_core/index.ts
// FIX: /api/pdf/:id genereert de PDF live als die nog niet in de DB staat

import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { clerkMiddleware } from "@clerk/express";
import { getDb } from "../db";
import { reports } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildReportHTML, generatePDFBuffer } from "./pdfGenerator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.resolve(__dirname, "../dist/public");

// Helper: parse JSON array veilig
function safeParseArray(field: any): any[] {
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try { return JSON.parse(field); } catch { return []; }
  }
  return [];
}

// Helper: parse protocols object veilig
function safeParseProtocols(field: any): Record<string, string[]> {
  if (field && typeof field === "object" && !Array.isArray(field)) return field;
  if (typeof field === "string" && field.length > 2) {
    try {
      const p = JSON.parse(field);
      return (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
    } catch { return {}; }
  }
  return {};
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(clerkMiddleware());

  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(express.static(DIST_PATH));

  app.post("/api/clerk-webhook", (req, res) => {
    res.sendStatus(200);
  });

  // ─── PDF DOWNLOAD ROUTE ───────────────────────────────────────────────────
  // FIX: als pdfUrl leeg is (PDF nog niet klaar), genereer hem live en sla op
  app.get("/api/pdf/:id", async (req, res) => {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).send("Ongeldig rapport ID");
    }

    try {
      const db = await getDb();
      if (!db) return res.status(500).send("Database niet beschikbaar");

      // Haal rapport op
      const rows = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      if (!rows.length) {
        return res.status(404).send("Rapport niet gevonden");
      }

      const report = rows[0];

      // ── GEVAL 1: PDF staat al in de database ──
      if (report.pdfUrl && typeof report.pdfUrl === "string" && report.pdfUrl.startsWith("data:application/pdf")) {
        console.log(`[PDF] Serving cached PDF for report ${reportId}`);
        const base64Data = report.pdfUrl.replace("data:application/pdf;base64,", "");
        const pdfBuffer = Buffer.from(base64Data, "base64");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="rapport-${reportId}.pdf"`);
        return res.send(pdfBuffer);
      }

      // ── GEVAL 2: PDF nog niet klaar — genereer live ──
      console.log(`[PDF] No cached PDF found for report ${reportId}, generating live...`);

      const conditionLabels: Record<string, string> = {
        chronic_fatigue: "Chronische Vermoeidheid",
        digestive_issues: "Spijsverteringsproblemen",
        solk: "SOLK (Somatisch Onverklaarbare Lichamelijke Klachten)",
        auto_immuun: "Auto-Immuun Gerelateerde Klachten",
        alk: "ALK (Aspecifieke Lichamelijke Klachten)",
      };

      const conditionType = (report as any).conditionType || "";
      const conditionName = conditionLabels[conditionType] || conditionType;

      const reportData = {
        title: (report as any).title || `Holistische Gezondheidsanalyse - ${conditionName}`,
        content: typeof report.content === "string" ? report.content : "",
        summary: typeof report.summary === "string" ? report.summary : "",
        keyInsights: safeParseArray(report.keyInsights),
        recommendations: safeParseArray(report.recommendations),
        protocols: safeParseProtocols(report.protocols),
        scientificReferences: safeParseArray(report.scientificReferences),
        reportType: (report as any).reportType || "inzicht_rapport",
        conditionType,
        patientName: (report as any).patientName || "Patiënt",
      };

      const html = buildReportHTML(reportData);
      const pdfBuffer = await generatePDFBuffer(html);

      // Sla ook op in DB zodat volgende keer direct beschikbaar
      try {
        const base64 = pdfBuffer.toString("base64");
        const pdfDataUrl = `data:application/pdf;base64,${base64}`;
        await db
          .update(reports)
          .set({ pdfUrl: pdfDataUrl, updatedAt: new Date() } as any)
          .where(eq(reports.id, reportId));
        console.log(`[PDF] Cached live-generated PDF for report ${reportId}`);
      } catch (cacheErr) {
        // Niet fataal — PDF wordt alsnog teruggestuurd
        console.warn(`[PDF] Could not cache PDF for report ${reportId}:`, cacheErr);
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="rapport-${reportId}.pdf"`);
      return res.send(pdfBuffer);

    } catch (err) {
      console.error("[PDF] Fout bij ophalen of genereren PDF:", err);
      return res.status(500).send("Fout bij genereren PDF. Probeer het opnieuw.");
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.get("*", (req, res) => {
    if (path.extname(req.path)) {
      return res.status(404).send("Bestand niet gevonden");
    }
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`✅ Server draait op poort ${PORT}`);
  });
}

startServer().catch(console.error);
