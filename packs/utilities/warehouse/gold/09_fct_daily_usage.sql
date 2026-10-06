CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_DAILY_USAGE AS
SELECT p.premise_key, CAST(strftime(r.read_date, '%Y%m%d') AS INTEGER) AS date_key, r.read_date,
       r.kwh, r.peak_kw, r.intervals_expected, r.intervals_valid,
       round(100.0 * r.intervals_valid / r.intervals_expected, 3) AS read_success_pct
FROM CURATED_SILVER.METER_READ_DAILY r
JOIN CONFORMED_GOLD.DIM_PREMISE p ON p.meter_id = r.meter_id;
