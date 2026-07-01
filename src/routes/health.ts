import { Router } from "express";
import { server } from "../lib/stellar";
import { CIRCUIT_READY } from "../lib/zkp";

const router = Router();

router.get("/", async (_req, res) => {
  let rpcStatus = "unknown";
  try {
    const health = await server.getHealth();
    rpcStatus = health.status;
  } catch {
    rpcStatus = "unreachable";
  }

  res.json({
    status: "ok",
    service: "zkp-private-pay-api",
    ts: Date.now(),
    contract_id: process.env.CONTRACT_ID || "not_set",
    network: process.env.STELLAR_NETWORK || "testnet",
    rpc: rpcStatus,
    circuit: CIRCUIT_READY ? "real_groth16" : "dev_mock",
  });
});

export default router;
