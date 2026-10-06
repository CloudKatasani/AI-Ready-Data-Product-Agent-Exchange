CREATE OR REPLACE TABLE CURATED_SILVER.CARE_CONTACT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_CARE_CONTACT
  QUALIFY row_number() OVER (PARTITION BY contact_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT contact_id, member_id, contact_ts,
       CURATED_SILVER.canon(channel, ['Phone', 'Chat', 'Email', 'Social']) AS channel,
       CURATED_SILVER.canon(reason, ['Where is my order', 'Return or refund', 'Product question', 'Loyalty points', 'Store experience', 'Other']) AS reason,
       handle_seconds, csat, trim(agent_notes) AS agent_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
