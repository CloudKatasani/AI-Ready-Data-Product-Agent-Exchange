-- Account master: CDC duplicates removed, names title-cased, region/segment/vertical/channel conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.CUSTOMER_ACCOUNT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_ACCOUNT
  QUALIFY row_number() OVER (PARTITION BY account_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT account_id, CURATED_SILVER.proper(account_name) AS account_name,
       CURATED_SILVER.canon(region, ['North America', 'EMEA', 'APAC', 'LATAM']) AS region,
       employee_count, CURATED_SILVER.canon(segment, ['Enterprise', 'Mid-Market', 'SMB']) AS segment,
       CURATED_SILVER.canon(industry_vertical, ['Financial services', 'Healthcare', 'Retail', 'Manufacturing', 'Public sector', 'Technology', 'Media']) AS industry,
       CURATED_SILVER.canon(acquisition_channel, ['Outbound', 'Inbound', 'Partner', 'Self-serve']) AS acquisition_channel,
       land_date, health_score, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
