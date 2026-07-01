import { Router, Request, Response, NextFunction } from "express";
import { generateProof, verifyProof } from "../lib/zkp";

const router = Router();

/**
 * POST /api/proofs/generate
 * Body: { amount, recipient, auditRef }
 * Returns proof bundle without submitting on-chain (for UI preview / testing).
 */
router.post(
  "/generate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, recipient, auditRef } = req.body;
      if (!amount || !recipient || !auditRef) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const salt = require("crypto").randomBytes(32).toString("hex");
      const bundle = await generateProof({
        amount: BigInt(amount),
        recipient,
        salt,
        auditRef,
      });
      res.json({
        commitment: bundle.commitment.toString("hex"),
        nullifier: bundle.nullifier.toString("hex"),
        auditRefHash: bundle.auditRefHash.toString("hex"),
        proofBytes: bundle.proofBytes.toString("hex"),
        publicInputs: bundle.publicInputs.map((pi) => pi.toString("hex")),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/proofs/verify
 * Body: { proofBytes (hex), publicInputs (hex[]) }
 */
router.post(
  "/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proofBytes, publicInputs } = req.body;
      if (!proofBytes || !publicInputs) {
        return res.status(400).json({ error: "Missing proof data" });
      }
      const valid = await verifyProof(
        Buffer.from(proofBytes, "hex"),
        (publicInputs as string[]).map((pi) => Buffer.from(pi, "hex"))
      );
      res.json({ valid });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
