// Writes ADDRESSES.md from deployments.json (v2 and the v1 BASE).
import { readFileSync, writeFileSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname;
const d = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8"));
const ex = (a) => `[\`${a}\`](https://explorer-studio-dev.genlayer.com/address/${a})`;
const tx = (h) => `[\`${h.slice(0, 10)}…\`](https://explorer-studio-dev.genlayer.com/tx/${h})`;
const L = ["# Addresses", "", "GenLayer Studio Dev, chain 61997. Generated from `deployments.json` by `node tools/addresses_md.mjs`.", "",
  `## v2 (deployed from [\`${d.v2.commit.slice(0, 7)}\`](https://github.com/kenil1710/makewhole/tree/${d.v2.commit}))`, "",
  "| Contract | Address | Deploy tx | File | Bytes | sha256 | Constructor |", "|---|---|---|---|---|---|---|",
  ...Object.entries(d.v2.contracts).map(([n, r]) => `| ${n} | ${ex(r.address)} | ${tx(r.deploy_tx)} | \`${r.file}\` | ${r.bytes} | \`${r.sha256}\` | \`${JSON.stringify(r.constructor_args)}\` |`),
  "", "## v1.3 (the accepted submission, BASE; untouched)", "", "| Contract | Address | Deploy tx | Commit | sha256 |", "|---|---|---|---|---|",
  ...Object.entries(d.contracts).map(([n, r]) => `| ${n} | ${ex(r.address)} | ${tx(r.deploy_tx)} | \`${r.commit.slice(0, 7)}\` | \`${r.sha256}\` |`), ""];
writeFileSync(ROOT + "ADDRESSES.md", L.join("\n"));
