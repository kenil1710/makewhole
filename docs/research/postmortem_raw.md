ChaosLabs | 2026-03-11 19:39:45 UTC | #1

## Summary

A technical incident affecting the CAPO risk oracle caused the reported wstETH/stETH exchange rate cap to fall below the currently valid market exchange rate on Ethereum Core and Prime instances.

This resulted in an approximately 2.85% decrease in the effective exchange rate used by the protocol, triggering roughly 10938 wstETH in E-Mode liquidations.

During this, protocol incurred no bad debt. However, liquidators captured approximately 512 ETH in liquidation bonuses and value realized through the exchange rate deviation. Since then, Aave has been able to recapture 141 ETH of liquidation bonus revenue through BuilderNet refunds, in addition to roughly 13 ETH in liquidation fees. These recovered funds will be used to compensate impacted users who were liquidated as a result of the incident, with DAO treasury funds to cover any excess. Active work is ongoing to contact relevant ecosystem players to further recoup possible liquidation-linked revenue.

The root cause was differing update constraints at the smart contract level, which ultimately resulted in a misalignment between the snapshot ratio and snapshot timestamp onchain.

Due to onchain constraints, the snapshot ratio could not be increased as quickly as intended, while the snapshot timestamp was not validated against that constrained update path and still reflected a 7-day-old reference point. This created an inconsistent configuration that caused CAPO to compute a maximum allowed exchange rate below the live rate.

## Background

As described in the original CAPO framework, the system is designed to protect lending protocols from oracle-driven inflation attacks and donation-style exploits.

CAPO does this by placing a deterministic, time-weighted upper bound on the exchange rate between a yield-bearing asset, such as wstETH, and its base asset, such as stETH. 

The purpose of this bound is to capture the upper envelope of organic yield accrual, while rejecting abrupt or malicious upward deviations that could otherwise be used to create unbacked borrowing power.

This protection is especially important in adversarial scenarios, including:

- compromised EOAs controlling an oracle input,
- centralized oracle dependencies,
- contract upgrade vulnerabilities,
- donation attacks or exchange-rate manipulation.

The upper bound is governed by three parameters:

- **`snapshotRatio`**: the reference exchange rate,
- **`snapshotTimestamp`**: the timestamp associated with that reference,
- **`maxYearlyRatioGrowthPercent`**: the maximum annualized rate at which the ratio is allowed to grow.

The maximum permitted ratio is computed from the snapshot ratio plus a time-based growth allowance based on the difference between the snapshot timestamp and the current block time.

Conceptually, CAPO logic requires that the snapshot ratio and snapshot timestamp remain aligned. The snapshot ratio serves as the anchor, and the timestamp determines how much growth to apply to it. If those two values become inconsistent, the derived cap can drift away from the real exchange rate.

## What happened

The incident was caused by an inconsistency between the configured snapshot ratio and the snapshot delay/timestamp used for CAPO.

Operationally, our offchain process determined that the snapshot ratio should be updated to approximately ~1.2282, the appropriate value corresponding to the exchange rate 7 days earlier, as derived in our framework.

However, the snapshot ratio parameter is subject to an onchain constraint: it can only be increased by 3% every 3 days.

Because the previously configured snapshot ratio, on the contract was ~1.1572, it was not possible to set it to ~1.2282 in a single update. Instead, the ratio could only be increased to ~1.1919.

At the same time, the snapshot timestamp was still set to the value corresponding to 7 days earlier (`1772535647`), as intended by the offchain algorithm.

This created a mismatch:

- the timestamp assumed a 7-day-old anchor,
- but the ratio was not actually updated to the 7-day-old exchange rate,
- so the CAPO formula extrapolated growth from a reference point that was too low.

As a result, the calculated maximum exchange rate was roughly 1.1939, which was below the already configured/prevalent exchange rate. That lower CAPO-derived value then overrode the existing exchange rate used by the protocol, producing an effective downward move of around 2.855%.

That artificial decrease in the oracle rate triggered liquidations, particularly in E-Mode, affecting the positions with a health factor lower than 1.0288, resulting in roughly 10938 wstETH of liquidation volume.

In practical terms, for the configuration to work correctly at the smart contract level, the snapshot timestamp would have needed to be aligned with the constrained onchain snapshot ratio update, and likely adjusted again over subsequent updates until the onchain value converged with the offchain-calculated level. Because that alignment did not occur, the timestamp and ratio reflected different effective reference points.

## Root cause

The root cause was a configuration issue arising from differing operational constraints at the smart contract level.

- **`snapshotRatio`** was subject to an onchain rate-limited update constraint
- **`snapshotTimestamp`** was not subject to the same effective constraint
- our offchain logic correctly targeted the intended configuration, but under the constrained onchain update path, the snapshot ratio and snapshot timestamp did not remain aligned throughout execution
- in practice, only the timestamp fully reflected the 7-day update target

In other words, the system combined:

- a partially updated ratio
- with a fully advanced timestamp

That combination caused the CAPO cap to be computed from an anchor that was too low for the elapsed time basis being used.

More broadly, in order for this configuration to function correctly under the existing ratio constraint, the snapshot timestamp would have needed to remain aligned with the constrained onchain ratio update path, potentially across multiple successive updates, until the onchain snapshot ratio reached the offchain-calculated target level.

