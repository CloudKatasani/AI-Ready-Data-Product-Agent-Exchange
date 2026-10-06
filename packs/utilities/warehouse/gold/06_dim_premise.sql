CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_PREMISE AS
SELECT row_number() OVER (ORDER BY p.premise_id) AS premise_key, p.premise_id, c.customer_key, p.meter_id, f.feeder_key,
       p.premise_type, p.city, coalesce(c.region, f.region) AS region, c.rate_class, c.segment, p.ami_enabled
FROM CURATED_SILVER.PREMISE p
LEFT JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_no = p.customer_no
LEFT JOIN CONFORMED_GOLD.DIM_FEEDER f ON f.feeder_id = p.feeder_id;
