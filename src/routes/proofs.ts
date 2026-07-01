import { Router, Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { generateProof, verifyProof, CIRCUIT_READY } from "../lib/zkp";

const router = Router();

/**
 * POST /api/proofs/generate
 * Body: { amount, recipient, auditRef }
 * Generate a proof bundle without submitting on-chain (preview/testing).
 */
router.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, recipient, auditRef } = req.body;
    if (!amount || !recipient || !auditRef) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const salt = crypto.randomBytes(32).toString("hex");
    const recipientHex = Buffer.from(recipient, "utf8").toString("hex").padEnd(64, "0").slice(0, 64);

    const bundle = await generateProof({
      amount: BigInt(amount),
      recipient: recipientHex,
      salt,
      auditRef,
    });

    res.json({
      commitment:   bundle.commitment.toString("hex"),
      nullifier:    bundle.nullifier.toString("hex"),
      auditRefHash: bundle.auditRefHash.toString("hex"),
      proofBytes:   bundle.proofBytes.toString("hex"),
      publicInputs: bundle.publicInputs.map((pi) => pi.toString("hex")),
      salt,
      mode: CIRCUIT_READY ? "real_groth16" : "dev_mock",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/proofs/verify
 * Body: { proofBytes (hex), publicInputs (hex[]) }
 */
router.post("/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proofBytes, publicInputs } = req.body;
    if (!proofBytes || !Array.isArray(publicInputs)) {
      return res.status(400).json({ error: "Missing proofBytes or publicInputs" });
    }
    const valid = await verifyProof(
      Buffer.from(proofBytes, "hex"),
      publicInputs.map((pi: string) => Buffer.from(pi, "hex"))
    );
    res.json({ valid, mode: CIRCUIT_READY ? "real_groth16" : "dev_mock" });
  } catch (err) {
    next(err);
  }
});

export default router;
