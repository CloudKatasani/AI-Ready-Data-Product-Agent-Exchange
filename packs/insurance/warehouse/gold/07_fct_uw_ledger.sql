-- Underwriting ledger: one row per earned-premium record or claim (accounting month / accident date).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_UW_LEDGER AS
SELECT row_number() OVER (ORDER BY t.txn_id) AS ledger_key, t.txn_id, t.txn_type, p.policy_key, p.line_key,
       coalesce(e.cat_event_key, 0) AS cat_event_key,
       CAST(strftime(t.txn_date, '%Y%m%d') AS INTEGER) AS date_key, t.txn_date,
       t.earned_premium, t.written_premium, t.uw_expense, t.exposure_months,
       t.incurred_loss, t.paid_loss, t.lae_amount, t.claim_count, t.is_catastrophe
FROM CURATED_SILVER.UW_TRANSACTION t
JOIN CONFORMED_GOLD.DIM_POLICY p ON p.policy_id = t.policy_id
LEFT JOIN CONFORMED_GOLD.DIM_CAT_EVENT e ON e.event_code = t.cat_code;
