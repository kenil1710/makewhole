/** Wei -> decimal string by integer arithmetic only (no float rounding of money). */
export function units(wei: string | bigint | number, decimals = 18, places = 6): string {
  let n = BigInt(wei);
  const neg = n < 0n;
  if (neg) n = -n;
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  let frac = (n % base).toString().padStart(decimals, "0").slice(0, places);
  frac = frac.replace(/0+$/, "");
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + w + (frac ? "." + frac : "");
}
/** Fixed places, padded: for columns that must line up. */
export function fixed(wei: string | bigint, places = 6, decimals = 18): string {
  let n = BigInt(wei);
  const neg = n < 0n;
  if (neg) n = -n;
  const base = 10n ** BigInt(decimals);
  const scale = 10n ** BigInt(decimals - places);
  const r = (n + scale / 2n) / scale;
  const whole = r / 10n ** BigInt(places);
  const frac = (r % 10n ** BigInt(places)).toString().padStart(places, "0");
  void base;
  return (neg ? "−" : "") + whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + frac;
}
export const short = (h: string, a = 6, b = 4) => (h && h.length > a + b + 2 ? `${h.slice(0, a + 2)}…${h.slice(-b)}` : h);
export function when(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}
export function day(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
export function until(ts: number, now = Date.now() / 1000): string {
  const s = Math.round(ts - now);
  const abs = Math.abs(s);
  const txt = abs >= 86400 ? `${Math.round(abs / 86400)} days` : abs >= 3600 ? `${Math.round(abs / 3600)} hours` : abs >= 60 ? `${Math.round(abs / 60)} minutes` : `${abs} seconds`;
  return s >= 0 ? `in ${txt}` : `${txt} ago`;
}
