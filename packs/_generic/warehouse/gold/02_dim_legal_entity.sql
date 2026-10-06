-- Legal entity dimension: region and business unit for every operating company, with a display name.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_LEGAL_ENTITY AS
SELECT row_number() OVER (ORDER BY entity_id) AS entity_key, entity_id,
       concat('Acme ', business_unit, ' ', replace(entity_id, 'LE-', '')) AS entity_name, region, business_unit, incorporated_year
FROM CURATED_SILVER.LEGAL_ENTITY;
