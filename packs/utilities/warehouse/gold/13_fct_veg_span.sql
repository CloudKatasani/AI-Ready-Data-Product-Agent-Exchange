CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_VEG_SPAN AS
SELECT row_number() OVER (ORDER BY v.span_id) AS span_key, v.span_id, f.feeder_key,
       CAST(strftime(v.inspected_date, '%Y%m%d') AS INTEGER) AS date_key, v.inspected_date, v.last_trim_date, v.cycle_years,
       CAST(v.last_trim_date + to_years(v.cycle_years) AS DATE) AS next_trim_due,
       v.last_trim_date + to_years(v.cycle_years) < GOVERNANCE.as_of() AS overdue,
       v.risk_score, v.species
FROM CURATED_SILVER.VEGETATION_SPAN v
JOIN CONFORMED_GOLD.DIM_FEEDER f ON f.feeder_id = v.feeder_id;
