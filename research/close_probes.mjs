// Closes the two throwaway probe deployments (research only) so they hold nothing.
import { actor, balanceOf } from "../tools/lib/mw.mjs";
for (const addr of ["0xFbD88a1CC397E80c947b0a5829F188C9EDDc9Dc7", "0x2D0E64228c2d7942869B35f77511620334bb8F3f"]) {
  const a = actor("probe", addr);
  const inc = await a.view("get_incident", [1]);
  if (!inc.closed) { const o = await a.pushTo("close", [1], inc.sponsor); console.log(addr, "close", o.status, o.ok, o.hash); }
  console.log(addr, "balance after", String(await balanceOf(addr)));
}
