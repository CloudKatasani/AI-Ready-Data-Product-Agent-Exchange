-- Constituent master: deduplicated CDC, names title-cased, district conformed, status decoded.
CREATE OR REPLACE TABLE CURATED_SILVER.CONSTITUENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CM_PERSON
  QUALIFY row_number() OVER (PARTITION BY person_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT trim(person_id) AS constituent_id,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       gov_id, lower(trim(email)) AS email, phone, CURATED_SILVER.proper(street_address) AS street_address,
       CURATED_SILVER.proper(city) AS city,
       CURATED_SILVER.canon(region, ['North', 'Central', 'South', 'Riverside']) AS region,
       CURATED_SILVER.canon(age_band, ['Under 18', '18-34', '35-49', '50-64', '65+']) AS age_band,
       household_size,
       CURATED_SILVER.canon(preferred_language, ['English', 'Spanish', 'Vietnamese', 'Somali', 'Tagalog']) AS preferred_language,
       CASE status_code WHEN 'A' THEN 'Active' ELSE 'Inactive' END AS status,
       registered_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
