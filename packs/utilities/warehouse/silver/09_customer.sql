-- Customer master: deduplicated CDC, names title-cased, codes conformed, status/paperless decoded.
CREATE OR REPLACE TABLE CURATED_SILVER.CUSTOMER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CIS_CUSTOMER
  QUALIFY row_number() OVER (PARTITION BY customer_no ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT customer_no,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, phone, CURATED_SILVER.proper(street_address) AS street_address,
       CURATED_SILVER.canon(region, ['North', 'South', 'East', 'West', 'Central']) AS region,
       CURATED_SILVER.canon(rate_code, ['RS-1', 'RS-TOU', 'GS-1', 'GS-2']) AS rate_code,
       CASE status_code WHEN 'A' THEN 'Active' ELSE 'Inactive' END AS status,
       paperless_flag = 'Y' AS paperless, churn_score, open_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
