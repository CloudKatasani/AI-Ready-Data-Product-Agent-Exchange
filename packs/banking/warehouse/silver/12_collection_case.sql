CREATE OR REPLACE TABLE CURATED_SILVER.COLLECTION_CASE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.COLL_CASE
  QUALIFY row_number() OVER (PARTITION BY case_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(outcome, ['Cured', 'Payment plan', 'Charged off', 'Open']) AS oc FROM latest WHERE _op <> 'D'
)
SELECT case_id, loan_id, customer_id, entry_date,
       CURATED_SILVER.canon(loan_segment, ['Residential mortgage', 'Home equity', 'Auto', 'Personal', 'Commercial real estate', 'Commercial & industrial']) AS loan_segment,
       CURATED_SILVER.canon(entry_bucket, ['30-59 DPD', '60-89 DPD', '90+ DPD']) AS entry_bucket,
       CURATED_SILVER.canon(strategy, ['Digital self-service', 'Contact centre', 'Field collections', 'Third-party agency']) AS strategy,
       ptp_made, ptp_made AND ptp_kept_flag AS ptp_kept, oc AS outcome, oc <> 'Open' AS case_closed,
       CASE WHEN oc <> 'Open' THEN days_to_resolve END AS days_to_resolve,
       CASE WHEN oc <> 'Open' THEN recovered_amount ELSE 0 END AS recovered_amount,
       CURATED_SILVER.proper(collector_name) AS collector_name, _loaded_at AS loaded_at
FROM live;
