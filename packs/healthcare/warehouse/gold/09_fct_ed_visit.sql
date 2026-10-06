CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_ED_VISIT AS
SELECT row_number() OVER (ORDER BY v.ed_visit_id) AS ed_visit_key, v.ed_visit_id, p.patient_key, f.facility_key,
       CAST(strftime(CAST(v.arrival_ts AS DATE), '%Y%m%d') AS INTEGER) AS date_key, v.arrival_ts,
       concat('ESI ', v.esi_level) AS acuity, v.arrival_mode, v.door_to_provider_min, v.left_without_seen,
       v.ed_disposition, v.ed_disposition = 'Admitted' AS admitted, v.boarding_min, v.ed_los_min
FROM CURATED_SILVER.ED_VISIT v
JOIN CONFORMED_GOLD.DIM_FACILITY f ON f.facility_id = v.facility_id
LEFT JOIN CONFORMED_GOLD.DIM_PATIENT p ON p.mrn = v.patient_mrn;
