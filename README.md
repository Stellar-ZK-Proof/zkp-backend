# zkp-backend

> Node.js/Express API for ZKP Private Pay — ZK proof generation & Stellar Soroban settlement

## Stack
- Node.js 20 + Express + TypeScript
- snarkjs (Groth16 proof generation)
- @stellar/stellar-sdk (Soroban RPC)
- Winston logger

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
cp .env.example .env   # fill in CONTRACT_ID + STELLAR_SECRET_KEY
npm install
npm run dev            # → http://localhost:4000
```

## Dev mode
Without circuit files in `circuits/`, the backend runs with **mock proofs** — suitable for UI development without a trusted setup.

## Related repos
- [zkp-frontend](https://github.com/Stellar-ZK-Proof/zkp-frontend)
- [zkp-contract](https://github.com/Stellar-ZK-Proof/zkp-contract)
