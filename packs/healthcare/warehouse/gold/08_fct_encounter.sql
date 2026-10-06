-- One row per discharged inpatient encounter (index admission grain); patients still in house are excluded.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_ENCOUNTER AS
SELECT row_number() OVER (ORDER BY e.encounter_id) AS encounter_key, e.encounter_id, p.patient_key, f.facility_key,
       CAST(strftime(e.discharge_date, '%Y%m%d') AS INTEGER) AS date_key, e.admit_ts, e.discharge_date,
       e.los_days, e.gmlos_days, e.service_line, e.condition_cohort, e.discharge_disposition, e.payer_class,
       p.age_band, e.readmit_30d, e.planned_readmission
FROM CURATED_SILVER.ENCOUNTER e
JOIN CONFORMED_GOLD.DIM_FACILITY f ON f.facility_id = e.facility_id
LEFT JOIN CONFORMED_GOLD.DIM_PATIENT p ON p.mrn = e.patient_mrn
WHERE e.discharge_date <= GOVERNANCE.as_of();
