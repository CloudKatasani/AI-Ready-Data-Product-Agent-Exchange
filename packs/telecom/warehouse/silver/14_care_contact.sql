CREATE OR REPLACE TABLE CURATED_SILVER.CARE_CONTACT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CARE_CONTACT
  QUALIFY row_number() OVER (PARTITION BY contact_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT contact_id, subscriber_id, contact_ts, CAST(contact_ts AS DATE) AS contact_date,
       CURATED_SILVER.canon(channel, ['Phone', 'Chat', 'Store', 'App']) AS channel,
       CURATED_SILVER.canon(reason, ['Billing', 'Network & coverage', 'Device', 'Plan change', 'Cancellation request']) AS reason,
       handle_min, resolved_first_contact, trim(agent_notes) AS agent_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
