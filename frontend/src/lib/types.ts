export type Incident = {
  incident_id: number; sponsor: string; title: string; chain_id: number; rpcs: string[]; pools: string[];
  event_topic0: string; collateral_assets: string[]; from_block: number; to_block: number; faulty_oracle: string;
  formula: string; formula_param: string; bonus_bps: number; debt_rates: Record<string, string>;
  scale_num: string; scale_den: string; terms_sha256: string; proposal_url: string; proposal_text_url: string;
  claim_end: number; appeal_end: number; appeal_stake: string; created_at: number; settled: boolean; closed: boolean;
  claims: number; accounts: number; appeals: number;
};
export type Claim = {
  claim_id: number; incident_id: number; tx_hash: string; log_index: number; block: number; pool: string;
  borrower: string; code_kind: string; debt_asset: string; collateral: string; debt: string; owed_src: string;
  owed_gen: string; status: "ACCEPTED" | "EXCLUDED_CONTRACT" | "APPROVED_ON_APPEAL"; beneficiary: string;
  credited_gen: string; topup_gen?: string; filer: string; filed_at: number; appeals: number;
};
export type Account = {
  borrower: string; claims: number; owed_src: string; owed_gen: string; withheld_gen: string; credited_gen: string;
  beneficiary: string; beneficiary_claimable: string; beneficiary_withdrawn: string; made_whole: boolean; claim_ids?: number[];
};
export type Appeal = {
  appeal_id: number; claim_id: number; incident_id: number; appellant: string; stake: string;
  decision: "ELIGIBLE" | "NOT_ELIGIBLE" | "INCONCLUSIVE"; clause_id: string; clause_sha256: string; beneficiary: string;
  view: string; code_check: string; argument_sha256: string; evidence_links: number; filed_at: number; wallet_type?: string;
};
export type Pool = {
  pool_wei: string; owed_accepted_wei: string; owed_withheld_wei: string; owed_total_wei: string; oversubscribed: boolean;
  settled: boolean; ratio_num: string; ratio_den: string; credited_wei: string; closed: boolean;
  returned_to_sponsor_wei: string; undistributed_wei: string; shortfall_wei?: string; topped_up_wei?: string;
};
export type Reproduction = {
  computed_total_src_wei: string; published_total_src_wei: string; difference_src_wei: string; difference_ppm: string;
  accounts_found: number; published_accounts: number; claims: number;
};
export type Ledger = {
  balance_wei: string; open_stakes_wei: string; claimable_wei: string; undistributed_wei: string; withdrawn_wei: string;
  invariant: string; invariant_holds: boolean; on_chain_balance_wei: string;
};
