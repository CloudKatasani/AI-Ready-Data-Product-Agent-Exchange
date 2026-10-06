-- ED visits: patients who left without being seen have no door-to-provider time; only admitted patients board.
CREATE OR REPLACE TABLE CURATED_SILVER.ED_VISIT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ED_TRACKING_VISIT
  QUALIFY row_number() OVER (PARTITION BY ed_visit_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), conformed AS (
  SELECT ed_visit_id, patient_mrn, facility_id, arrival_ts, esi_level,
         CURATED_SILVER.canon(arrival_mode, ['Walk-in', 'Ambulance']) AS arrival_mode,
         door_to_provider_min, left_without_seen,
         CURATED_SILVER.canon(ed_disposition, ['Discharged', 'Admitted', 'Observation', 'Transferred']) AS ed_disposition,
         boarding_min, ed_los_min, _loaded_at AS loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT ed_visit_id, patient_mrn, facility_id, arrival_ts, esi_level, arrival_mode,
       CASE WHEN left_without_seen THEN NULL ELSE door_to_provider_min END AS door_to_provider_min,
       left_without_seen,
       CASE WHEN left_without_seen THEN 'Left without being seen' ELSE ed_disposition END AS ed_disposition,
       CASE WHEN ed_disposition = 'Admitted' AND NOT left_without_seen THEN boarding_min END AS boarding_min,
       ed_los_min, loaded_at
FROM conformed;