## Impact

The incident had the following impact:

- approximately 2.85% downward deviation in the effective exchange rate used by the protocol,
- roughly 10938 wstETH in E-Mode liquidation volume across 34 accounts.
- approximately 116 ETH in liquidation bonuses captured by third-party liquidators and Aave Liquidation Protocol fees.
- approximately 382 ETH in profit captured by third-party liquidators stemming from the underpricing of the oracle.
- no bad debt accrued by the protocol.

## Immediate steps taken

Following the incident, we took immediate steps to contain further risk and restore alignment on the impacted instances:

- Temporarily reduced the wstETH borrow cap to 1 on Aave Core and Aave Prime, the two impacted instances by this oracle configuration, in order to minimize additional exposure while remediation was underway.
- Aligned the snapshot ratio parameter with the current snapshot timestamp reference window through manual Risk Steward intervention, so that the configured onchain parameters move back into a consistent state and uncap the oracle, reverting to its true value.
- Following the reversion of the oracle price, we are proposing the reinstating of the wstETH borrow caps back to its original levels.
    
    
    | **Asset** | **Instance** | **Current Value** | **Recommended Value** |
    | --- | --- | --- | --- |
    | wstETH | Ethereum Core | 1 | 180K |
    | wstETH | Ethereum Prime | 1 | 70K |

## Recovery and compensation

During the incident, Aave was able to recapture a substantial amount of lost liquidation bonus revenue (141.5 ETH) through BuilderNet refunds leveraged for reading the associated risk oracle update. We recommend that these recovered funds will be used to partially compensate users who were liquidated as a result of the incident. The rest of the user funds impacted shall be covered through the Aave treasury through a defined compensation plan, to be communicated shortly. Different parties are actively working on recovering more funds extracted outside of the system, and we can confirm that no more than 358 ETH will need to be compensated ad-hoc from the DAO.

## Closing

To summarize, this was a configuration incident based on smart contract level constraints which caused incorrect price updates for wstETH, resulting in $26M in liquidation volume.

Ultimately, this incident did not reflect a flaw in the underlying CAPO or offchain risk oracle design, but rather an onchain configuration misalignment under differing onchain update constraints that led the snapshot ratio and snapshot timestamp to become misaligned.

The protocol has since been reverted to its prior price oracle configuration, no bad debt was incurred, and the liquidation bonus value extracted during the incident has been substantially recaptured and will be returned to affected users through the compensation process described above.

We will continue to share additional details as compensation is finalized and further remediation steps are completed.

-------------------------

Frida | 2026-03-10 22:33:39 UTC | #2

I appreciate bringing this forward, and clearly explaining what the issue was.

If I may raise some follow up questions and comments:

* Can a third party force the system into this state again? In other words, can this be exploited?
* Can you explain a bit better how this was not a design problem and yet a an legitimate system output?
* What guardrails are there being put in place from keeping this to happen again? Is there going to be a kind of secondary check before CAPO oracle updates are pushed into the aave platform? It feels like this is a vital app component that could benefit from having an independent validation check.
* “no bad debt” has been mentioned 3 times. There were no market dynamics, iiuc, generating a risk of bad debt. In fact, the ask of the DAO covering the gap, which I will support, will hit the DAO balance sheet so that users won’t be impacted as if there was bad debt.
* Which takes me to a more sensible topic which I feel forced to raise. Does Chaos Labs carry any responsability of what happened? Will there be a separated proposal on how to make borrowers whole that will show CL playing a role in funding it?

Thank you again for the clear information and for being profesional about it. I hope there is a fair outcome for everybody that token holders can rally behind.

-------------------------

pcx | 2026-03-11 04:52:45 UTC | #3

[quote="Frida, post:2, topic:24269"]
Which takes me to a more sensible topic which I feel forced to raise. Does Chaos Labs carry any responsability of what happened? Will there be a separated proposal on how to make borrowers whole that will show CL playing a role in funding it?

[/quote]

I'm very curious about the answer to this question.

-------------------------

hsim.dev | 2026-03-11 08:47:51 UTC | #4

Reading through the write-up, one thing that stood out to me is the failure mode created when two parameters that are supposed to describe the same reference point evolve under different constraints.

That seems to have created a strange situation where the system was effectively extrapolating growth from a ratio that didn’t actually correspond to that timestamp.

A few things I’m curious about from a design perspective:

First, should parameters like (ratio, timestamp) effectively be treated as a pair that must remain aligned onchain and updated together?

Second, when you have onchain rate limits but an offchain system calculating the “correct” target value, what’s the best way to handle the transition state while the contract gradually moves toward that target? It seems easy for the two sides to temporarily represent different assumptions.

Third, is it desirable for guardrail mechanisms like this to be able to push the effective price downward relative to the underlying oracle? I understand the motivation for capping upward deviations, but downward moves can obviously be detected?

Lastly, I wonder if there’s room for simple sanity checks onchain that detect when parameters imply incompatible reference points and just reject the update rather than applying a cap that ends up moving the price.

Curious how others think about this kind of issue, especially for assets like stETH/wstETH where the expected exchange rate growth is slow but monotonic.

