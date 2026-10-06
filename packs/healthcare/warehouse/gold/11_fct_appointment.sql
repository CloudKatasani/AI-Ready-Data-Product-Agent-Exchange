CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_APPOINTMENT AS
SELECT row_number() OVER (ORDER BY a.appointment_id) AS appointment_key, a.appointment_id, p.patient_key, pr.provider_key,
       f.facility_key, CAST(strftime(a.appointment_date, '%Y%m%d') AS INTEGER) AS date_key, a.appointment_date,
       a.specialty, a.visit_type, a.status AS appointment_status, a.lead_days,
       a.status = 'Completed' AS completed, a.status = 'No-show' AS no_show, a.status IN ('Cancelled', 'Bumped') AS cancelled
FROM CURATED_SILVER.APPOINTMENT a
JOIN CONFORMED_GOLD.DIM_PROVIDER pr ON pr.provider_id = a.provider_id
JOIN CONFORMED_GOLD.DIM_FACILITY f ON f.facility_id = a.facility_id
LEFT JOIN CONFORMED_GOLD.DIM_PATIENT p ON p.mrn = a.patient_mrn;
