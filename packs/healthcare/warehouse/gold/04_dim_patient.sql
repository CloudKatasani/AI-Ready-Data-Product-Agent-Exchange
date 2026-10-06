-- Conformed patient dimension (PHI): identifiers stay here and are masked by policy; analytics use the bands.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_PATIENT AS
SELECT row_number() OVER (ORDER BY p.mrn) AS patient_key, p.mrn,
       p.first_name, p.last_name, concat(p.first_name, ' ', p.last_name) AS full_name, p.date_of_birth, p.ssn,
       p.email, p.phone, p.street_address, p.sex,
       date_diff('year', p.date_of_birth, GOVERNANCE.as_of()) AS age_years,
       CASE WHEN date_diff('year', p.date_of_birth, GOVERNANCE.as_of()) < 18 THEN '0-17'
            WHEN date_diff('year', p.date_of_birth, GOVERNANCE.as_of()) < 45 THEN '18-44'
            WHEN date_diff('year', p.date_of_birth, GOVERNANCE.as_of()) < 65 THEN '45-64' ELSE '65+' END AS age_band,
       p.home_facility_id, p.region, p.payer_class, p.status, p.portal_enrolled, p.risk_score,
       CASE WHEN p.risk_score >= 60 THEN 'High' WHEN p.risk_score >= 35 THEN 'Rising' ELSE 'Low' END AS risk_band,
       p.registered_date
FROM CURATED_SILVER.PATIENT p;
