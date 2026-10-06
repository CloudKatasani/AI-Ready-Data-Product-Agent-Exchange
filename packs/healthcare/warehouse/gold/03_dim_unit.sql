-- Care unit dimension; region and facility come from the owning facility.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_UNIT AS
SELECT row_number() OVER (ORDER BY u.unit_id) AS unit_key, u.unit_id, u.unit_name, u.unit_type, f.facility_key, f.facility_name,
       f.region, u.staffed_beds, u.target_hppd
FROM CURATED_SILVER.CARE_UNIT u
JOIN CONFORMED_GOLD.DIM_FACILITY f ON f.facility_id = u.facility_id;
