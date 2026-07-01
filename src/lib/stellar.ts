import {
  Contract,
  Keypair,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  scValToNative,
} from "@stellar/stellar-sdk";
import { logger } from "./logger";

const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;
const CONTRACT_ID = process.env.CONTRACT_ID || "";

export const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

export const getKeypair = (): Keypair => {
  const secret = process.env.STELLAR_SECRET_KEY;
  if (!secret) throw new Error("STELLAR_SECRET_KEY not set");
  return Keypair.fromSecret(secret);
};

/** Build, simulate, sign and submit a Soroban contract call */
export async function invokeContract(
  method: string,
  args: xdr.ScVal[]
): Promise<xdr.ScVal | null> {
  if (!CONTRACT_ID) throw new Error("CONTRACT_ID not set in environment");
  const kp = getKeypair();
  const account = await server.getAccount(kp.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(CONTRACT_ID).call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Simulation failed: ${(sim as any).error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);

  logger.info(`Submitting ${method}`);
  const send = await server.sendTransaction(prepared);
  if (send.status === "ERROR") {
    throw new Error(`Submit error: ${JSON.stringify(send.errorResult)}`);
  }

  // Poll for result
  let resp = await server.getTransaction(send.hash);
  let attempts = 0;
  while (
    resp.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
    attempts < 30
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    resp = await server.getTransaction(send.hash);
    attempts++;
  }

  if (resp.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction failed on-chain: ${send.hash}`);
  }

  if (resp.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    const successResp = resp as SorobanRpc.Api.GetSuccessfulTransactionResponse;
    return successResp.returnValue ?? null;
  }

  throw new Error(`Transaction timeout: ${send.hash}`);
}

/** Convert Buffer to ScVal bytes */
const buf32 = (buf: Buffer): xdr.ScVal => xdr.ScVal.scvBytes(buf);

/** Submit payment commitment to the contract */
export async function submitPaymentOnChain(p: {
  senderAddress: string;
  commitment: Buffer;
  nullifier: Buffer;
  auditRefHash: Buffer;
}): Promise<string> {
  const result = await invokeContract("submit_payment", [
    new Address(p.senderAddress).toScVal(),
    buf32(p.commitment),
    buf32(p.nullifier),
    buf32(p.auditRefHash),
  ]);
  if (!result) throw new Error("submit_payment returned null");
  return Buffer.from(scValToNative(result) as Uint8Array).toString("hex");
}

/** Settle a payment with a ZK proof */
export async function settlePaymentOnChain(p: {
  txId: Buffer;
  proofBytes: Buffer;
  publicInputs: Buffer[];
}): Promise<void> {
  const piVec = xdr.ScVal.scvVec(p.publicInputs.map(buf32));
  const proofMap = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("proof_bytes"),
      val: xdr.ScVal.scvBytes(p.proofBytes),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("public_inputs"),
      val: piVec,
    }),
  ]);
  await invokeContract("settle_payment", [buf32(p.txId), proofMap]);
}

/** Query a transaction record */
export async function getTxOnChain(
  txId: Buffer
): Promise<Record<string, unknown> | null> {
  try {
    const result = await invokeContract("get_tx", [buf32(txId)]);
    if (!result) return null;
    return scValToNative(result) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Check if nullifier is spent */
export async function isNullifierSpent(nullifier: Buffer): Promise<boolean> {
  try {
    const result = await invokeContract("is_nullifier_spent", [buf32(nullifier)]);
    if (!result) return false;
    return scValToNative(result) as boolean;
  } catch {
    return false;
  }
}
