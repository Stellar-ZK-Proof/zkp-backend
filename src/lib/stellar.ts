import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
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

export const server = new SorobanRpc.Server(RPC_URL);

export const getSourceKeypair = (): Keypair => {
  const secret = process.env.STELLAR_SECRET_KEY;
  if (!secret) throw new Error("STELLAR_SECRET_KEY not set");
  return Keypair.fromSecret(secret);
};

/** Generic Soroban contract invocation helper */
export async function invokeContract(
  method: string,
  args: xdr.ScVal[]
): Promise<unknown> {
  const keypair = getSourceKeypair();
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(keypair);

  logger.info(`Invoking contract method: ${method}`);
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === "ERROR") {
    throw new Error(`Contract invocation failed: ${JSON.stringify(sendResponse.errorResult)}`);
  }

  // Poll for result
  let getResponse = await server.getTransaction(sendResponse.hash);
  while (getResponse.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    getResponse = await server.getTransaction(sendResponse.hash);
  }

  if (getResponse.status === "FAILED") {
    throw new Error("Transaction failed on-chain");
  }

  const result = (getResponse as SorobanRpc.Api.GetSuccessfulTransactionResponse).returnValue;
  return result ? scValToNative(result) : null;
}

/** Submit a ZKP payment commitment to the contract */
export async function submitPaymentOnChain(params: {
  senderAddress: string;
  commitment: Buffer;
  nullifier: Buffer;
  auditRefHash: Buffer;
}): Promise<string> {
  const { senderAddress, commitment, nullifier, auditRefHash } = params;

  const args = [
    new Address(senderAddress).toScVal(),
    xdr.ScVal.scvBytes(commitment),
    xdr.ScVal.scvBytes(nullifier),
    xdr.ScVal.scvBytes(auditRefHash),
  ];

  const txId = await invokeContract("submit_payment", args);
  return Buffer.from(txId as Uint8Array).toString("hex");
}

/** Settle a payment with a ZK proof */
export async function settlePaymentOnChain(params: {
  txId: Buffer;
  proofBytes: Buffer;
  publicInputs: Buffer[];
}): Promise<void> {
  const { txId, proofBytes, publicInputs } = params;

  const piVals = publicInputs.map((pi) => xdr.ScVal.scvBytes(pi));

  const proofStruct = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: nativeToScVal("proof_bytes"),
      val: xdr.ScVal.scvBytes(proofBytes),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal("public_inputs"),
      val: xdr.ScVal.scvVec(piVals),
    }),
  ]);

  await invokeContract("settle_payment", [
    xdr.ScVal.scvBytes(txId),
    proofStruct,
  ]);
}