The guardrail system itself effectively becomes part of the pricing system, so being internally consistent and relying less on keepers and offchain targets seems a pretty important part of the threat model.

-------------------------

ApuMallku | 2026-03-11 13:13:27 UTC | #5

I appreciate Chaos Labs for providing the post-mortem. However, while technical accuracy is crucial, the current explanation is highly dense and makes it difficult for the broader community to fully grasp the operational breakdown.

Beyond the technical details of a 'misalignment between snapshot ratio and timestamp', the bottom line is that an avoidable configuration oversight triggered $27M in erroneous liquidations, directly impacting 34 of our users.

Aave’s premium reputation relies not just on smart contract security, but on flawless operational execution. As delegates, our duty is to ensure the protocol's integrity and protect our users. To turn this incident into a learning opportunity and ensure true accountability, we need clarity on the operational side of this event.

I kindly request straightforward answers to the following questions:

**1. Deployment Workflow & QA:** Understanding this was a configuration issue during the on-chain deployment, what does the current Quality Assurance (QA) pipeline look like? Which specific entity holds the final sign-off responsibility before a parameter update like this goes live on mainnet?

**2. Simulation and Testing Environments:** Why did our testnet or mainnet-fork simulations fail to catch this 2.85% misalignment before it reached the Core and Prime instances? Moving forward, how are we upgrading our simulation tools to ensure these specific edge cases are caught automatically?

**3. On-Chain Safeguards (Circuit Breakers):** Relying solely on off-chain setup leaves room for human error. Is there a technical limitation preventing us from implementing a hard fail-safe (a circuit breaker) that automatically pauses E-Mode liquidations if there is a sudden, anomalous price deviation compared to fallback feeds (e.g., Chainlink)?

**4. Provider Accountability:** The DAO is rightfully stepping up to make the affected users whole. However, considering previous governance discussions about service providers having *skin in the game*, what is the precedent or standard procedure when an operational oversight by a provider leads to protocol losses? Will the responsible entities be covering a portion of the compensation to the DAO?

Aave is the safest lending market in DeFi because we constantly iterate and improve. We must ensure our deployment standards match the quality of our code. I look forward to your clear and constructive responses.

-------------------------

PrudentiaLabs | 2026-03-11 14:35:30 UTC | #6

After carefully reading the Chaos Labs post mortem, we’d like to raise some questions about the matter.**

Question 1: Did Chaos Labs's Own Governance Proposal Create the Exploitable Condition?**

The February 2025 AIP explicitly introduced the `snapshotRatio` constraint of **3% max relative change per 3-day timelock**, justified by the fact that updates were now coupled. This is the exact constraint that prevented `snapshotRatio` from reaching `~1.2282` in a single update and caused the timestamp/ratio misalignment.

The question is therefore direct: **did the team that designed and proposed this constraint also fail to model its interaction with the 7-day snapshot timestamp targeting logic before deploying it to production?** The coupling of `snapshotRatio` and `maxYearlyRatioGrowthPercent` into a merged timelock was a deliberate architectural choice made by Chaos Labs. The implication that this was a "configuration incident" rather than a "design flaw" becomes difficult to sustain when the configuration space that made the incident possible was itself defined by Chaos Labs in a governance proposal they authored. Can Chaos Labs clarify whether the February AIP's risk analysis explicitly modeled scenarios where the live exchange rate outpaces the maximum convergence speed of the rate-limited update path, and if so, why was no `snapshotTimestamp` alignment guard proposed alongside it?

---

**Question 2: Was the 3% Bound Analytically Derived or Arbitrarily Conservative?**

The February proposal states the 3% per-update bound was chosen to "reflect the fact that updates are now coupled." However, wstETH's exchange rate grows organically at roughly 3-4% annually, meaning the **maximum legitimate 7-day delta is approximately 0.06-0.08%**  far below 3%. Yet in this incident, the required single-update jump was approximately **6.1%** (`~1.1572` to `~1.2282`), which is double the allowed bound.

This raises the question: **what scenario analysis justified a 3% per-update bound as sufficient when the system is designed to use 7-day-old snapshot ratios as anchors?** If the snapshotRatio can legitimately drift more than 3% from its previously configured value within a 7-day window whether due to stale prior configuration, a prior skipped update cycle, or accumulated lag the rate-limiter will structurally fail to converge in a single update. Was this failure mode evaluated during the governance proposal, and if not, what does that say about the adequacy of the risk analysis that accompanied the AIP?

---

**Question 3: Accountability for a Self-Authored Constraint Causing Protocol Harm**

The February AIP was authored by Chaos Labs, passed governance, and was implemented by Chaos Labs as the Risk SP. The constraint introduced in that AIP is the direct mechanical cause of the incident. The post-mortem frames this as an operational misalignment, but the **operational process was executing within the boundaries of a system Chaos Labs designed, proposed, governed, and operated end-to-end.**

The question for the DAO is: **under what framing does Chaos Labs bear zero financial responsibility for an incident caused by a constraint they introduced, in a system they operate, under a service agreement they are compensated for?** The "no bad debt" framing is technically accurate at the protocol level but economically misleading 34 users were liquidated at artificially deflated prices, capturing up to \~498 ETH in value, and the DAO treasury is being asked to cover the gap. Token holders should ask whether the Risk SP agreement includes any provisions for restitution in cases where protocol harm is directly traceable to a governance proposal authored by the SP, and if not, whether that gap in accountability structure should be addressed before the next Risk SP renewal.

