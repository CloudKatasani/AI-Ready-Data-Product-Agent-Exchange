CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_POSITION AS
SELECT row_number() OVER (ORDER BY position_id) AS position_key, position_id, department, region, job_family,
       is_filled AS filled, vacant_days, agency_cover, incumbent_name
FROM CURATED_SILVER.STAFF_POSITION;
