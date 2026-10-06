-- Program cases: codes conformed and decoded; closed cases carry no pending action.
CREATE OR REPLACE TABLE CURATED_SILVER.CASE_RECORD AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CM_CASE
  QUALIFY row_number() OVER (PARTITION BY case_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT case_id, trim(person_id) AS constituent_id, office_id, region,
         CURATED_SILVER.canon(program_code, ['FA', 'CA', 'MA', 'CCS', 'EA']) AS program_code,
         CURATED_SILVER.proper(caseworker_name) AS caseworker_name, opened_date,
         CASE status_code WHEN 'OP' THEN 'Open' ELSE 'Closed' END AS case_status,
         CURATED_SILVER.canon(pending_action, ['NONE', 'APP', 'REN', 'CHG']) AS pending_code,
         pending_days, _loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT case_id, constituent_id, office_id, region, program_code, caseworker_name, opened_date, case_status,
       CASE WHEN case_status = 'Closed' THEN 'None'
            ELSE CASE pending_code WHEN 'APP' THEN 'New application' WHEN 'REN' THEN 'Renewal' WHEN 'CHG' THEN 'Change report' ELSE 'None' END END AS pending_action,
       CASE WHEN case_status = 'Open' AND pending_code <> 'NONE' THEN pending_days END AS pending_days,
       _loaded_at AS loaded_at
FROM typed;
