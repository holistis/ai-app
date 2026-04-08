import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { requireAuth } from "@clerk/express";
import cors from "cors";

// Dit berekent het pad naar de map waar dit bestand staat
// __dirname = server/_core/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dit is het pad naar de 'dist' map die Vite aanmaakt
// server/_core/ → twee mapjes omhoog → dan 'dist'
// Dus: project-root/dist
const DIST_PATH = path.resolve(__dirname, "../../dist");

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ✅ 1. Trust proxy – Railway vereist dit anders werken redirects niet
  app.set("trust proxy", 1);

  // ✅ 2. CORS – browsers mogen requests sturen van andere domeinen
  app.use(cors({ origin: true, credentials: true }));

  // ✅ 3. Body parsers – zodat Express JSON begrijpt
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ✅ 4. STATISCHE BESTANDEN – dit is de grote fix
  // Express stuurt nu direct de echte .js/.css bestanden terug
  // De bewaker (Clerk) staat hier nog NIET – geen blokkade mogelijk
  app.use(express.static(DIST_PATH));

  // ✅ 5. Clerk webhook – Clerk belt zelf aan, heeft geen login nodig
  app.post("/api/clerk-webhook", (req, res) => {
    // Vervang dit met jouw echte webhook logica als je die hebt
    res.sendStatus(200);
  });

  // ✅ 6. tRPC API – ALLEEN hier staat de bewaker (requireAuth)
  // Alleen jouw data-endpoints zijn beveiligd, niet de plaatjes/scripts
  app.use(
    "/api/trpc",
    requireAuth(),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ✅ 7. SPA Catch-all – als niets hierboven matcht, stuur index.html
  // Maar ALLEEN voor echte pagina-requests (GET, geen bestanden)
  // Dit laat React Router het overnemen in de browser
  app.get("*", (req, res, next) => {
    // Als de URL een bestandsextensie heeft (.js, .png, .svg etc.)
    // dan is er iets mis – stuur een 404, niet index.html
    if (path.extname(req.path)) {
      return res.status(404).send("Bestand niet gevonden");
    }
    // Anders: stuur de React app, React Router regelt de rest
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  // ✅ 8. Server opstarten
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`✅ Server draait op poort ${PORT}`);
  });
}

startServer().catch(console.error);
