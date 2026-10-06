-- Reserve valuation fact (claim-month grain). Claimant name and phone are carried from the reserving extract;
-- masking is attached in certification (DP-INS-006 FIX-2).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_RESERVE AS
SELECT row_number() OVER (ORDER BY r.valuation_id) AS reserve_key, r.valuation_id, r.claim_id, p.policy_key,
       CAST(strftime(r.valuation_date, '%Y%m%d') AS INTEGER) AS date_key, r.valuation_date, r.accident_year,
       r.case_reserve, r.ibnr_reserve, r.carried_reserve, r.indicated_reserve,
       r.claimant_name, r.claimant_phone
FROM CURATED_SILVER.RESERVE_VALUATION r
JOIN CONFORMED_GOLD.DIM_POLICY p ON p.policy_id = r.policy_id;