-------------------------

ST0X | 2026-03-12 07:13:17 UTC | #7

This wstETH is less painful.

The most dangerous one are USDe oracles which is hard coded to 1:1 against USDT.  Right now USDe is still maintained its peg tightly. But the whole USDe structures has risk that are underestimated.

-------------------------

AlanWestbrook | 2026-03-12 08:35:01 UTC | #8

I think there are still some important questions the community needs clear answers to.

Will Chaos Labs explicitly take responsibility for any part of this incident?
Even if the root cause is described as a parameter misalignment rather than a flaw in the core CAPO concept, this was still an operational and risk-management failure that directly harmed users. If service providers are involved in designing, recommending, or executing these configurations, the community deserves clarity on where responsibility begins and ends. Reimbursement should come first, but accountability should not disappear afterward.

-------------------------

MarcZeller | 2026-03-12 10:08:58 UTC | #9

Hello,

Thanks for this detailled post-mortem. this is an unfortunate turn of event but also an opportunity for Aave to continue to distinguish itself from alternatives.

When something bad happens at Aave, users and community knows that our culture is to fix, learn, improve and compensate.

Risk oracles innovation allowed for order of magnitude new revenue to the protocol than the current shortfall. Given current treasury size and revenue there's no friction to bundle with next treasury management AIP via @TokenLogic a reimbursement to affected users.

The Masiv infrastructure is perfectly fit for this kind of actions as we can implement an "airdrop" for all impacted users allowing them to claim quickly, we can also airdrop aTokens so they will end up with same collateral as before the event.

We will work with tokenlogic to find the most seamless solution for users, the AFC has enough reserves to allow an immediate compensation if that's a path the community want to explore.

in term of responsability, my personal opinion is clear, Risk oracles are a good product, it allowed Aave to increase it's revenue by order of magnitude more than the impact of this issue. Chaos labs is a valued Service provider, these implementations were greenlighted by the DAO via AIPs. Instead of trying to pitchfork, we should have a mindset to learn from this event and implement the necessary guardrails and timelock to make a repeat of this nearly impossible.

-------------------------

_LP17 | 2026-03-12 15:44:32 UTC | #10

From my perspective, this incident clearly reflects a **configuration failure from** @ChaosLabs , and it is difficult to consider this anything other than a **serious operational mistake**.

For a risk provider responsible for critical oracle configurations, this type of misalignment between parameters is **not acceptable and appears highly unprofessional**. These systems are supposed to be designed and operated precisely to prevent this kind of situation.

When a provider receives **around $3M per year in budget** to manage protocol risk, the community should reasonably expect **a much higher standard of operational rigor**. In this case, the incident triggered **roughly $26M–$27M in liquidations**, which raises legitimate concerns about the reliability of the current setup.

I believe it is **important for the DAO to have an open discussion** about whether Chaos Labs should continue as a risk provider. Accountability and transparency are essential, especially when such critical responsibilities are involved.

-------------------------

ChaosLabs | 2026-03-12 16:17:59 UTC | #11

We appreciate the engagement from the community and welcome the opportunity to address the questions raised. We take this incident seriously. Regardless of where the root cause sits across the system's components, we operated the oracle that produced the update, and we accept the responsibility that comes with it.

### Operational Track Record and QA Testing

@ApuMallku @hsim.dev

Chaos Labs operates a robust simulation engine and testing environment that has underpinned Aave’s risk management for over three years. This infrastructure has supported the deployment of multiple Risk Oracles across Aave instances and enabled thousands of parameter updates to be executed safely and without incident. The overall system is designed with multiple layers of safeguards: offchain simulations generate candidate outputs, those outputs are subjected to extensive tests and rule-based validations, and deployment artifacts are then encoded for onchain execution. Once published onchain, updates pass through the standard execution flow and associated validation layers before being applied.

CAPO itself has operated reliably for approximately two years across a broad set of assets and market conditions, consistently protecting against oracle manipulation without false positives or unintended price impacts. This incident does not reflect the system’s normal operating baseline, nor does it indicate a flaw in the core Risk Oracle design. Rather, it arose from a narrow edge case tied to an unusually stale parameter configuration that fell outside the scenario space typically covered under normal operational cadence, and to prevent this from recurring we will extend the simulation and validation framework to more explicitly cover this class of stale-state and constrained-update scenarios.

### Design Failure or Edge Case

@PrudentiaLabs, @Frida, @hsim.dev

The incident arose from an integration gap between offchain and onchain components. In particular, the offchain oracle logic and the onchain enforcement path were not aligned in how they handled updates to the snapshot reference state when the target adjustment was too large to be applied in a single transaction.

This produced a configuration where the timestamp emitted assumed a more advanced anchor than the ratio could support. This edge case was contingent on a `snapshotRatio` that had not been updated for over a year, producing a drift between the stale onchain value and the intended target that exceeded what the rate-limiter could bridge in a single step. Under regular operational cadence, this misalignment cannot arise.

