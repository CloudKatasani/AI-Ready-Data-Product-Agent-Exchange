-- One row per street maintenance work order with its road segment condition and repair target.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_WORK_ORDER AS
SELECT row_number() OVER (ORDER BY w.work_order_id) AS work_order_key, w.work_order_id,
       CAST(strftime(w.reported_date, '%Y%m%d') AS INTEGER) AS date_key, w.reported_date, w.completed_date,
       w.region, w.segment_id, s.functional_class, s.pci,
       CASE WHEN s.pci < 40 THEN 'Poor' WHEN s.pci < 70 THEN 'Fair' ELSE 'Good' END AS pci_band,
       w.work_type,
       CASE w.work_type WHEN 'Pothole repair' THEN 3 WHEN 'Crack seal' THEN 14 WHEN 'Streetlight repair' THEN 7
            WHEN 'Sign replacement' THEN 5 WHEN 'Storm drain cleaning' THEN 10 ELSE 30 END AS target_days,
       w.completed_date IS NOT NULL AS completed, w.repair_days,
       CASE WHEN w.repair_days IS NULL THEN NULL ELSE w.repair_days <= CASE w.work_type WHEN 'Pothole repair' THEN 3 WHEN 'Crack seal' THEN 14 WHEN 'Streetlight repair' THEN 7
            WHEN 'Sign replacement' THEN 5 WHEN 'Storm drain cleaning' THEN 10 ELSE 30 END END AS on_time,
       w.crew_type, w.labor_hours, w.cost_usd, w.crew_lead
FROM CURATED_SILVER.STREET_WORK_ORDER w
LEFT JOIN CURATED_SILVER.ROAD_SEGMENT s ON s.segment_id = w.segment_id;
