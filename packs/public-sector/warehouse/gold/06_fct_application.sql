-- One row per benefit application. Processing days = county business days after the complete date up to and
-- including the decision date (weekends and county holidays excluded). date_key is the decision date.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_APPLICATION AS
WITH biz AS (
  SELECT a.application_id, count(d.date) AS processing_days
  FROM CURATED_SILVER.BENEFIT_APPLICATION a
  LEFT JOIN CONFORMED_GOLD.DIM_DATE d ON d.date > a.complete_date AND d.date <= a.decision_date AND d.is_business_day
  WHERE a.decision_date IS NOT NULL
  GROUP BY a.application_id
)
SELECT row_number() OVER (ORDER BY a.application_id) AS application_key, a.application_id, k.constituent_key, o.office_key,
       o.region, CAST(strftime(a.decision_date, '%Y%m%d') AS INTEGER) AS date_key,
       a.program_code,
       CASE a.program_code WHEN 'FA' THEN 'Food Assistance' WHEN 'CA' THEN 'Cash Assistance' WHEN 'MA' THEN 'Medical Assistance'
            WHEN 'CCS' THEN 'Child Care Subsidy' ELSE 'Energy Assistance' END AS program_name,
       a.channel, a.received_date, a.complete_date, a.decision_date, a.decision,
       a.decision_date IS NOT NULL AS decided, a.docs_hold, a.expedited,
       b.processing_days,
       CASE WHEN b.processing_days IS NULL THEN NULL ELSE b.processing_days <= 30 END AS within_standard
FROM CURATED_SILVER.BENEFIT_APPLICATION a
JOIN CONFORMED_GOLD.DIM_OFFICE o ON o.office_id = a.office_id
LEFT JOIN CONFORMED_GOLD.DIM_CONSTITUENT k ON k.constituent_id = a.constituent_id
LEFT JOIN biz b ON b.application_id = a.application_id;
