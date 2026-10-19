# When a lending protocol liquidates you by mistake, who checks the refund?

In March 2026 a price cap on Aave was set wrong for about four hours. For 1,229 Ethereum blocks Aave valued wstETH
2.85% below what it was really worth, and in the first few of those blocks 49 liquidations seized almost 11,000 wstETH
from 35 accounts that were never underwater. Aave did the decent thing. The DAO voted a refund, and two weeks later the
Finance Committee paid all 35 addresses in a single transaction.

What it never published was how each number was worked out. The proposal had a loss table and a total. The payout
had 35 amounts. In between there was nothing a borrower could check. A forum member said one payment "looks to be
~20 weth short", and nobody outside could tell whether that was true.

Last month I built a first version of MakeWhole to make that one refund checkable. This is the second version, and it is
a lot less about Aave.

## What changed

The first version knew one incident, one protocol and one chain, and it had appeals decided partly by a language model
for the awkward cases. Version 2 drops all of that in favour of something duller and more useful.

A sponsor, meaning the protocol, a DAO or anyone who wants to pay people back, opens an incident and freezes the terms in
one transaction: which protocol template (Aave v3 and its SparkLend fork, Compound v3, or Morpho Blue), which chain
(Ethereum, Arbitrum, Base, Optimism or Polygon), which official contracts, which blocks, which collateral and debt
assets count, an optional price condition, a formula, a deadline, and the pool. If the sponsor already has a
reimbursement list, its hash goes into the terms too. Once the first event is filed the sponsor can only add money or
give people more time.

Then a keeper bot goes looking. Every hour it walks each open incident's block range on the source chain, reads each
page of logs from two different endpoints, and files every liquidation it finds. GenLayer validators each fetch the
receipt themselves from every RPC frozen in the terms. A receipt counts only if two endpoints return it identically,
none disagrees, the block is final, and it was emitted by an official contract. After that it is plain code: decode
the event, apply the filters, compute the amount. The refund is owed to the borrower in the log, whoever filed it.

No model is involved anywhere. I tried for a while to keep one around for edge cases and every time I looked closely
the edge case was really a missing rule.

## Three real incidents

I kept the Aave one and went looking for others with real liquidation events and a public write-up.

The first is small and a bit sad. On 2 March 2025 a Morpho Blue market on Base, cbETH against WETH at 94.5% LLTV,
liquidated three positions in four and a half minutes. The curator, RE7, posted a report: the market's oracle combines
two Pyth push feeds, ETH/USD got updated and cbETH/USD didn't for a few minutes, and the ratio briefly fell from 1.091
to 1.055. The forum post that started the thread was from someone who lost about 13 ETH. The thread records no
refund. Under the terms I drafted from RE7's numbers, MakeWhole computes 11.71 ETH owed to that account.

The second is bigger and messier: the ezETH depeg on 24 April 2024. Renzo's token traded far below its redemption value
for a few hours and Morpho's ezETH markets, whose oracle followed the pools, liquidated 146 positions. Gauntlet's update
counts 138 in one market and 8 in the other, and that is exactly what the keeper found. This one is a good test of the
filters: one of the 146 refunds comes out below the 0.001 ETH minimum, and the pool here is deliberately short, so
everyone gets the same fraction of what they are owed.

## Checking against the sponsor's own list

For the Aave incident the official list exists: it is the Finance Committee's payout. I froze it, with its hash, in the
terms, and the contract compares every computed refund with it. 33 of 35 accounts match within one part per million.
Two differ by a few thousandths of a percent; both had debt in cbETH or osETH, which I price with Aave's oracle and the
DAO apparently priced slightly differently. The total computed is 512.19285980 ETH against the DAO's 512.19285983.
The page lists every row with its delta, so you don't have to take my summary for it.

## Paying people, for real this time

Here is the uncomfortable part. When I went back to the first version for this milestone, I checked whether its
test payouts had actually arrived. They hadn't. The contract's books said 4.29 GEN had been withdrawn, but on Studio
Dev that kind of internal transfer is recorded with a zero budget and skipped, and the value quietly goes back to the
contract. Its balance was the books plus everything "withdrawn", to the wei.

Version 2 pays with an external value message, the claimer pays its fee, and nothing counts as paid until the finalized
transaction shows the value delivered and the recipient's balance moved by exactly that amount. Every demo payout, and
the real-borrower payouts on the canonical incidents, were checked that way, and the demo contract ends at a balance of
zero.

## For other protocols

There is a small read-only contract, RecoveryGate, that answers one question about an account and an incident:
NO_INCIDENT, NOT_ELIGIBLE, ELIGIBLE_UNPAID, PAID (with whether it was the full amount), CLOSED, or UNAVAILABLE. That last
one matters. If anything in the answer is missing or doesn't add up, the gate says it doesn't know rather than guessing
in someone's favour.

## What it doesn't do

MakeWhole doesn't decide who caused an incident or whether a liquidation was fair. The sponsor's terms say what counts
and code applies them. If you think the terms are wrong, the terms are public, hashed and frozen before anyone files,
which is the point.

The app is at https://makewhole-ledger.vercel.app and everything, including the keeper's bookkeeping and the tests, is
at https://github.com/kenil1710/makewhole.
