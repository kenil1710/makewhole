/** The contract's formula, in BigInt, so a preview shows the exact wei the code will compute. */
export function computeOwed(formula: string, param: bigint, bonusBps: bigint, collateral: bigint, debt: bigint, rate: bigint): bigint {
  const WAD = 10n ** 18n;
  const debtEth = (debt * rate) / WAD;
  if (formula === "ORACLE_GAP_PLUS_DEBT_BPS") return (collateral * param) / WAD + (debtEth * bonusBps) / 10_000n;
  if (formula === "TRUE_VALUE_MINUS_DEBT") {
    const v = (collateral * param) / WAD - debtEth;
    return v > 0n ? v : 0n;
  }
  return 0n;
}
export const toGen = (src: bigint, num: string, den: string) => (src * BigInt(num)) / BigInt(den);
