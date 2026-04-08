import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { requireAuth } from "@clerk/express";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ✅ STAP 1: Vertel Express dat hij achter een proxy zit (Railway vereist dit)
  // Zonder dit werkt Clerk's redirect-detectie niet goed en krijg je loops
  app.set("trust proxy", 1);

  // ✅ STAP 2: CORS headers – dit moet altijd als allereerste
  // Dit vertelt browsers: "ja, je mag van andere domeinen requests sturen"
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // ✅ STAP 3: Body parsers – zodat Express JSON begrijpt in requests
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ✅ STAP 4: STATISCHE BESTANDEN EERST – VÓÓRdat er ook maar iets van
  // beveiliging aankomt. Vite's .js/.css/afbeeldingen zijn PUBLIEK.
  // De bewaker staat hier nog NIET. Iedereen mag zijn jas ophalen.
  serveStatic(app);
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  }

  // ✅ STAP 5: Clerk webhook route – GEEN auth nodig (Clerk belt zelf aan)
  // Dit is een speciale deur voor Clerk zelf, die staat ook buiten de bewaker
  app.post("/api/clerk-webhook", (req, res) => {
    // Jouw webhook handler logica hier (of importeer hem)
    // Als je al een aparte webhook handler hebt, vervang deze regel
    res.sendStatus(200);
  });

  // ✅ STAP 6: ALLEEN de tRPC API beveiligen met requireAuth()
  // De bewaker staat NU – maar alleen voor de kluis (/api/trpc)
  // Alle frontend routes (/, /sign-in, /dashboard etc.) worden
  // afgehandeld door React Router in de browser, NIET hier
  app.use(
    "/api/trpc",
    requireAuth(),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ✅ STAP 7: Server opstarten op de juiste poort
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`✅ Server draait op poort ${PORT}`);
  });
}

startServer().catch(console.error);
