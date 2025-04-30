import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startKitchenTimers } from "./timers";
import { startEtaWorker } from "./etaWorker";
import { addUpdateKitchenMetricsJob } from "./queue";
import { updateKitchenMetrics } from "./metrics";

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // Start the kitchen timer background tasks
    startKitchenTimers();
    
    // Start the ETA calculation worker
    if (process.env.DISABLE_ETA_WORKER !== 'true') {
      log("Starting ETA calculation worker...");
      const etaWorker = startEtaWorker();
      
      // Initialize kitchen metrics
      updateKitchenMetrics().then(() => {
        log("Initial kitchen metrics calculation complete");
      }).catch(err => {
        log(`Error during initial kitchen metrics calculation: ${err}`);
      });
      
      // Schedule regular kitchen metrics updates (every 30 seconds)
      const metricsInterval = setInterval(async () => {
        try {
          await addUpdateKitchenMetricsJob();
        } catch (err) {
          log(`Error scheduling kitchen metrics update: ${err}`);
        }
      }, 30000);
      
      // Handle graceful shutdown
      const shutdown = async () => {
        log('Shutting down ETA worker and metrics job...');
        clearInterval(metricsInterval);
        
        try {
          // Import closeQueues to shut down Redis connections
          const { closeQueues } = await import('./queue');
          await closeQueues();
          log('Queue connections closed successfully');
        } catch (err) {
          log(`Error closing queue connections: ${err}`);
        }
        
        process.exit(0);
      };
      
      // Register shutdown handlers
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } else {
      log("ETA calculation worker disabled by environment variable");
    }
  });
})();
