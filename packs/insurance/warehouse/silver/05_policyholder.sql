-- Party master: deduplicated CDC, names title-cased, email lower-cased, codes conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.POLICYHOLDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PAS_POLICYHOLDER
  QUALIFY row_number() OVER (PARTITION BY policyholder_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT policyholder_id,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, phone, CURATED_SILVER.proper(street_address) AS street_address, date_of_birth, license_number,
       upper(trim(state)) AS state, CURATED_SILVER.canon(region, ['Northeast', 'Midwest', 'South', 'West']) AS region,
       CURATED_SILVER.canon(segment, ['Personal', 'Commercial']) AS segment,
       digital_registered, customer_since, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
