/**
 * ZKP helpers — Groth16 proof generation via snarkjs.
 *
 * Circuit: payment_commitment.circom
 * Private inputs : amount, recipient_hash, salt
 * Public  inputs : commitment, nullifier, audit_ref_hash
 */

import * as snarkjs from "snarkjs";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

const CIRCUIT_DIR = path.join(__dirname, "../../circuits");
const WASM_PATH   = path.join(CIRCUIT_DIR, "payment_commitment.wasm");
const ZKEY_PATH   = path.join(CIRCUIT_DIR, "payment_commitment_final.zkey");
const VK_PATH     = path.join(CIRCUIT_DIR, "verification_key.json");

export const CIRCUIT_READY = fs.existsSync(WASM_PATH) && fs.existsSync(ZKEY_PATH);

if (!CIRCUIT_READY) {
  console.warn("[ZKP] Circuit files not found — running in DEV MODE (mock proofs)");
}

export interface PaymentInputs {
  amount: bigint;
  recipient: string;   // hex
  salt: string;        // 32-byte hex
  auditRef: string;
}

export interface ZkProofBundle {
  proofBytes:   Buffer;
  publicInputs: Buffer[];
  commitment:   Buffer;
  nullifier:    Buffer;
  auditRefHash: Buffer;
  salt:         string;
}

// ── Deterministic derivations ────────────────────────────────────────────────

export function deriveCommitment(inputs: PaymentInputs): Buffer {
  return crypto
    .createHash("sha256")
    .update(`${inputs.amount}:${inputs.recipient}:${inputs.salt}`)
    .digest();
}

export function deriveNullifier(inputs: PaymentInputs): Buffer {
  return crypto
    .createHash("sha256")
    .update(`nullifier:${inputs.salt}:${inputs.recipient}`)
    .digest();
}

export function hashAuditRef(auditRef: string): Buffer {
  return crypto.createHash("sha256").update(auditRef).digest();
}

// ── Proof generation ─────────────────────────────────────────────────────────

export async function generateProof(inputs: PaymentInputs): Promise<ZkProofBundle> {
  const commitment   = deriveCommitment(inputs);
  const nullifier    = deriveNullifier(inputs);
  const auditRefHash = hashAuditRef(inputs.auditRef);

  if (!CIRCUIT_READY) {
    // Dev mode — deterministic mock proof
    const mockProof = crypto
      .createHash("sha256")
      .update(Buffer.concat([commitment, nullifier]))
      .digest();
    return {
      proofBytes:   Buffer.concat([mockProof, mockProof, mockProof, mockProof]),
      publicInputs: [commitment, nullifier, auditRefHash],
      commitment, nullifier, auditRefHash,
      salt: inputs.salt,
    };
  }

  // Production — real Groth16 proof
  const circuitInputs = {
    amount:        inputs.amount.toString(),
    recipient_hash: BigInt("0x" + inputs.recipient.slice(0, 62)).toString(),
    salt:          BigInt("0x" + inputs.salt.slice(0, 62)).toString(),
    commitment:    BigInt("0x" + commitment.toString("hex")).toString(),
    nullifier:     BigInt("0x" + nullifier.toString("hex")).toString(),
    audit_ref_hash: BigInt("0x" + auditRefHash.toString("hex")).toString(),
  };

  const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
    circuitInputs, WASM_PATH, ZKEY_PATH
  );

  return {
    proofBytes:   Buffer.from(JSON.stringify(proof)),
    publicInputs: (publicSignals as string[]).map((s) =>
      Buffer.from(BigInt(s).toString(16).padStart(64, "0"), "hex")
    ),
    commitment, nullifier, auditRefHash,
    salt: inputs.salt,
  };
}

// ── Proof verification ────────────────────────────────────────────────────────

export async function verifyProof(
  proofBytes: Buffer,
  publicInputs: Buffer[]
): Promise<boolean> {
  if (!CIRCUIT_READY) {
    return proofBytes.length >= 64; // mock always passes
  }
  const vKey = JSON.parse(fs.readFileSync(VK_PATH, "utf8"));
  const proof = JSON.parse(proofBytes.toString());
  const signals = publicInputs.map((pi) =>
    BigInt("0x" + pi.toString("hex")).toString()
  );
  return (snarkjs as any).groth16.verify(vKey, signals, proof);
}
