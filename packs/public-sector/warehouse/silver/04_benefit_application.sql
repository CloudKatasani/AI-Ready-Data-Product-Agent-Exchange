-- Benefit applications: decision date derived from the complete date and decision lag; undecided as of the
-- reporting date are Pending.
CREATE OR REPLACE TABLE CURATED_SILVER.BENEFIT_APPLICATION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ELIG_APPLICATION
  QUALIFY row_number() OVER (PARTITION BY application_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT application_id, trim(person_id) AS constituent_id, office_id, region,
         CURATED_SILVER.canon(program_code, ['FA', 'CA', 'MA', 'CCS', 'EA']) AS program_code,
         CURATED_SILVER.canon(channel, ['Online', 'In person', 'Phone', 'Mail']) AS channel,
         received_date, complete_date, docs_hold, expedited, decision_code, decision_cal_days,
         CAST(complete_date + to_days(decision_cal_days) AS DATE) AS decided_on, _loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT application_id, constituent_id, office_id, region, program_code, channel, received_date, complete_date,
       docs_hold, expedited, decision_cal_days,
       CASE WHEN decided_on <= GOVERNANCE.as_of() THEN decided_on END AS decision_date,
       CASE WHEN decided_on IS NULL OR decided_on > GOVERNANCE.as_of() THEN 'Pending'
            WHEN decision_code = 'A' THEN 'Approved' WHEN decision_code = 'D' THEN 'Denied' ELSE 'Withdrawn' END AS decision,
       _loaded_at AS loaded_at
FROM typed;
