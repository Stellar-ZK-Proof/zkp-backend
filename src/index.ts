import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { logger } from "./lib/logger";
import paymentRoutes     from "./routes/payments";
import proofRoutes       from "./routes/proofs";
import institutionRoutes from "./routes/institutions";
import healthRoutes      from "./routes/health";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "2mb" }));

// Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use("/api/health",       healthRoutes);
app.use("/api/payments",     paymentRoutes);
app.use("/api/proofs",       proofRoutes);
app.use("/api/institutions", institutionRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`ZKP Private Pay API on :${PORT}`);
  logger.info(`Contract: ${process.env.CONTRACT_ID || "NOT SET"}`);
  logger.info(`Network:  ${process.env.STELLAR_NETWORK || "testnet"}`);
  logger.info(`Circuit:  ${require("fs").existsSync(require("path").join(__dirname, "../circuits/payment_commitment.wasm")) ? "real" : "dev mock"}`);
});

export default app;
