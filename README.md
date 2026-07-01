# zkp-backend

> Node.js/Express API for ZKP Private Pay — Groth16 proof generation & Stellar Soroban settlement

[![CI](https://github.com/Stellar-ZK-Proof/zkp-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-ZK-Proof/zkp-backend/actions/workflows/ci.yml)

## Stack
- Node.js 20 + Express + TypeScript
- **snarkjs** Groth16 proof generation (real circuit committed in `circuits/`)
- `@stellar/stellar-sdk` v16 — Soroban RPC client
- Winston logger

## Live Contract (Testnet)

**Contract ID:** `CBV43YWUD4ZJL5WITK7VTU5F6Z25QDQVXDIABQV65JQQNIMNBC6EMIUP`  
[View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBV43YWUD4ZJL5WITK7VTU5F6Z25QDQVXDIABQV65JQQNIMNBC6EMIUP)

## API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/payments/submit` | Generate proof + submit + settle on Soroban |
| `GET`  | `/api/payments/:txId` | Query on-chain transaction record |
| `POST` | `/api/proofs/generate` | Generate proof bundle (no on-chain) |
| `POST` | `/api/proofs/verify` | Verify proof off-chain |
| `POST` | `/api/institutions/whitelist` | Whitelist institution (admin) |
| `GET`  | `/api/health` | Health + circuit + RPC status |

## Quickstart

```bash
cp .env.example .env
# Fill in: STELLAR_SECRET_KEY, CONTRACT_ID
npm install
npm run dev   # → http://localhost:4000
```

## Example

```bash
# Submit a private payment
curl -X POST http://localhost:4000/api/payments/submit \
  -H "Content-Type: application/json" \
  -d '{
    "senderAddress": "GA2LCOB7...",
    "amount": "1000000000",
    "recipient": "INSTITUTION_BIC_OR_ADDRESS",
    "auditRef": "SWIFT-20260701-001"
  }'
```

## ZK Circuit Status

| File | Status |
|---|---|
| `circuits/payment_commitment.circom` | ✅ Source |
| `circuits/payment_commitment.wasm` | ✅ Compiled |
| `circuits/payment_commitment_final.zkey` | ✅ Trusted setup done |
| `circuits/verification_key.json` | ✅ Exported |

Without circuit files the backend runs in **dev mode** (mock proofs).

## Related repos
- [zkp-frontend](https://github.com/Stellar-ZK-Proof/zkp-frontend)
- [zkp-contract](https://github.com/Stellar-ZK-Proof/zkp-contract)
