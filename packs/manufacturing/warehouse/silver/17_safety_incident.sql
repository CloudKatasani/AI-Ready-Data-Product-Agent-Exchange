-- Safety incidents: deduplicated, severity conformed; the injured person's name is PII (masked by policy).
CREATE OR REPLACE TABLE CURATED_SILVER.SAFETY_INCIDENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.EHS_INCIDENT
  QUALIFY row_number() OVER (PARTITION BY incident_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT incident_id, plant_id, CURATED_SILVER.bu(business_unit) AS business_unit, incident_date,
       CURATED_SILVER.canon(severity, ['Near miss', 'First aid', 'Recordable', 'Lost time']) AS severity,
       CURATED_SILVER.proper(injured_person) AS injured_person, trim(description) AS description, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
