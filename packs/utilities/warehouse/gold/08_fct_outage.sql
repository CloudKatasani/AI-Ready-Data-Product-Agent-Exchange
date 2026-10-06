-- One row per sustained outage event.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_OUTAGE AS
SELECT row_number() OVER (ORDER BY o.outage_id) AS outage_key, o.outage_id, f.feeder_key, c.crew_key,
       CAST(strftime(o.outage_date, '%Y%m%d') AS INTEGER) AS date_key, o.start_ts,
       o.duration_min, o.customers_affected, o.customer_minutes, o.cause_code,
       CASE o.cause_code WHEN 'VEG' THEN 'Tree contact' WHEN 'EQUIP' THEN 'Equipment failure' WHEN 'ANIMAL' THEN 'Animal'
            WHEN 'WIND' THEN 'Weather - wind' WHEN 'LIGHTNING' THEN 'Lightning' WHEN 'VEHICLE' THEN 'Vehicle accident' ELSE 'Unknown' END AS cause,
       o.major_event_day
FROM CURATED_SILVER.OUTAGE_EVENT o
JOIN CONFORMED_GOLD.DIM_FEEDER f ON f.feeder_id = o.feeder_id
LEFT JOIN CONFORMED_GOLD.DIM_CREW c ON c.crew_id = o.crew_id;
