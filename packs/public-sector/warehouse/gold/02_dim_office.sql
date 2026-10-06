-- Office dimension with caseworker denominators at office, district and county scope (caseload).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_OFFICE AS
SELECT row_number() OVER (ORDER BY office_id) AS office_key, office_id, office_name, city, region,
       caseworkers,
       sum(caseworkers) OVER (PARTITION BY region) AS region_caseworkers,
       sum(caseworkers) OVER () AS county_caseworkers,
       residents_served
FROM CURATED_SILVER.SERVICE_OFFICE;
