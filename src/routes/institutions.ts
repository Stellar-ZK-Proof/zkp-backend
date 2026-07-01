import { Router, Request, Response, NextFunction } from "express";
import { invokeContract } from "../lib/stellar";
import { Address } from "@stellar/stellar-sdk";

const router = Router();

/**
 * POST /api/institutions/whitelist
 * Body: { address } — admin only (verified via ADMIN_SECRET header)
 */
router.post(
  "/whitelist",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminSecret = req.headers["x-admin-secret"];
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: "Missing address" });

      const xdr = await import("@stellar/stellar-sdk");
      await invokeContract("whitelist_institution", [
        new Address(address).toScVal(),
      ]);
      res.json({ whitelisted: address });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
