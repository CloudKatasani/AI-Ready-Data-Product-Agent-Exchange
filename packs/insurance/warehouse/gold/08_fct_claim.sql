-- Claim fact (claim grain). Claimant name is carried for the claims floor (masking policy MASK_PII).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CLAIM AS
SELECT row_number() OVER (ORDER BY c.claim_id) AS claim_key, c.claim_id, c.fnol_ts, p.policy_key,
       coalesce(e.cat_event_key, 0) AS cat_event_key,
       CAST(strftime(c.loss_date, '%Y%m%d') AS INTEGER) AS date_key, c.loss_date, c.reported_date, c.closed_date,
       c.claim_status, c.claim_status <> 'Closed' AND c.case_reserve > 0 AS is_open, c.claim_status = 'Closed' AS is_closed,
       c.cause_of_loss, c.handling_team, c.cycle_days,
       c.incurred_loss, c.paid_loss, c.case_reserve, c.lae_amount, c.subro_eligible, c.subro_recovered,
       c.siu_referred, c.is_catastrophe, c.incurred_loss >= 50000 AS large_loss,
       c.claimant_name, j.adjuster_name
FROM CURATED_SILVER.CLAIM_HEADER c
JOIN CONFORMED_GOLD.DIM_POLICY p ON p.policy_id = c.policy_id
LEFT JOIN CONFORMED_GOLD.DIM_CAT_EVENT e ON e.event_code = c.cat_code
LEFT JOIN CURATED_SILVER.ADJUSTER j ON j.adjuster_id = c.adjuster_id;
