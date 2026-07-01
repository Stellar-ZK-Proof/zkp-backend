import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { logger } from "./lib/logger";
import paymentRoutes from "./routes/payments";
import proofRoutes from "./routes/proofs";
import institutionRoutes from "./routes/institutions";
import healthRoutes from "./routes/health";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/proofs", proofRoutes);
app.use("/api/institutions", institutionRoutes);

// ── Error handler ───────────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ error: err.message });
  }
);

app.listen(PORT, () => {
  logger.info(`ZKP Private Pay API running on port ${PORT}`);
});

export default app;