More fundamentally, when the targeted `snapshotRatio` is constrained, enforcing the snapshot directly onchain as the pair (`snapshotTimestamp`, `snapshotRatio`) is itself suboptimal and can be prone to incorrect configurations. Historical snapshot ratios and their associated `snapshotTimestamp` do not reliably correspond to the intended target exchange rate, or even a close approximation of it, because there is no guarantee about when a rate-constrained onchain snapshot could actually have been emitted in the past. In some cases, this construction can even undercut the intended bound.

The 3% bound was analytically derived as a system-wide parameter and not chosen ad hoc. CAPO applies the same onchain `snapshotRatio` update constraint across all covered assets, so the threshold must be robust not just for wstETH, but also for assets with faster accrual dynamics and for configurations that apply over windows longer than 7 days. While wstETH’s own 7-day change is only about 0.06–0.08%, the shared constraint was designed against these broader requirements. A 6.1% required move is therefore not something that would emerge in the course of normal upkeep; it was a consequence of prolonged staleness. We are implementing additional controls to ensure this type of edge case does not recur.

### Mitigation

Following the incident, we immediately handled the situation and implemented multiple mitigation steps to contain further exposure and restore correct oracle behavior:

- Temporarily reduced the wstETH borrow cap to 1 on Aave Core and Aave Prime to limit additional risk while remediation was underway.
- Manually realigned `snapshotRatio` with the current `snapshotTimestamp` reference window via Risk Steward intervention, restoring the oracle to its correct value.

### Prevention Measures

Additionally, we are aiming to implement the following guardrails at both the onchain and offchain levels:

- **Risk Steward escalation protocol**: Where gradual convergence under onchain constraints would require an excessive number of automatic update steps, Risk Steward or Governance intervention will be used to accelerate resolution in a controlled and validated manner.
- **Consistent snapshot construction under constrained updates**: To prevent a recurrence of this edge case, snapshot updates will avoid forcing the nominal target timestamp directly when the corresponding `snapshotRatio` cannot be reached in a single onchain step. Instead, the update process will derive the effective `snapshotTimestamp` that is economically equivalent to the intended target timestamp under unconstrained assumptions, ensuring that the resulting (`snapshotTimestamp`, `snapshotRatio`) pair remains internally consistent while still approximating the intended `maxRatio`.
- **Explicit offchain boundary checks**: We are adding an explicit validation step in the offchain update process to ensure that any candidate onchain configuration cannot imply an exchange rate bound below the current exchange rate plus an expected growth buffer. This is intended to prevent a configuration from being propagated if it would artificially depress the exchange rate cap relative to a reasonable forward expectation.
- **Additional onchain prevention measures**: We are actively discussing with BGD further onchain safeguards that would reduce the possibility or impact of an erroneous CAPO configuration or exchange rate update while preserving the protocol’s core protective function, and will share more information on this in the coming days.

### Compensation

The compensation process, prior to the posting of the post mortem, has been coordinated jointly with ACI, BGD Labs, TokenLogic, and Aave Labs. Funds recovered through BuilderNet refunds, totaling 141.5 ETH in recaptured liquidation bonus revenue, will be applied directly toward reimbursing affected users. Any remaining gap will be covered through the Aave DAO treasury. Active efforts to recoup additional value from liquidation-linked activity are ongoing. A detailed compensation plan has been communicated in the following [post](https://governance.aave.com/t/direct-to-aip-wsteth-capo-oracle-incident-user-reimbursement/24275?u=chaoslabs).

### CAPO’s parameter flexibility

@hsim.dev

It is not a goal of the CAPO system to push the effective exchange rate downward under normal market conditions. The system exists to cap upward deviations that could be used to generate unbacked borrowing power. However, the flexibility for the computed cap to fall below the live rate is a necessary consequence of how the bounding mechanism works, without it, the system could not function as a guardrail against rapid upward manipulation.

On the question of whether a circuit breaker could be introduced to detect anomalous downward deviations and pause liquidations: while the intent behind this suggestion is sound, implementing such a mechanism could in practice interfere with CAPO's core function. The system needs to be able to enforce a cap that may, in edge cases, sit below the live rate in order to reject manipulated prices. There are design approaches for introducing constraints that reduce the hypothetical impact of an erroneous exchange rate outlier update that artificially lowers the exchange rate price, while still preserving CAPO’s core security objective. We are currently discussing such approaches with BGD Labs, and will share more in the coming days on this front.

-------------------------

eboado | 2026-03-12 16:40:12 UTC | #12

Given that, in my opinion, there is too much negativity in the comments—alongside perfectly understandable calls for transparency—I would like to share a few thoughts.

Chaos Labs, like all current service providers of the Aave DAO (for example, ACI, TokenLogic, LlamaRisk, Aave Labs, Certora, etc.), as well as its partners (such as Chainlink and various security providers), has always behaved with total professionalism. Beyond simply “doing the job,” they have consistently tried to move new projects and approaches forward. That proactivity has allowed Aave to remain at the forefront of operational efficiency, product and brand expansion, and even direct and indirect revenue maximization and loss minimization.

Problems like the one disclosed can happen on software, but: 1) Aave’s strong financial position is the result of the collaboration of all service providers, including Chaos; 2) the team has communicated transparently about the issue; and 3) I have no doubt they will improve anything necessary to prevent similar problems in the future. For example, alongside what Chaos has mentioned about improving their off-chain infrastructure, the team has also reached out to us at BGD with multiple suggestions on how to better harmonize the off-chain Risk Oracles infrastructure and risk modelling, with the requirements of the CAPO on-chain smart contracts.

