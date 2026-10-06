-- Claims: CDC deduplicated; reported date and FNOL time derived; open/closed status from cycle time against the
-- as-of date; paid, case reserve and subrogation recoveries split; catastrophe code from the cat-code list.
CREATE OR REPLACE TABLE CURATED_SILVER.CLAIM_HEADER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CLM_CLAIM
  QUALIFY row_number() OVER (PARTITION BY claim_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, least(loss_date + report_lag_days, GOVERNANCE.as_of()) AS reported,
         least(loss_date + report_lag_days, GOVERNANCE.as_of()) + cycle_days <= GOVERNANCE.as_of() AND NOT reopened_flag AS closed
  FROM latest WHERE _op <> 'D'
)
SELECT claim_id, policy_id, adjuster_id, loss_date, CAST(reported AS DATE) AS reported_date,
       CAST(reported AS TIMESTAMP) + to_hours(fnol_hour) AS fnol_ts,
       CASE WHEN closed THEN CAST(reported + cycle_days AS DATE) END AS closed_date,
       CASE WHEN closed THEN cycle_days END AS cycle_days,
       CASE WHEN closed THEN 'Closed' WHEN reopened_flag THEN 'Reopened' ELSE 'Open' END AS claim_status,
       CURATED_SILVER.canon(line_of_business, ['Personal Auto', 'Homeowners', 'Commercial Auto', 'Commercial Property', 'General Liability', 'Workers Compensation']) AS line_of_business,
       trim(cause_of_loss) AS cause_of_loss, trim(handling_team) AS handling_team,
       incurred_loss,
       CASE WHEN closed THEN incurred_loss ELSE round(incurred_loss * paid_share, 2) END AS paid_loss,
       CASE WHEN closed THEN 0 ELSE round(incurred_loss * (1 - paid_share), 2) END AS case_reserve,
       lae_amount, subro_eligible,
       CASE WHEN closed AND subro_eligible THEN round(incurred_loss * recovery_share, 2) ELSE 0 END AS subro_recovered,
       siu_referred, nullif(cat_code, 'NONE') AS cat_code, cat_code <> 'NONE' AS is_catastrophe,
       CURATED_SILVER.proper(claimant_name) AS claimant_name, claimant_phone, _loaded_at AS loaded_at
FROM live;
