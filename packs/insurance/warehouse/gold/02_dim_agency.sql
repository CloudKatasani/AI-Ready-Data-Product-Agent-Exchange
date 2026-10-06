-- Agency dimension with the number of policies each agency services.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_AGENCY AS
WITH book AS (SELECT agency_id, count(*) AS policies_serviced FROM CURATED_SILVER.INSURANCE_POLICY GROUP BY agency_id)
SELECT row_number() OVER (ORDER BY a.agency_id) AS agency_key, a.agency_id, a.agency_name, a.region, a.channel, a.appointed_year,
       coalesce(b.policies_serviced, 0) AS policies_serviced
FROM CURATED_SILVER.AGENCY a
LEFT JOIN book b ON b.agency_id = a.agency_id;
