"use client";
/**
 * Send a write through the injected wallet and follow it to a decision.
 * Phases: "signing" -> "submitted" -> "validators" (consensus running) -> "done" | "failed".
 */
import { getReadClient, getWalletClient, plain } from "./genlayer";
import { friendly } from "./errors";
import { transactionsStatusNumberToName } from "genlayer-js/types";
import { encodeAbiParameters } from "viem";

const EXT_GAS_LIMIT = 500_000n;   // Studio's default external gas limit

/** Fees whose message allocation funds one external value message to `payee`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function payoutFees(wallet: any, payee: string) {
  const price = 360_000_000n;
  const feeParams = encodeAbiParameters([{ type: "tuple", components: [{ name: "gasLimit", type: "uint256" }, { name: "maxGasPrice", type: "uint256" }] }],
    [{ gasLimit: EXT_GAS_LIMIT, maxGasPrice: price }]);
  const est = await wallet.estimateTransactionFees({ messageAllocations: [{ messageType: 0, recipient: payee, budget: EXT_GAS_LIMIT * price, feeParams, onAcceptance: false }] });
  return { distribution: est.distribution, ...(est.messageAllocations ? { messageAllocations: est.messageAllocations } : {}), feeValue: est.feeValue };
}

export type Phase = "idle" | "signing" | "submitted" | "validators" | "done" | "failed";
export type TxState = { phase: Phase; hash?: string; status?: string; error?: string; result?: Record<string, unknown> | null };

const TERMINAL = ["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function outcome(tx: any) {
  const status = transactionsStatusNumberToName[tx?.status as keyof typeof transactionsStatusNumberToName] ?? String(tx?.statusName ?? tx?.status ?? "");
  const receipt = tx?.consensus_data?.leader_receipt?.[0];
  const reverted = receipt?.execution_result === "ERROR" || receipt?.result?.status === "rollback" || tx?.txExecutionResultName === "FINISHED_WITH_ERROR";
  let reason = "";
  const p = receipt?.result?.payload;
  if (typeof p === "string") reason = p;
  else if (typeof receipt?.result?.raw === "string") {
    try { reason = atob(receipt.result.raw).replace(/^[\x00-\x1f]+/, ""); } catch { /* ignore */ }
  }
  return { status, reverted, reason };
}

export async function sendWrite(
  account: `0x${string}`, address: `0x${string}`, functionName: string, args: unknown[], value: bigint,
  on: (s: TxState) => void, opts: { payee?: string } = {},
): Promise<TxState> {
  let state: TxState = { phase: "signing" };
  const set = (s: Partial<TxState>) => { state = { ...state, ...s }; on(state); };
  on(state);
  try {
    const wallet = getWalletClient(account);
    const read = getReadClient();
    // A payout carries the fee of its value message: one External allocation for the payee.
    const fees = opts.payee ? await payoutFees(wallet, opts.payee) : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = (await wallet.writeContract({ address, functionName, args: args as any, value, ...(fees ? { fees } : {}) } as any)) as string;
    set({ phase: "submitted", hash });
    const started = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 4000));
      let tx: unknown = null;
      try { tx = await read.getTransaction({ hash: hash as never }); } catch { continue; }
      const o = outcome(tx);
      if (!TERMINAL.includes(o.status)) { set({ phase: "validators", status: o.status }); }
      else {
        if (o.status !== "ACCEPTED" && o.status !== "FINALIZED")
          return (set({ phase: "failed", status: o.status, error: "Validators could not agree (" + o.status.toLowerCase() + "). Nothing was recorded; you can try again." }), state);
        if (o.reverted) return (set({ phase: "failed", status: o.status, error: friendly(o.reason) }), state);
        let result: Record<string, unknown> | null = null;
        try {
          const raw = await read.readContract({ address, functionName: "get_last_result", args: [account] });
          result = JSON.parse(plain<string>(raw));
        } catch { /* no result */ }
        if (result && result.status === "REFUSED") return (set({ phase: "failed", status: o.status, error: friendly(String(result.reason)), result }), state);
        return (set({ phase: "done", status: o.status, result }), state);
      }
      if (Date.now() - started > 15 * 60_000) return (set({ phase: "failed", error: "Still not decided after 15 minutes. Follow the transaction in the explorer." }), state);
    }
  } catch (e) {
    set({ phase: "failed", error: friendly(e) });
    return state;
  }
}
