-- One row per care unit per day: midnight census against staffed beds, and nursing hours by source.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_UNIT_DAY AS
SELECT row_number() OVER (ORDER BY s.unit_id, s.shift_date) AS unit_day_key, u.unit_key, u.facility_key,
       CAST(strftime(s.shift_date, '%Y%m%d') AS INTEGER) AS date_key, s.shift_date, s.census, s.staffed_beds,
       s.worked_hours, s.overtime_hours, s.agency_hours, s.target_hppd, round(s.census * s.target_hppd, 1) AS target_hours
FROM CURATED_SILVER.STAFFING_DAY s
JOIN CONFORMED_GOLD.DIM_UNIT u ON u.unit_id = s.unit_id;
