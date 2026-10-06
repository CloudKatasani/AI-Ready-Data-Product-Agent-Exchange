-- Authorised positions: incumbent only on filled posts, vacancy age only on vacant posts.
CREATE OR REPLACE TABLE CURATED_SILVER.STAFF_POSITION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HR_POSITION
  QUALIFY row_number() OVER (PARTITION BY position_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT position_id,
       CURATED_SILVER.canon(department, ['Eligibility Services', 'Case Management', 'Public Works', 'Community Development', '311 Contact Center', 'Finance Office', 'Parks & Facilities', 'Solid Waste', 'Code Enforcement', 'Information Technology', 'County Administration', 'Water Utility']) AS department,
       CURATED_SILVER.canon(region, ['North', 'Central', 'South', 'Riverside']) AS region,
       CURATED_SILVER.canon(job_family, ['Eligibility worker', 'Caseworker', 'Inspector', 'Plan reviewer', 'Maintenance worker', 'Engineer', 'Analyst', 'Clerk']) AS job_family,
       is_filled, CASE WHEN NOT is_filled THEN vacant_days END AS vacant_days, NOT is_filled AND agency_cover AS agency_cover,
       CASE WHEN is_filled THEN CURATED_SILVER.proper(incumbent_name) END AS incumbent_name, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
