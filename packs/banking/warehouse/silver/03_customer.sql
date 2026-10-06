-- Customer information file: deduplicated CDC, names title-cased, codes conformed, status and digital flag decoded.
CREATE OR REPLACE TABLE CURATED_SILVER.CUSTOMER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CORE_CUSTOMER
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT customer_id,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, phone, CURATED_SILVER.proper(street_address) AS street_address, date_of_birth, ssn,
       home_branch_id, CURATED_SILVER.canon(region, ['Mountain', 'Plains', 'Great Lakes', 'Southeast']) AS region,
       CURATED_SILVER.canon(segment, ['Mass market', 'Mass affluent', 'Private client', 'Small business']) AS segment,
       CASE status_code WHEN 'A' THEN 'Active' WHEN 'C' THEN 'Closed' ELSE 'Dormant' END AS status,
       digital_flag = 'Y' AS digital_active, products_held, relationship_balance,
       CURATED_SILVER.canon(kyc_risk_rating, ['Low', 'Medium', 'High']) AS kyc_risk_rating,
       kyc_last_review, open_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
