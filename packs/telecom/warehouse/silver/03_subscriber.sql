-- Subscriber master: deduplicated CDC, names title-cased, codes conformed, status decoded. An inactive prepaid line
-- is an active-status prepaid line with no top-up in 60 days (dormant flag from the prepaid platform).
CREATE OR REPLACE TABLE CURATED_SILVER.SUBSCRIBER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_SUBSCRIBER
  QUALIFY row_number() OVER (PARTITION BY subscriber_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(segment, ['Postpaid', 'Prepaid', 'Broadband']) AS seg FROM latest WHERE _op <> 'D'
)
SELECT subscriber_id, account_id,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, msisdn, CURATED_SILVER.proper(street_address) AS street_address, date_of_birth,
       market_id, CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Central', 'West']) AS region, plan_id, seg AS segment,
       CURATED_SILVER.canon(lob, ['Mobile', 'Broadband']) AS lob, plan_price,
       CASE status_code WHEN 'A' THEN 'Active' ELSE 'Disconnected' END AS status,
       seg = 'Prepaid' AND dormant_flag AS prepaid_inactive,
       autopay_flag = 'Y' AS autopay, device_financed, activation_date,
       CURATED_SILVER.canon(contract_type, ['No contract', 'Device agreement', 'Term commitment']) AS contract_type,
       CASE WHEN CURATED_SILVER.canon(contract_type, ['No contract', 'Device agreement', 'Term commitment']) = 'No contract' THEN NULL ELSE contract_end_date END AS contract_end_date,
       churn_propensity, _loaded_at AS loaded_at
FROM live;
