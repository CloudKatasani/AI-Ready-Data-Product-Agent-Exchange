-- Loyalty member master: deduplicated CDC, names title-cased, codes conformed, status/app flags decoded.
CREATE OR REPLACE TABLE CURATED_SILVER.LOYALTY_MEMBER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.LOY_MEMBER
  QUALIFY row_number() OVER (PARTITION BY member_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT member_id,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, phone, CURATED_SILVER.proper(street_address) AS street_address,
       CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'Pacific']) AS region,
       CURATED_SILVER.canon(tier, ['Bronze', 'Silver', 'Gold']) AS tier,
       CASE status_code WHEN 'A' THEN 'Active' ELSE 'Lapsed' END AS status,
       app_flag = 'Y' AS app_enrolled, churn_score, points_balance, join_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
