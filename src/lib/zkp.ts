/**
 * ZKP helpers — wraps snarkjs Groth16 proof generation.
 *
 * Circuit: payment_commitment.circom
 * Private inputs : amount, recipient (address bytes), salt
 * Public  inputs : commitment (Pedersen hash), nullifier, audit_ref_hash
 *
 * In dev/test mode (no zkey present) we return mock proofs for local runs.
 */

import * as snarkjs from "snarkjs";
import * as crypto from "crypto";
import path from "path";
import fs from "fs";

const CIRCUIT_DIR = path.join(__dirname, "../../circuits");
const WASM_PATH = path.join(CIRCUIT_DIR, "payment_commitment.wasm");
const ZKEY_PATH = path.join(CIRCUIT_DIR, "payment_commitment_final.zkey");

const DEV_MODE = !fs.existsSync(WASM_PATH);

export interface PaymentInputs {
  amount: bigint;        // e.g. in stroops (1 XLM = 10_000_000)
  recipient: string;     // hex-encoded address bytes
  salt: string;          // random 32-byte hex
  auditRef: string;      // SWIFT ref or internal ID, hashed before use
}

export interface ZkProofBundle {
  proofBytes: Buffer;           // compressed proof
  publicInputs: Buffer[];       // [commitment, nullifier, auditRefHash]
  commitment: Buffer;
  nullifier: Buffer;
  auditRefHash: Buffer;
}

/** Derive a 32-byte commitment hash from payment inputs (Pedersen substitute). */
export function deriveCommitment(inputs: PaymentInputs): Buffer {
  const preimage = `${inputs.amount}:${inputs.recipient}:${inputs.salt}`;
  return crypto.createHash("sha256").update(preimage).digest();
}

/** Derive nullifier from salt + recipient (one-time spend token). */
export function deriveNullifier(inputs: PaymentInputs): Buffer {
  const preimage = `nullifier:${inputs.salt}:${inputs.recipient}`;
  return crypto.createHash("sha256").update(preimage).digest();
}

/** Hash the audit reference string. */
export function hashAuditRef(auditRef: string): Buffer {
  return crypto.createHash("sha256").update(auditRef).digest();
}

/** Generate a full ZK proof bundle for a payment. */
export async function generateProof(
  inputs: PaymentInputs
): Promise<ZkProofBundle> {
  const commitment = deriveCommitment(inputs);
  const nullifier = deriveNullifier(inputs);
  const auditRefHash = hashAuditRef(inputs.auditRef);

  if (DEV_MODE) {
    // Development mock — returns deterministic bytes, no real proof
    console.warn("[ZKP] DEV MODE: returning mock proof (no circuit files found)");
    const mockProof = crypto
      .createHash("sha256")
      .update(commitment)
      .update(nullifier)
      .digest();
    return {
      proofBytes: Buffer.concat([mockProof, mockProof, mockProof, mockProof]),
      publicInputs: [commitment, nullifier, auditRefHash],
      commitment,
      nullifier,
      auditRefHash,
    };
  }

  // Production — full snarkjs Groth16 proof
  const circuitInputs = {
    amount: inputs.amount.toString(),
    recipient: BigInt("0x" + inputs.recipient).toString(),
    salt: BigInt("0x" + inputs.salt).toString(),
    auditRef: BigInt("0x" + Buffer.from(inputs.auditRef).toString("hex")).toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs,
    WASM_PATH,
    ZKEY_PATH
  );

  // Compress proof to bytes
  const proofBytes = Buffer.from(JSON.stringify(proof));

  return {
    proofBytes,
    publicInputs: (publicSignals as string[]).map((s) =>
      Buffer.from(BigInt(s).toString(16).padStart(64, "0"), "hex")
    ),
    commitment,
    nullifier,
    auditRefHash,
  };
}

/** Verify a proof off-chain (for API pre-flight checks). */
export async function verifyProof(
  proofBytes: Buffer,
  publicInputs: Buffer[]
): Promise<boolean> {
  if (DEV_MODE) {
    // Always passes in dev
    return proofBytes.length >= 64;
  }

  const vKeyPath = path.join(CIRCUIT_DIR, "verification_key.json");
  if (!fs.existsSync(vKeyPath)) throw new Error("Verification key not found");

  const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf8"));
  const proof = JSON.parse(proofBytes.toString());
  const signals = publicInputs.map((pi) =>
    BigInt("0x" + pi.toString("hex")).toString()
  );

  return snarkjs.groth16.verify(vKey, signals, proof);
}
