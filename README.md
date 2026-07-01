# zkp-backend

> Node.js/Express API for ZKP Private Pay — Groth16 proof generation & Stellar Soroban settlement

[![CI](https://github.com/Stellar-ZK-Proof/zkp-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-ZK-Proof/zkp-backend/actions/workflows/ci.yml)

## Stack
- Node.js 20 + Express + TypeScript
- **snarkjs** Groth16 proof generation (real circuit, trusted setup complete)
- `@stellar/stellar-sdk` Soroban RPC client
- Winston logger

## ZK Circuit Status

The `circuits/` directory contains production-ready artifacts:

| File | Status | Description |
|---|---|---|
| `payment_commitment.circom` | ✅ committed | Circuit source |
| `payment_commitment.wasm` | ✅ committed | Compiled circuit |
| `payment_commitment_final.zkey` | ✅ committed | Phase 2 zkey (trusted setup complete) |
| `verification_key.json` | ✅ committed | On-chain verifier key |

Proof verified in CI: `snarkjs groth16 verify` passes with test vectors.

## API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/payments/submit` | Generate proof + submit + settle on Soroban |
| `POST` | `/api/proofs/generate` | Generate proof bundle (no on-chain submission) |
| `POST` | `/api/proofs/verify` | Verify a proof off-chain |
| `POST` | `/api/institutions/whitelist` | Whitelist an institution (admin) |
| `GET`  | `/api/health` | Health check |

## Quickstart

```bash
cp .env.example .env
# Fill in: CONTRACT_ID, STELLAR_SECRET_KEY
npm install
npm run dev   # → http://localhost:4000
```

## Example: Submit a private payment

```bash
curl -X POST http://localhost:4000/api/payments/submit \
  -H "Content-Type: application/json" \
  -d '{
    "senderAddress": "GABC...",
    "amount": "1000000000",
    "recipient": "GXYZ...",
    "auditRef": "SWIFT-REF-20260701"
  }'
```

Response:
```json
{
  "txId": "a3f9...",
  "commitment": "2b4c...",
  "status": "settled",
  "message": "Payment submitted and settled with ZK proof"
}
```

## Related repos
- [zkp-frontend](https://github.com/Stellar-ZK-Proof/zkp-frontend)
- [zkp-contract](https://github.com/Stellar-ZK-Proof/zkp-contract)