In summary, as I saw their work during the years, I simply believe Chaos is a strong partner acting in the best interests of the Aave DAO, and that should be considered when evaluating the incident.

-------------------------

stani | 2026-03-12 17:19:02 UTC | #13

Echoing the same sentiment, the infrastructure servicing and supporting the Aave Protocol, including the Risk Oracles and CAPO, has performed exceptionally well over the years. Could things be improved in the future? The answer will always be yes, as Aave and its surrounding infrastructure and tooling continue to evolve, as they always have.

For now, however, the existing infrastructure and tooling have protected Aave through multiple market cycles with a stellar and unmatched track record.

When it comes to service providers such as Chaos Labs, BGD, and others, this ecosystem is among the most rigorous, with teams that apply the highest level of diligence in their work. There is no question about that.

The Aave Protocol itself is designed to protect the system even in edge cases, with multiple layers of safeguards such as Umbrella, protocol revenue, and the Aave treasury. No lending system is without risk, which is why the protocol is designed with protection and resilience in mind.

-------------------------

abdulwahed | 2026-03-12 20:13:46 UTC | #14

## The Data Tells a Different Story, Stani

With respect, I've spent 3 months conducting forensic analysis on Aave V3 liquidations (blocks 18M-21M). The data contradicts the "stellar track record" narrative.

---

### 📊 Hard Numbers (Verified On-Chain)

| Metric | Value | Source |
|--------|-------|--------|
| Liquidations analyzed | 623 | On-chain events |
| Unique victims | 354 | Address clustering |
| Documented bribes | **460.27 ETH** (~$800K) | Coinbase transfers |
| Market concentration | 5 liquidators = 70% | Transaction analysis |
| Private mempool rate | **67%** | Block position analysis |
| Top-of-block executions | **61%** | Index 0-2 positioning |
| Worst victim | 22 liquidations in 7 minutes | 0x8fb1f3...9dd1 |
| Largest single bribe | 17 ETH | Block 20456766 |

---

### 🎯 The Question You're Not Answering

You mentioned **Umbrella**, **Protocol Revenue**, and **Treasury** as protection layers.

**But protection for whom?**

- ✅ Protocol is protected from bad debt
- ✅ Liquidators extracted $800K+ in bribes
- ✅ Builders received 460 ETH
- ❌ Users had **< 12 seconds** to react
- ❌ 67% of liquidations were **invisible** (private mempool)
- ❌ Zero grace period, zero warning, zero protection

---

### 📉 The wstETH Incident Proves My Point

This week's Oracle bug caused **141.5 ETH in wrongful liquidations**.

The "multiple layers of safeguards" you mentioned:
- Did NOT prevent stale parameters for **over 1 year**
- Did NOT catch the 6.1% drift before liquidations
- Did NOT protect users from being liquidated at wrong prices

The liquidators? They profited. As always.

---

### 🔍 "Edge Case" or Systemic Design?

You call this an "edge case." My data shows it's **by design**:

**From my forensic analysis:**
Cascade C-045 (August 5, 2024):

35 victims liquidated
In a single cascade
150+ total liquidations that day
Protocol response: ZERO parameter changes


**Black Monday wasn't an edge case. It was a feature.**

---

### ❓ Direct Questions (Data-Based)

1. **Why does Aave have ZERO grace period?**
   - Compound: 1 block grace
   - MakerDAO: Auction delay
   - Liquity: Time-weighted pricing
   - Aave: Instant liquidation → MEV extraction

2. **Why is 67% of liquidation volume through private mempool?**
   - This means users can't even SEE the liquidation coming
   - "Transparency" is meaningless if transactions are private

3. **Why did 5 addresses extract 70% of liquidation value?**
   - This isn't decentralization
   - This is a cartel with block builder relationships

4. **Why was the snapshotRatio stale for over 1 year?**
   - "Highest level of diligence" doesn't explain this
   - Who monitors the monitors?

---

### 💡 What Users Actually Need

Not just Umbrella for the protocol. **Protection for users**:

1. **Grace Period**: Even 1 block (12 seconds) would help
2. **Warning System**: Alert users when HF < 1.1
3. **Rate Limiting**: Prevent cascade liquidations
4. **Transparency**: Publish liquidator relationships with builders
5. **Circuit Breaker**: Pause liquidations during Oracle anomalies

---

### 📋 My Credentials

- Analyzed 3,000,000+ Ethereum blocks
- Documented 600+ liquidation events
- Traced funding chains to "Patient Zero" addresses
- Built forensic tooling (500K+ lines of code)
- Full report available for Aave DAO review

---

### 🎯 Conclusion

The protocol is resilient. The **users** are not.

"No lending system is without risk" is true. But Aave's current design **maximizes risk for users** while **maximizing profit for liquidators**.

The wstETH incident isn't an anomaly. It's what happens when the system works exactly as designed — and the design prioritizes protocol safety over user protection.

I'm happy to share my full forensic report with the DAO. The data speaks for itself.

