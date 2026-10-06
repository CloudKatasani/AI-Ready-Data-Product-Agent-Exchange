-- Policies: line conformed; status decoded from the renewal outcome and cancellation flag (BR-INS-013);
-- original inception never later than the current term.
CREATE OR REPLACE TABLE CURATED_SILVER.INSURANCE_POLICY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PAS_POLICY
  QUALIFY row_number() OVER (PARTITION BY policy_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(renewal_outcome, ['Renewed', 'Lapsed', 'Not yet due']) AS outcome FROM latest WHERE _op <> 'D'
)
SELECT policy_id, policyholder_id, agency_id,
       CURATED_SILVER.canon(region, ['Northeast', 'Midwest', 'South', 'West']) AS region, upper(trim(state)) AS state,
       CURATED_SILVER.canon(segment, ['Personal', 'Commercial']) AS segment,
       CURATED_SILVER.canon(channel, ['Independent agent', 'Captive agent', 'Broker', 'Direct digital']) AS channel,
       CURATED_SILVER.canon(line_of_business, ['Personal Auto', 'Homeowners', 'Commercial Auto', 'Commercial Property', 'General Liability', 'Workers Compensation']) AS line_of_business,
       annual_premium, insured_value, CURATED_SILVER.canon(cat_zone, ['Hurricane', 'Wildfire', 'Severe convective', 'Winter storm']) AS cat_zone,
       least(inception_date, term_start) AS inception_date, term_start,
       outcome AS renewal_outcome, outcome <> 'Not yet due' AS renewal_due, outcome = 'Renewed' AS renewed,
       CASE WHEN outcome = 'Lapsed' THEN 'Lapsed' WHEN cancelled_flag THEN 'Cancelled' ELSE 'In force' END AS policy_status,
       _loaded_at AS loaded_at
FROM live;
