# Seeds

Everything here is read back from the chain by `node tools/seeds_md.mjs`.

## Canonical — the real incident

Contract [`0x6058b16009007E067660Ef28bF4741dD6A396581`](https://explorer-studio-dev.genlayer.com/address/0x6058b16009007E067660Ef28bF4741dD6A396581), incident 1. Terms: `incidents/aave-wsteth-capo-2026-03/terms.txt`
(sha256 `bfd522368b272b235a11cc8253c5b135f97a3aa2a6bd84e6603bdc21cfbd3d92`). Claim window 30 days, appeal window 14 days.

**Scale: 1 ETH = 0.01 GEN.** Every refund is computed in ETH-wei from the Ethereum receipt, then multiplied by 1/100 for the
GEN payout. The pool is 5.1319 GEN = the DAO's 513.19 ETH approval at that scale.

- 49 liquidation logs filed, 35 accounts (the proposal says 34).
- Our total **512.192859797 ETH**; the DAO's AFC paid **512.192859825 ETH** ([`0x687f…0f3f`](https://etherscan.io/tx/0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f)).
- **33 of 35 match**, 2 within 0.01%, 0 differ. Rule: agree to 9 significant digits, or within 0.0000000001 ETH for dust.
- Pool: 5.1419 GEN (includes 1 forfeited appeal stake), owed 5.1219 GEN, of which 0.6983 GEN withheld for contract borrowers.

| # | account | liquidation tx · log | ours (ETH) | DAO paid (ETH) | match | status |
|---|---|---|---|---|---|---|
| 1 | `0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f` | [`0x9064b507…`](https://etherscan.io/tx/0x9064b507f16bd8b85fb5aea0185153b01fa23b3205f7153f986e5107ce988a9c) #17 | 249.4787941017 | 249.4787941000 | MATCH | approved on appeal |
| 2 | `0x4bacce55f0991cfc4d919f7f50edb8be028e37df` | [`0x8f47b5e8…`](https://etherscan.io/tx/0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67) #14 | 87.7714041174 | 87.7714041200 | MATCH | owed (EOA) |
| 3 | `0xf82d8c60402200114e2d5a8bdc40b1ef8f8ab0de` | [`0x6b9c0d32…`](https://etherscan.io/tx/0x6b9c0d3292b51fc1612fba7cc26258357b2b705ab2699d2a4f0014c09a9b96cc) #37 | 54.0697851180 | 54.0697851300 | MATCH | approved on appeal |
| 4 | `0x6c92cd38db2074379aa6e68257f28207a8f7585e` | [`0xfdac8cca…`](https://etherscan.io/tx/0xfdac8cca66fc49bc709ef0eb3471458db1f2833815192c166950910c9e9aeded) #128<br>[`0xc5aa4bf1…`](https://etherscan.io/tx/0xc5aa4bf15e6b762bf9e75e33897fa143afe619b47a9789f03e2e532cd620b1f3) #14 | 44.2929241088 | 44.2929241100 | MATCH | withheld (contract) |
| 5 | `0x1e2799e0071e535468097e04ad23b9fe3ae5a6a5` | [`0x60f3fd66…`](https://etherscan.io/tx/0x60f3fd66c0f13927ff8b827228dcf209d6f2a5501ec5050e119f0c09300992db) #64 | 37.0960444279 | 37.0960444300 | MATCH | owed (EOA) |
| 6 | `0x6cc243d26eb6b79b70d94af4fd6f145b297e728b` | [`0xac1cad7f…`](https://etherscan.io/tx/0xac1cad7fdcab60d1174cd785ac993d36b8230caa5517541b7ee8b7a370fd66fb) #79 | 11.2603274252 | 11.2603274300 | MATCH | withheld (contract) |
| 7 | `0x3ee505ba316879d246a8fd2b3d7ee63b51b44fab` | [`0x33fc18a9…`](https://etherscan.io/tx/0x33fc18a92afeccaa00e1cab0f406b9f03f516b1d38cd15a7d58d8f9094c6c31b) #102 | 7.4157890633 | 7.4157890650 | MATCH | owed (EOA) |
| 8 | `0x5cede91b3c5783d093b2f6c29cb2571a11204b27` | [`0x4054c372…`](https://etherscan.io/tx/0x4054c372cb927fa5386a8786d59ec5f09d17be697e4a116c7631361e76174495) #38 | 5.8856395463 | 5.8856395470 | MATCH | withheld (contract) |
| 9 | `0x669173f1505025bc31fc7245fe4565659ca0e6e0` | [`0x66f6d449…`](https://etherscan.io/tx/0x66f6d449111cb67ce2fc491f6a6be0c4096d2e468579bf1b348dcb230ce51647) #103<br>[`0x02796db1…`](https://etherscan.io/tx/0x02796db103e92e98f68cfe1e3d9cf712a0edfe67903ac246eba086c32f0f205b) #14 | 2.7977259651 | 2.7977259650 | MATCH | withheld (contract) |
| 10 | `0x2935dd2b83dfae2d038b7fb0b9d62d02a78d1707` | [`0x61031c55…`](https://etherscan.io/tx/0x61031c5559992e6a72996aa549fa7d209fb1877913dafcf84a6559ab60fc334c) #85 | 2.7740085568 | 2.7740085570 | MATCH | withheld (contract) |
| 11 | `0xb29730e5dbeeb428b7b723a8a51d722a08872d9a` | [`0xf7b0ff68…`](https://etherscan.io/tx/0xf7b0ff68402cee6f68bb746f91f00503e13d35ef87471df10fb1d66117d49e1e) #216<br>[`0xffb974f5…`](https://etherscan.io/tx/0xffb974f5e9618c5f774a7eeb0ee1f89e7a048cf9d55ec9aa914446981f141c7e) #217<br>[`0x602afac7…`](https://etherscan.io/tx/0x602afac70192ed1903ceade622731c2430d68974618a211308da3ca0c17c9584) #264<br>[`0x2b043f91…`](https://etherscan.io/tx/0x2b043f918b90e572130d35f41533c38e823a1b5f1a777a441b19912e93c1bb55) #308 | 2.1000893747 | 2.1000893750 | MATCH | owed (EOA) |
| 12 | `0x718e7b7e03f9370394cc8a3bd41b395c72b90fa2` | [`0xb27dd335…`](https://etherscan.io/tx/0xb27dd3350490a750ee92494b0c0d9b33f2ad1cf0cbeadff8dae52104a1ead99b) #170 | 1.9111633806 | 1.9111633810 | MATCH | owed (EOA) |
| 13 | `0xa85cd6fe2f9e3ddc3f635f66a2773f71cfafac4d` | [`0xef7217a8…`](https://etherscan.io/tx/0xef7217a8a72b236b3c00640e88e78e66fa8b23a3507e411c617cfb7712289c5a) #155<br>[`0x3bee9cc4…`](https://etherscan.io/tx/0x3bee9cc474c6bb9d0e03d6ce8b5efe89cf5098d791c35c62cbb0ab504f6f27db) #178<br>[`0xd7418255…`](https://etherscan.io/tx/0xd7418255899739b2579c4f12ed244ea8e1c670062280e1afea01c8286d5515b5) #226<br>[`0x047b6265…`](https://etherscan.io/tx/0x047b6265d7ab3def4054bea0f805c65f5e78c58a966a92323f08ad09c3af7186) #252<br>[`0x31482796…`](https://etherscan.io/tx/0x31482796d23b1c04b47852f85aabf98b0351d3fdae07f23b1200e8cb41a5f159) #297<br>[`0xc59881ec…`](https://etherscan.io/tx/0xc59881ec4233833ddc7e0eb3b78a4e4654d86a6f79aa7e6ed948e13f2f52a7d6) #147 | 1.6908580621 | 1.6908580620 | MATCH | owed (EOA) |
| 14 | `0xfbfa537dde869b0c4738ef98fd9a652c7bf0efbc` | [`0x83c6cad0…`](https://etherscan.io/tx/0x83c6cad0319f1b6a4777dd4cfffa2b07c3ffad5dbb6a340f475179a7676bdcb1) #186 | 1.3715832031 | 1.3715832030 | MATCH | withheld (contract) |
| 15 | `0x342686053986b43cf852b94ca5afc46151296685` | [`0xedacc685…`](https://etherscan.io/tx/0xedacc685c672873fb90b0e5250387261583c2e9b0acdda54873a5a6042ea1a54) #58 | 1.2276616967 | 1.2276616970 | MATCH | withheld (contract) |
| 16 | `0x9a982dfcd22159a059114eca54b5abaabdd627b4` | [`0x7872defd…`](https://etherscan.io/tx/0x7872defdef7b839d43e79797ce4c4461b9727861db6aa9e72347f8e995812f5f) #233 | 0.4683917618 | 0.4683917619 | MATCH | approved on appeal |
| 17 | `0x318e706186a91ee084052789b5176ffb63135a21` | [`0xecb8f9bc…`](https://etherscan.io/tx/0xecb8f9bc4fbae98456aed6ce93e9578a0c742c7fe0b0b5a4193ffc24226ea73e) #367<br>[`0x499fe566…`](https://etherscan.io/tx/0x499fe5661104e3bdd301aae517c32f1fd10b9adc3dcfdbca74db54e8eb711b11) #385<br>[`0xbf9bcadd…`](https://etherscan.io/tx/0xbf9bcadd9dc090cda315bceb565641b1c3296b00b71199d6322b14894d44c0aa) #47 | 0.2129984624 | 0.2129984625 | MATCH | owed (EOA) |
| 18 | `0xeef25a4b78fef3e5daf6fb0a2f12e36ea0828f96` | [`0x896a41b8…`](https://etherscan.io/tx/0x896a41b851cd5162b2fd9841b7fb7344cf0e40aea6621a9b48e4c7939302c346) #14 | 0.1776322039 | 0.1776322039 | MATCH | withheld (contract) |
| 19 | `0x5e1b601245b942d99aa924d39e0fbec1786e2170` | [`0xd1ac5af3…`](https://etherscan.io/tx/0xd1ac5af3abbaaf1a0acc0fd257a71dbb28924368ddbc68f6dd8cb45c85eeeb78) #434<br>[`0x90181b3c…`](https://etherscan.io/tx/0x90181b3cde4da6b467a7844d58230d2d5d6c21f4f9ff8fa22a6d249e6295e378) #160<br>[`0xca6082d5…`](https://etherscan.io/tx/0xca6082d51fcf0e47f2581d4f9be0092e03f02cd783fd343e73c541df690c080d) #249 | 0.1060534396 | 0.1060534396 | MATCH | owed (EOA) |
| 20 | `0x892843df4fa30ee38b38542f2050690403e47a0e` | [`0x058203b5…`](https://etherscan.io/tx/0x058203b57c37d0700a2caccf9303a25ce1a3cbe7b751c26c8b9a02dd24f49f65) #272 | 0.0254935472 | 0.0254935472 | MATCH | withheld (contract) |
| 21 | `0xe7aaf0d67d89c253d5c00ffa3d85e7f1a6d235cf` | [`0x545558c9…`](https://etherscan.io/tx/0x545558c91855f69185390957af3dacc7422c5d72758cc3b0ebc2a81bd3f79f77) #564 | 0.0210918995 | 0.0210918995 | MATCH | owed (EOA) |
| 22 | `0xe0eb3075c2cbc4c4807a5802da45b1dbc7b955d1` | [`0x5444c97b…`](https://etherscan.io/tx/0x5444c97b90d957420b8d1b1e53117525cf498e6f2c3aefb66ac34034c461db19) #334 | 0.0148730337 | 0.0148730337 | MATCH | owed (EOA) |
| 23 | `0xc8cf295c4e084d08d3db7702aca33450ad652eb8` | [`0x5444c97b…`](https://etherscan.io/tx/0x5444c97b90d957420b8d1b1e53117525cf498e6f2c3aefb66ac34034c461db19) #384 | 0.0051849627 | 0.0051849627 | MATCH | withheld (contract) |
| 24 | `0x1fc623b96c8024067142ec9c15d669e5c99c5e9d` | [`0x5444c97b…`](https://etherscan.io/tx/0x5444c97b90d957420b8d1b1e53117525cf498e6f2c3aefb66ac34034c461db19) #359 | 0.0049785979 | 0.0049785979 | MATCH | withheld (contract) |
| 25 | `0xde89be395b57d07741004ed0be3174f3027fd44a` | [`0xd1ac5af3…`](https://etherscan.io/tx/0xd1ac5af3abbaaf1a0acc0fd257a71dbb28924368ddbc68f6dd8cb45c85eeeb78) #409 | 0.0035774456 | 0.0035774456 | MATCH | withheld (contract) |
| 26 | `0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd` | [`0xf7ef63d5…`](https://etherscan.io/tx/0xf7ef63d5b2da12a3ff3dedca42156174f5970f073777e24349a064af6fb5c566) #509 | 0.0028166990 | 0.0028166990 | MATCH | withheld (contract) |
| 27 | `0x3aac936216a43d4195791819ecc4975ba8fb6c72` | [`0xd1ac5af3…`](https://etherscan.io/tx/0xd1ac5af3abbaaf1a0acc0fd257a71dbb28924368ddbc68f6dd8cb45c85eeeb78) #459 | 0.0017624899 | 0.0017624899 | MATCH | withheld (contract) |
| 28 | `0x7f689846082b2b086fd9a899c61c16e9d0f6c31f` | [`0xf7ef63d5…`](https://etherscan.io/tx/0xf7ef63d5b2da12a3ff3dedca42156174f5970f073777e24349a064af6fb5c566) #484 | 0.0015042941 | 0.0015042941 | MATCH | owed (EOA) |
| 29 | `0x6b803f020cb302db766c5a276e935cca01de4e4a` | [`0xf7ef63d5…`](https://etherscan.io/tx/0xf7ef63d5b2da12a3ff3dedca42156174f5970f073777e24349a064af6fb5c566) #534 | 0.0011482732 | 0.0011482732 | MATCH | withheld (contract) |
| 30 | `0xbe6e072a92224cdebcb5a171451a6ebd1e380e62` | [`0x02696215…`](https://etherscan.io/tx/0x0269621586a95336197fd4194ec0fa964de27b283516c856713625f9540def47) #110 | 0.0004726261 | 0.0004726262 | MATCH | approved on appeal |
| 31 | `0xb27dd61b74e49d9707ddb7ea4a4baf03734dd94b` | [`0x02696215…`](https://etherscan.io/tx/0x0269621586a95336197fd4194ec0fa964de27b283516c856713625f9540def47) #127 | 0.0004469830 | 0.0004469830 | MATCH | withheld (contract) |
| 32 | `0xdb306e5c24cd28a02b50c6f893d46a3572835195` | [`0x02696215…`](https://etherscan.io/tx/0x0269621586a95336197fd4194ec0fa964de27b283516c856713625f9540def47) #144 | 0.0002980248 | 0.0002980248 | MATCH | owed (EOA) |
| 33 | `0xf07e4924115e2b786a797b2b9545472324ee5b05` | [`0x98e99343…`](https://etherscan.io/tx/0x98e993438697cdf7c8faade4a15f9b9bce74fda0a91fe29fc1762740826458bd) #377 | 0.0001603174 | 0.0001603201 | within 0.01% | withheld (contract) |
| 34 | `0x7f821b5058c362088c88952fd7735a6965e0bc98` | [`0xa6367dca…`](https://etherscan.io/tx/0xa6367dca45597724f06d499bec95a86bea0475243bca975331ecf2338fa20452) #126 | 0.0001392513 | 0.0001392513 | MATCH | withheld (contract) |
| 35 | `0x1570c1a39779cd31906a2ba854738b7d58fdb367` | [`0x0fb57c3c…`](https://etherscan.io/tx/0x0fb57c3cba7aaedcd7b3033be6ab17e354cd78883b241d93dce11cb17229b5ce) #363 | 0.0000373356 | 0.0000373370 | within 0.01% | owed (EOA) |

### Real appeals on canonical

| claim | borrower | decision | clause | payee (confirmed by owner()) | code check |
|---|---|---|---|---|---|
| #1 | `0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f` | ELIGIBLE | E4 | `0x08d49c032f268d3ac4265d1909c28dfaab440040` | OK |
| #3 | `0xf82d8c60402200114e2d5a8bdc40b1ef8f8ab0de` | ELIGIBLE | E4 | `0xf824a4b38bbb14f225e26ebac5fabae5362b3456` | OK |
| #11 | `0x9a982dfcd22159a059114eca54b5abaabdd627b4` | ELIGIBLE | E4 | `0x6fa6e54eaa65f94a878b25b0bd79b5c418f84d69` | OK |
| #20 | `0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd` | NOT_ELIGIBLE | X1 | — | OK |
| #45 | `0xbe6e072a92224cdebcb5a171451a6ebd1e380e62` | ELIGIBLE | E4 | `0xdcf972e3851620d1ba5201b923391b9f6a3ba528` | OK |

The two DSProxy wallets (the largest account, 249.48 ETH, and 0xf82d…, 54.07 ETH) and two other owner() wallets were found
ELIGIBLE under [E4]. 0x681d… (owner() returns an EOA) was found NOT_ELIGIBLE under [X1]: validators did not accept it as a
single user's wallet from its source. Of the 35 borrowers, 22 are contracts on Ethereum (2 more are EIP-7702 EOAs, paid
directly); the other 17 contracts have no owner() view (EIP-1167 clones, proxies, one Safe) and stay withheld until the
appeal deadline, when their reserve returns to the sponsor.

## Demo — every other path

Contract [`0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845`](https://explorer-studio-dev.genlayer.com/address/0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845), same source, windows of minutes. Record: `docs/seed-demo.json`.

| path | GenLayer tx | outcome | what the contract returned |
|---|---|---|---|
| Expiry: claim after the claim deadline | [`0x9b8aefcd…`](https://explorer-studio-dev.genlayer.com/tx/0x9b8aefcdcc2bb698128681fd991afdf17fc91b9b9ea66a6974b176c4e3a0b8cb) | refused | refused: “the claim window for incident #1 has closed” |
| Settle incident 1 (permissionless) | [`0xa1f907b0…`](https://explorer-studio-dev.genlayer.com/tx/0xa1f907b0c4cc0716c026fd1778e150a6bd5502482a84827f25baa9213ce901b0) | OK | credited_wei=3372501982190930855, incident_id=1, ratio=1/1 |
| Close after the appeal deadline | [`0x3d1c2d37…`](https://explorer-studio-dev.genlayer.com/tx/0x3d1c2d3702b4a9bd47fa2ab15dd5092b27fda31db016141067e4fbf4b1af8f88) | OK | incident_id=1, returned_to_sponsor_wei=1759398017809069145 |
| Sponsor withdraws the remainder | [`0xcd5a0f8c…`](https://explorer-studio-dev.genlayer.com/tx/0xcd5a0f8c1881cbf8605e228aad21cf9bd3ee9951265c410cb83a46c26cb770a7) | OK | paid_wei=1759398017809069145 |
| Withdraw twice | [`0x21be0d9a…`](https://explorer-studio-dev.genlayer.com/tx/0x21be0d9aa5884a079d0771e5cf1bee6bb14c5570176b5a3679fab79f6ca4f1fa) | refused | refused: “nothing to withdraw for 0x11b1745f79e8a5af25627fd5421fb906925d5d8c” |
| Duplicate: same tx, upper-case hash, hex log index | [`0x87c8f914…`](https://explorer-studio-dev.genlayer.com/tx/0x87c8f9145027f82aebec04f16b9aad1208b08d1efbd01812cf089fcec51788fd) | refused | refused: “this liquidation is already claim #5” |
| Out of range: real liquidation of 8 March (block 24,613,580) | [`0x429c7f7e…`](https://explorer-studio-dev.genlayer.com/tx/0x429c7f7ecc1de93e99296e407c9aee9ebce867940a3717edfb3531f4b3392dc5) | refused | refused: “block 24613580 is outside the incident range 24626860-24628088” |
| Appeal: Safe 0xf07e… (11 owners, threshold 2), run 1 | [`0x331934fd…`](https://explorer-studio-dev.genlayer.com/tx/0x331934fd72e373fba16fcc7877090cc5d34260cd1cf27bcb16e3d54ca0837bf3) | OK | appeal_id=2, beneficiary=, claim_id=3, clause_id=X2, code_check=OK, decision=NOT_ELIGIBLE, stake=forfeited to the pool |
| Appeal: same Safe, run 2 | [`0x27d3daf6…`](https://explorer-studio-dev.genlayer.com/tx/0x27d3daf6ec9d4607f81fa1faedaf0b753fa02f121d6d22e081af38ade4a97a1a) | OK | appeal_id=3, beneficiary=, claim_id=3, clause_id=X2, code_check=OK, decision=NOT_ELIGIBLE, stake=forfeited to the pool |
| Appeal: DSProxy 0x4f96…, second run of the eligible case | [`0xe7672fc6…`](https://explorer-studio-dev.genlayer.com/tx/0xe7672fc62ce87d34186154c5a560f2f5eed4d5c1a70727f38da764e742b927f1) | OK | appeal_id=4, beneficiary=0x08d49c032f268d3ac4265d1909c28dfaab440040, claim_id=4, clause_id=E4, code_check=OK, decision=ELIGIBLE, stake=returned |
| Appeal with a prompt-injection argument (EIP-1167 clone 0x3aac…) | [`0x4d755e7c…`](https://explorer-studio-dev.genlayer.com/tx/0x4d755e7c1bb9b2bbc6ef26de99a051dfb0a05007c9d1cb51c1fbcc8d90397b5f) | OK | appeal_id=5, beneficiary=, claim_id=6, clause_id=X1, code_check=OK, decision=NOT_ELIGIBLE, stake=forfeited to the pool |
| Oversubscribed pool (1 GEN) settles pro-rata | [`0xb5bb8b44…`](https://explorer-studio-dev.genlayer.com/tx/0xb5bb8b441bd74d25f7f7804f726bfbe09b814fda7067800b8d8aef6b8be13724) | OK | credited_wei=957983738983686168, incident_id=3, ratio=1000000000000000000/1400800405355849384 |
| Expiry: appeal after the appeal deadline | [`0xd9428990…`](https://explorer-studio-dev.genlayer.com/tx/0xd94289900ce1dabc372d4a4c28ab10a5d6a63e3267758e42da3df858705ff393) | refused | reason=the appeal window has closed, value_withdrawable=10000000000000000 |
| Close: unappealed reserve + dust return to the sponsor | [`0xa3f9f0f4…`](https://explorer-studio-dev.genlayer.com/tx/0xa3f9f0f4dd4bef14bb91b72f17dd9fd5f2c885a7b36b18f5dfab0442bb851d23) | OK | incident_id=3, returned_to_sponsor_wei=42016261016313832 |
| TEST CHAIN incident settles | [`0x17bb89cf…`](https://explorer-studio-dev.genlayer.com/tx/0x17bb89cf98b1123ee0ab4787a6bd8893846bccd0a463beb7ed9775ee31fb27be) | OK | credited_wei=158284532706823883, incident_id=4, ratio=1/1 |
| Test borrower 1 withdraws its own refund | [`0x1edb065b…`](https://explorer-studio-dev.genlayer.com/tx/0x1edb065b99fd31658cd2fa34bb0debed32359cc99040e9588330d6f566838c67) | OK | paid_wei=39571133176705970 — the contract zeroed the balance and posted the transfer (`on: finalized`); Studio Dev did not execute it (see Known limits) |
| Test borrower withdraws twice | [`0x011dd765…`](https://explorer-studio-dev.genlayer.com/tx/0x011dd765ace70c0152b12e03ca02dbd3b1da70d0fd75adbdbf4039735dfcfade) | refused | refused: “nothing to withdraw for 0x45e2e2b04905e7499801fa41e29bb07319dee276” |

### Model-decided cases, run twice

- **DSProxy 0x4f96… (ELIGIBLE case)**: canonical appeal #1 → ELIGIBLE [E4] payee 0x08d49c032f268d3ac4265d1909c28dfaab440040; demo incident 2 → ELIGIBLE [E4] payee 0x08d49c032f268d3ac4265d1909c28dfaab440040; and demo incident 1 (smoke run) → ELIGIBLE [E4] 0x08d49c…0040. **Agree.**
- **Safe 0xf07e… (NOT_ELIGIBLE case)**: run 1 → NOT_ELIGIBLE [X2] (OK); run 2 → NOT_ELIGIBLE [X2] (OK). **Agree on the decision and the clause.**
