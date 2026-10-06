TokenLogic | 2026-03-11 20:27:19 UTC | #1

## [Direct To AIP] **wstETH CAPO Oracle Incident User Reimbursement**
**Author:** TokenLogic
**Created:** 2026-03-11

---

## Summary

This ARFC proposes the Aave DAO refund users who were erroneously liquidated during the wstETH CAPO oracle misconfiguration incident on Ethereum Core and Prime instances. The total refund amounts to **512.19 ETH**, with a net cost to the DAO of **357.56 ETH** after recoveries, a figure that should decrease as more recoveries are processed.

## Motivation

A configuration misalignment between the `snapshotRatio` and `snapshotTimestamp` parameters in the wstETH CAPO risk oracle caused the reported wstETH/stETH exchange rate cap to fall approximately 2.85% below the actual market rate. This triggered erroneous liquidations across 34 accounts on the Ethereum Core and Prime instances, totaling ~10,938 wstETH liquidated.

As detailed in the [Post-Mortem](https://governance.aave.com/t/post-mortem-exchange-rate-misallignment-on-wsteth-core-and-prime-instances/24269), the root cause was a mismatch between two interdependent Oracle parameters, snapshotRatio and snapshotTimestamp. The issue was promptly identified and resolved through Risk Steward intervention.

The affected users bear no responsibility for these liquidations, which were the direct result of a protocol-level configuration error. Making these users whole is a straightforward decision for the DAO and reinforces the trust that underpins Aave's position as the leading lending protocol.

## Loss Breakdown

| **Category** | **ETH** |
| --- | --- |
| Oracle profit (loss to users) | 382.76 |
| Liquidation bonus (loss to users) | 129.72 |
| Goodwill allowance | 1 |
| **Total loss** | **513.19** |
| Recovered from Titan Builder | (141.60) |
| Recovered liquidation fees | (13.32) |
| **Net cost to the DAO** | **358.56** |

Recovery efforts remain ongoing. The DAO is actively pursuing additional funds from builders involved in the incident. Should further recoveries materialize, updates will be posted as comments on this ARFC. For the sake of speed and making affected users whole without delay, these potential future recoveries are not factored into this proposal,  they would be a welcome bonus that further reduces the DAO's net cost.

## Specification

Create allowance on the Aave Ethereum Collector for the AFC to distribute refunds to affected users:

- **Asset:** [WETH](https://etherscan.io/token/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- **Amount:** 513.19 ETH
- **Spender:** [AFC](https://etherscan.io/address/0x22740deBa78d5a0c24C58C740e3715ec29de1bFa) `0x22740deBa78d5a0c24C58C740e3715ec29de1bFa`
- **Method:** `approve()` on the Aave Ethereum Collector

Upon AIP execution, the AFC will distribute the appropriate refund amount to each affected user address. A detailed per-user breakdown will be included in the AIP payload.

## Next Steps

1. Collect community feedback
2. Publish AIP with on-chain payload
3. AFC executes refund distributions upon AIP execution

## Disclosure

TokenLogic is an active service provider to the Aave DAO, the beneficiary of stream 100072 and the KPI as outlined in this [publication](https://governance.aave.com/t/arfc-service-provider-compensation-reform-for-v4-alignment/23246). The scope of this engagement is available via this forum [proposal](https://governance.aave.com/t/arfc-tokenlogic-phase-ii/23223). 

TokenLogic supports and maintains an independent [delegate voting platform](https://governance.aave.com/t/tokenlogic-delegate-platform/12516) within the Aave community. 

TokenLogic and associated entities have no undisclosed material conflicts of interest at the time of submission.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

-------------------------

ApuMallku | 2026-03-11 21:51:50 UTC | #2

I fully support reimbursing the affected users. Aave’s reputation as the premier lending protocol in DeFi is built on trust, and making users whole after an operational error is absolutely the right thing to do. The users should not pay the price for this.

However, moving forward with a Direct-to-AIP to drain the DAO Treasury before answering the fundamental accountability questions raised in the post-mortem sets a dangerous precedent.

If the Aave DAO automatically steps in as a bailout fund ('Papa DAO') every time a highly-paid Service Provider (SP) makes a human or configuration error, we are creating a massive **moral hazard**. If the Treasury always foots the bill for operational mistakes, SPs have zero financial incentive to implement rigorous, zero-defect QA processes. Technical and human rigor will not improve if there are no consequences for failing to maintain it.

I will support this reimbursement so our users are protected immediately, but I strongly urge the community and the delegates to separate user reimbursement from DAO liability.

Therefore, I have two demands before this moves to an on-chain vote:

**1. Acknowledgment of the Open Questions:** We still have not received clear answers regarding who signed off on this flawed configuration and why our simulation pipelines failed to catch a 2.85% misalignment. We cannot vote on funding without understanding the failure.

**2. SP Reimbursement Commitment:** The DAO should front the money to the users now, but this must be paired with a formal commitment that the responsible Service Provider(s) will reimburse the Aave Treasury for this exact amount. This can be done via direct repayment or proportional deductions from their active funding streams.

'Skin in the game' cannot just be a buzzword used during budget approvals; it must be enforced when operational oversights cost the protocol money. Let’s pay the users, but let's also hold our vendors accountable.

-------------------------

TokenLogic | 2026-03-12 18:05:09 UTC | #3

Update on the recovery effort: @bgdlabs successfully negotiated a partial return from one of the searchers involved. A total of 41.62 WETH was recovered, bringing the net cost to the DAO down to 316.94 WETH.​​​​​​​​​​​​​​​​

-------------------------

Frida | 2026-03-13 02:58:06 UTC | #4

Why is this a a direct-to-AIP? On what grounds this qualifies as such? Is there a precedent? Does this falls within the scope of a past ARFC that enables direct-to-AIP treatment for this situation?

If yes, move along.
If not – which wouldn’t be surprising – why is @TokenLogic making this choice? What is TL’s motivation in fast-forwarding this through governance? I can imagine this has been discussed among SPs, but any close-doors agreement does not change the fact that TL is owning it. Therefore, you should be able to provide an answer.

It is a slippery slope to twist governance processes, especially when DAO’s funds are being affected. Governance should be held to higher standards, and TL as well. The request sounds reasonable, the means or the format does not provided there are no successful answers to the above.

-------------------------

Frida | 2026-03-18 00:56:15 UTC | #5

I see this has now moved to on-chain voting without any explanation on why it was categorized as direct-to-AIP. The AIP lists TokenLogic as the author.

This is disappointing, not because of the proposal itself, but because of the process around it. Direct-to-AIP should be reserved for cases where urgency and prior context are clearly established. That doesn’t seem to be the case here, and the forum discussion didn’t provide justification when it was explicitly requested. Direct-to-AIP with zero explanation is governance bypass.

Delegates are expected to uphold a higher standard when it comes to governance process and transparency. Moving forward without addressing basic questions from the community sets a poor precedent, especially in situations involving user reimbursement and DAO funds.

This is not about blocking the outcome, but about maintaining discipline in how decisions are brought forward. Otherwise, the distinction between temp-checks and direct-to-AIP becomes meaningless. The ask - not only mine but @ApuMallku ‘s as well, here was simple: explain why this qualifies as direct-to-AIP. It is sad this never happened. Tagging @MatthewGraham and @efecarranza for visibility, as the question around the direct-to-AIP path remains unanswered.

-------------------------

skoreless | 2026-03-26 22:46:50 UTC | #6

Is there an update on this? I see the AIP executed but there is no listing of affected users and amounts and no funds have been distributed.

-------------------------

skoreless | 2026-04-01 14:50:43 UTC | #7

ping. I see that funds were distributed but I still don’t see an accounting provided on a per-user basis. Looking at the distribution, one of these payments looks to be \~20 weth short of what was lost from the liquidation.

-------------------------

MconnectDAO | 2026-04-01 17:03:24 UTC | #8


Appreciate the intent behind this proposal user reimbursement is the right call, and the recovery efforts by BGD Labs are commendable.

However, I want to raise a point that has been largely overlooked in this thread: there is no post-distribution audit mechanism proposed.

The AIP has executed, funds have been distributed  yet as @skoreless rightly points out, there is no public per-user accounting, and at least one payment appears \~20 WETH short. This is not a minor bookkeeping issue. If the DAO is spending \~317+ ETH of community funds, the minimum standard of transparency should be a publicly verifiable, on-chain reconciliation of every affected address and amount distributed vs. amount lost.

Additionally, neither this proposal nor any response addresses the systemic fix: What protocol-level or process-level change has been made to ensure snapshotRatio and snapshotTimestamp cannot go out of sync again? Reimbursement treats the symptom. The community deserves to know the cure.

The question is not whether to pay it’s whether the DAO is operating with the rigor that \~$1B+ in TVL demands. Accountability and transparency are not optional extras; they are the foundation of governance credibility.

-------------------------

system | 2026-05-01 17:04:07 UTC | #9

This topic was automatically closed 30 days after the last reply. New replies are no longer allowed.

-------------------------

