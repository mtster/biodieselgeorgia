import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

import vehicleRoutes from "./server/routes/vehicles";
import userRoutes from "./server/routes/users";
import excelRoutes from "./server/routes/excel";
import cronRoutes from "./server/routes/cron";
import reportRoutes from "./server/routes/reports";
import logisticsRoutes from "./server/routes/logistics";
import { startPlannedOrdersScheduler } from "./server/services/plannedOrdersService";

dotenv.config();

const port = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Enable CORS for all origins, allowing access from mobile devices and other computers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Mount API routers
  app.use(vehicleRoutes);
  app.use(userRoutes);
  app.use(excelRoutes);
  app.use(cronRoutes);
  app.use(reportRoutes);
  app.use(logisticsRoutes);

  // Serve static assets and frontend index
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${port}`);
    startPlannedOrdersScheduler();
  });
}

startServer();
