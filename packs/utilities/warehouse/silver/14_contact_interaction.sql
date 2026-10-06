CREATE OR REPLACE TABLE CURATED_SILVER.CONTACT_INTERACTION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CC_INTERACTION
  QUALIFY row_number() OVER (PARTITION BY interaction_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT interaction_id, customer_no, interaction_ts,
       CURATED_SILVER.canon(channel, ['Phone', 'Chat', 'Email', 'IVR']) AS channel,
       CURATED_SILVER.canon(reason, ['High bill', 'Outage', 'Payment arrangement', 'Move in/out', 'Meter issue', 'Other']) AS reason,
       handle_seconds, csat, trim(agent_notes) AS agent_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
