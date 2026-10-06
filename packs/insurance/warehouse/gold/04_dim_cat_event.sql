-- Catastrophe code list plus a key-0 member for non-catastrophe losses, so every ledger row joins.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CAT_EVENT AS
SELECT 0 AS cat_event_key, 'NONE' AS event_code, 'Non-catastrophe' AS event_name, 'Non-catastrophe' AS peril, 'All regions' AS footprint,
       CAST(NULL AS DATE) AS start_date, CAST(NULL AS DATE) AS end_date
UNION ALL
SELECT row_number() OVER (ORDER BY event_code), event_code, event_name, peril, footprint, start_date, end_date
FROM CURATED_SILVER.CAT_EVENT;
