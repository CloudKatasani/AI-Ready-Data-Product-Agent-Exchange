CREATE OR REPLACE TABLE CURATED_SILVER.SERVICE_CONTACT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_SERVICE_CONTACT
  QUALIFY row_number() OVER (PARTITION BY contact_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT contact_id, policyholder_id, contact_ts, CAST(contact_ts AS DATE) AS contact_date,
       CURATED_SILVER.canon(contact_channel, ['Phone', 'Chat', 'Agency office', 'Mobile app', 'Email']) AS contact_channel,
       CURATED_SILVER.canon(contact_reason, ['Billing question', 'Policy change', 'Claim status', 'Coverage question', 'Complaint', 'Cancellation request']) AS contact_reason,
       first_contact_resolved, handle_minutes, trim(contact_notes) AS contact_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
