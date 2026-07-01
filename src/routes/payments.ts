import { Router, Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { generateProof, verifyProof, CIRCUIT_READY } from "../lib/zkp";
import {
  submitPaymentOnChain,
  settlePaymentOnChain,
  getTxOnChain,
  isNullifierSpent,
} from "../lib/stellar";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/payments/submit
 * Body: { senderAddress, amount, recipient, auditRef }
 *
 * Full flow: generate ZK proof → submit commitment on-chain → settle with proof.
 */
router.post("/submit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { senderAddress, amount, recipient, auditRef } = req.body;
    if (!senderAddress || !amount || !recipient || !auditRef) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const salt = crypto.randomBytes(32).toString("hex");
    const recipientHex = Buffer.from(recipient, "utf8").toString("hex").padEnd(64, "0").slice(0, 64);

    logger.info("Generating ZK proof", { senderAddress, auditRef, mode: CIRCUIT_READY ? "real" : "dev" });
    const bundle = await generateProof({
      amount: BigInt(amount),
      recipient: recipientHex,
      salt,
      auditRef,
    });

    logger.info("Submitting payment commitment on-chain");
    const txId = await submitPaymentOnChain({
      senderAddress,
      commitment:   bundle.commitment,
      nullifier:    bundle.nullifier,
      auditRefHash: bundle.auditRefHash,
    });

    logger.info("Settling with ZK proof", { txId });
    await settlePaymentOnChain({
      txId:         Buffer.from(txId, "hex"),
      proofBytes:   bundle.proofBytes,
      publicInputs: bundle.publicInputs,
    });

    res.status(201).json({
      txId,
      commitment:   bundle.commitment.toString("hex"),
      nullifier:    bundle.nullifier.toString("hex"),
      auditRefHash: bundle.auditRefHash.toString("hex"),
      status:       "settled",
      mode:         CIRCUIT_READY ? "real_proof" : "dev_mock",
      explorerUrl:  `https://stellar.expert/explorer/testnet/tx/${txId}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/:txId
 * Query the on-chain record for a transaction.
 */
router.get("/:txId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { txId } = req.params;
    if (!/^[0-9a-f]{64}$/i.test(txId)) {
      return res.status(400).json({ error: "Invalid txId format (expected 64 hex chars)" });
    }
    const record = await getTxOnChain(Buffer.from(txId, "hex"));
    if (!record) return res.status(404).json({ error: "Transaction not found" });
    res.json({ txId, ...record });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/nullifier/:nullifier
 * Check if a nullifier has been spent (replay protection check).
 */
router.get("/nullifier/:nullifier", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nullifier } = req.params;
    const spent = await isNullifierSpent(Buffer.from(nullifier, "hex"));
    res.json({ nullifier, spent });
  } catch (err) {
    next(err);
  }
});

export default router;
