CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SURVEY AS
SELECT row_number() OVER (ORDER BY r.survey_id) AS survey_key, r.survey_id, p.patient_key, f.facility_key,
       CAST(strftime(r.survey_date, '%Y%m%d') AS INTEGER) AS date_key, r.survey_date, r.overall_rating,
       r.overall_rating >= 9 AS rating_top_box, r.recommend, r.recommend = 'Definitely yes' AS recommend_top_box,
       r.nurse_comm_top_box, r.comments
FROM CURATED_SILVER.SURVEY_RESPONSE r
JOIN CONFORMED_GOLD.DIM_FACILITY f ON f.facility_id = r.facility_id
LEFT JOIN CONFORMED_GOLD.DIM_PATIENT p ON p.mrn = r.patient_mrn;