---

*— Huntkits, Independent Security Researcher*

-------------------------

Frida | 2026-03-13 03:31:20 UTC | #15

The detailed explanation is appreciated, as well as the context provided by the other service providers involved. I hope my previous comment does not fall within the group of comments characterised as “tilted with negativity.”

It is my personal belief that Chaos Labs has delivered high-quality work for the DAO throughout its mandates. The analysis and mitigation steps described here appear consistent with it. 

That said, I believe incidents like this raise two separate questions: the technical resolution and the governance process surrounding accountability and remediation.

Being a service provider to a protocol of Aave’s scale implies a high standard of operational responsibility. This doesn’t necessarily mean CL should make affected users whole. However, when incidents occur, it seems reasonable that questions around potential consequences at least be open for governance discussion. If strong performance leads to expanded scope and compensation over time, it is fair to ask whether the opposite scenario should also be part of the conversation.

More importantly, the process described in the post-mortem feels somewhat off-beat from a governance perspective. To me, this reads less like a proposal and more like a pre-determined course of action. Deciding how an extraordinary situation should be resolved seems to go beyond the mandate of any single service provider, and arguably also beyond the scope of collective coordination among service providers.

[quote="ChaosLabs, post:11, topic:24269"]
The compensation process, prior to the posting of the post mortem, has been coordinated jointly with ACI, BGD Labs, TokenLogic, and Aave Labs. Funds recovered through BuilderNet refunds, totaling 141.5 ETH in recaptured liquidation bonus revenue, will be applied directly toward reimbursing affected users. Any remaining gap will be covered through the Aave DAO treasury. Active efforts to recoup additional value from liquidation-linked activity are ongoing. A detailed compensation plan has been communicated in the following [post](https://governance.aave.com/t/direct-to-aip-wsteth-capo-oracle-incident-user-reimbursement/24275).

[/quote]

-------------------------

abdulwahed | 2026-03-13 13:32:37 UTC | #16

## A Technical Observation on Liquidation Design

**The Core Tradeoff:**

Instant liquidation → Maximum protocol safety → Minimal user reaction time

This is a valid and defensible design choice. However, it is not the only viable design paradigm.

---

### Alternative Models (Comparative Perspective)

| Protocol | Mechanism | User Window |
|----------|-----------|-------------|
| Aave | Instant | 0 blocks |
| Compound | Partial grace | 1 block |
| MakerDAO | Auction delay | ~10 minutes |
| Liquity | Stability pool | Price-buffered |

Each approach reflects a different balance between solvency protection and user reaction capacity.

---

### Proposed Hybrid: Conditional Grace Model
if (HF < 1.0 && HF > 0.95):
grace_period = 1 block
notify_user()
else if (HF <= 0.95):
instant_liquidation()  // Protocol safety preserved

**Expected Outcome:**

- Users experiencing marginal HF breaches receive a brief reaction window (~12 seconds)
- Deeply undercollateralized positions remain subject to immediate liquidation
- Protocol solvency assumptions remain intact
- MEV extraction is reduced primarily in borderline cases

---

### Mathematical Expectation

Based on observed HF distribution at liquidation:

- ~30% of liquidations occur within HF range 0.95–1.0
- The grace mechanism would affect only this subset
- Estimated incremental bad debt risk: negligible (median per-block price drift < 0.5%)

The model is:

- Simple
- Backward-compatible
- Empirically testable

Further simulation on historical datasets could quantify tradeoffs more precisely.

---

*— Huntkits*

-------------------------

ST0X | 2026-03-15 07:50:36 UTC | #17

Some very good analysis above and pointed to an ACI era problem with AAVE:

A–LP comes last and AAVE protocol’s interest come first.

B– There is no check and balance on SPs since these not happy with ACI will get kicked out or forced out gradually.

Chaos lab has made an error which is medium and can be avoided by more careful checks/simulations. Usually professionals, including SPs shall not be liable directly to the loss if there isn’t willful act of manipulation or gross negligence on their side.

As the largest lending protocol right now, stakeholders are expecting much higher working standard than rubber stamping on SPs. The protocol did experience growth during last 3 years but that’s shall be viewed from a risk/reward perspective. A lot of growth are just unsustainable like Ethena.

We have seen enough during ACI era and hope this will improve gradually.

-------------------------

LlamaRisk | 2026-03-16 20:15:34 UTC | #18

### Executive Summary

On March 10, 2026, a newly deployed CAPO Risk Agent pushed a parameter update that artificially depressed the wstETH oracle price by approximately 2.85%, triggering roughly $26.6 million in liquidation volume across Aave V3 Core and Prime markets. LlamaRisk detected the anomalous liquidation activity within minutes and immediately flagged the issue to other service providers. While we have completed our own independent post-mortem, we defer to @ChaosLabs' published report to avoid redundancy. We believe this incident highlights meaningful room for improvement in how automated risk systems operating under delegated governance authority are tested, validated, and overseen. This response outlines our assessment of the root cause, opportunities to strengthen testing and transparency standards across delegated risk infrastructure, and the structural changes we believe are necessary to prevent recurrence, including LlamaRisk co-signing authority through the `RiskSteward` role.

### Detection and Initial Response

LlamaRisk detected the anomalous liquidation activity within minutes on March 10 and immediately flagged the issue to other service providers. Upon identifying the liquidations, we initiated an internal war room focused on two priorities: determining whether the incident was contained to the wstETH adapter on Core and Prime, or whether other CAPO-protected markets were similarly at risk. We also began work on our own independent post-mortem and impact analysis.

![Observed oracle deviation vs. Market Price|1999x843](upload://1piC03AalS7aUrgzSSEMqpVeC9d.png)
Observed oracle deviation vs. Market Price

### Root Cause

The onchain rate-limiting constraint on `snapshotRatio` updates (a maximum 3% increase every 3 days) is a known, static property of the smart contract. The offchain risk oracle, under Chaos Labs' purview, is responsible for computing parameter updates that satisfy these constraints. The agent pushed a `snapshotTimestamp` that assumed a 7-day-old anchor while the corresponding `snapshotRatio` could not be updated to the matching value in a single transaction. In our assessment, the root cause traces back to the offchain system producing a configuration that was inconsistent with the onchain constraints it was operating within. We raise this not to assign blame, but because precise root-cause attribution is essential for the Aave protocol to understand what needs to change and where.

### Opportunities to Strengthen Pre-Deployment Validation

This failure mode was deterministic and reproducible, the type of issue that pre-execution simulation is specifically designed to catch. Running the proposed parameter update against a forked mainnet environment and checking whether `isCapped()` would return true, or simply verifying that the resulting `maxRatio` exceeded the current live exchange rate, which would have surfaced the issue before any transaction was broadcast.

As this was the first update pushed by the CAPO Risk Agent, it presents a valuable learning opportunity to establish robust validation as a standard requirement for both initial deployments and ongoing operations. The Aave protocol should expect, at a minimum, that any automated agent operating with delegated governance authority over pricing infrastructure runs pre-execution simulation checks as standard practice.

### Strengthening Independent Oversight and Transparency

While the Risk Agent's methodologies are typically posted on the governance forum at the proposal stage, it is currently not possible for LlamaRisk or any other party to independently verify the offchain code executed. The agent's internal parameters, calibration logic, and decision pipeline are not yet open to independent verification. We can observe what lands onchain, but we cannot audit what generates it.

We believe this is an area where the ecosystem would benefit from greater transparency. Two weeks prior, we documented that the Slope2 Risk Oracle [exhibited behavior that diverged from its published specification](https://governance.aave.com/t/retro-weth-utilization-spike-and-slope2-risk-oracle-performance/24101) during the WETH utilization spikes of February 2026, reducing slope2 under stress rather than escalating it, and remaining below its stated floor for over 125 hours. That experience, together with this CAPO incident, suggests that the current oversight framework would benefit from greater visibility into offchain systems, enabling divergences to be identified earlier in the process.

### LlamaRisk's Role Going Forward

With @bgdlabs' departure, Aave protocol’s operational resilience depends more than ever on ensuring that critical infrastructure benefits from meaningful external checks, regardless of the operator. Today, LlamaRisk's visibility is limited to onchain contracts and transactions. We have no access to the internal agent parameters, no co-signing authority over `RiskSteward` operations, and no mechanism for mandatory pre-execution review. Our current oversight capacity is structurally limited to what is observable onchain, which constrains the value we can deliver to the Aave protocol.

With that in mind, we'd like to offer the following recommendations:

* **Adding LlamaRisk to the RiskSteward co-signing role.** Current signers will need to be rotated due to @ACI and @bgdlabs departures, and this presents a natural opportunity to incorporate independent validation of mission-critical parameter updates before execution. We would welcome the opportunity to serve in this capacity.
* **Pre-deployment failure mode reviews for future delegations of parameter authority.** Before new Risk Agents are approved, we believe the Aave protocol would benefit from an independent, publicly documented analysis evaluating behavior under worst-case allowable parameter values — explicitly asking: *what happens if the agent pushes the most extreme update its onchain constraints permit?* For the CAPO agent, this would have revealed that the `snapshotTimestamp`/`snapshotRatio` rate-limited interaction could result in an artificially capped price.
* **A review of live Risk Agents.** Even without access to offchain agent code, a useful review can be conducted of each agent's onchain integration points, permissioned roles, rate-limiting bounds, and a failure-mode analysis assessing the consequences if each agent pushes the worst allowable values within its current constraints.
* **Private review of Risk Agent testing suites.** To move beyond reactive post-incident analysis toward more proactive oversight, it would be valuable for LlamaRisk to privately review the testing and validation suites underpinning Risk Agent deployments. This would help build confidence across stakeholders without requiring full disclosure of proprietary logic, while meaningfully expanding the surface area that independent review can cover.

Aave protocol has entrusted multiple service providers precisely so that no single point of failure can put user funds at risk. That design works best when oversight mechanisms are empowered with the access and authority to fulfill their mandate.

### Disclaimer

This review was independently prepared by LlamaRisk, a community-led decentralized organization funded in part by the Aave DAO. LlamaRisk is not directly affiliated with the protocol(s) reviewed in this assessment and did not receive any compensation from the protocol(s) or their affiliated entities for this work.

The information provided should not be construed as legal, financial, tax, or professional advice.

-------------------------

