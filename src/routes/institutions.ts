import { Router, Request, Response, NextFunction } from "express";
import { Address } from "@stellar/stellar-sdk";
import { invokeContract } from "../lib/stellar";

const router = Router();

/**
 * POST /api/institutions/whitelist  (admin only)
 */
router.post("/whitelist", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "Missing address" });
    await invokeContract("whitelist_institution", [new Address(address).toScVal()]);
    res.json({ whitelisted: address, network: process.env.STELLAR_NETWORK || "testnet" });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/institutions/whitelist (admin only)
 */
router.delete("/whitelist", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "Missing address" });
    await invokeContract("delist_institution", [new Address(address).toScVal()]);
    res.json({ delisted: address });
  } catch (err) {
    next(err);
  }
});

export default router;
