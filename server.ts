import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initDb } from "./src/server/db/setup.js";
import authRouter from "./src/server/routes/auth.js";
import clientRouter from "./src/server/routes/clients.js";
import invoiceRouter from "./src/server/routes/invoices.js";
import dashboardRouter from "./src/server/routes/dashboard.js";
import analyticsRouter from "./src/server/routes/analytics.js";
import settingsRouter from "./src/server/routes/settings.js";
import aiRouter from "./src/server/routes/ai.js";
import trashRouter from "./src/server/routes/trash.js";
import { ReminderProcessor } from "./src/server/services/reminder.service.js";
import { InvoiceService } from "./src/server/services/invoice.service.js";
import { ClientService } from "./src/server/services/client.service.js";

async function startServer() {
  // Initialize Database
  initDb();

  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // Security & Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(process.env.COOKIE_SECRET || 'payrecover-cookie-secret-123'));
  
  app.use(cors({
    origin: true,
    credentials: true,
  }));

  // Request Logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/clients", clientRouter);
  app.use("/api/invoices", invoiceRouter);
  app.use("/api/stats", dashboardRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/trash", trashRouter);
  app.use("/api/ai", aiRouter);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Background Jobs
  setInterval(async () => {
    try {
      await InvoiceService.updateOverdueInvoices();
      await ReminderProcessor.processReminders();
      await ClientService.updateRiskScores();
    } catch (err) {
      console.error("Background job error:", err);
    }
  }, 1000 * 60 * 60);

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
