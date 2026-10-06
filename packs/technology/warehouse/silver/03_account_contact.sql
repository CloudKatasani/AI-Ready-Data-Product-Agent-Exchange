-- Account contacts: deduplicated, names title-cased, emails lower-cased, job titles conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.ACCOUNT_CONTACT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_CONTACT
  QUALIFY row_number() OVER (PARTITION BY contact_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT contact_id, account_id,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, phone,
       CURATED_SILVER.canon(job_title, ['Workspace admin', 'Developer', 'IT manager', 'Finance', 'Executive sponsor', 'Team lead']) AS job_title,
       is_primary, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
