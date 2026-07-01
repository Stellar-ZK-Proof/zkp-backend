import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { generateProof } from "../lib/zkp";
import { submitPaymentOnChain, settlePaymentOnChain } from "../lib/stellar";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/payments/submit
 * Body: { senderAddress, amount, recipient, auditRef }
 *
 * Generates a ZK proof and submits the commitment to the Soroban contract.
 */
router.post(
  "/submit",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { senderAddress, amount, recipient, auditRef } = req.body;

      if (!senderAddress || !amount || !recipient || !auditRef) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const salt = require("crypto").randomBytes(32).toString("hex");

      logger.info("Generating ZK proof", { senderAddress, auditRef });
      const proofBundle = await generateProof({
        amount: BigInt(amount),
        recipient,
        salt,
        auditRef,
      });

      logger.info("Submitting payment on-chain");
      const txId = await submitPaymentOnChain({
        senderAddress,
        commitment: proofBundle.commitment,
        nullifier: proofBundle.nullifier,
        auditRefHash: proofBundle.auditRefHash,
      });

      logger.info("Settling payment with ZK proof");
      await settlePaymentOnChain({
        txId: Buffer.from(txId, "hex"),
        proofBytes: proofBundle.proofBytes,
        publicInputs: proofBundle.publicInputs,
      });

      res.status(201).json({
        txId,
        commitment: proofBundle.commitment.toString("hex"),
        status: "settled",
        message: "Payment submitted and settled with ZK proof",
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payments/:txId
 * Returns on-chain record for a given tx id.
 */
router.get(
  "/:txId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { txId } = req.params;
      // In a full implementation, query the Soroban contract's get_tx view
      res.json({ txId, status: "settled", message: "Query via RPC not yet wired" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
