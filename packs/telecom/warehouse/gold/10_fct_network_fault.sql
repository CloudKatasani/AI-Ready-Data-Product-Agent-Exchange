-- One row per fault ticket; restoration SLA is four hours.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_NETWORK_FAULT AS
SELECT row_number() OVER (ORDER BY f.fault_id) AS fault_key, f.fault_id, c.site_key,
       CAST(strftime(f.raised_date, '%Y%m%d') AS INTEGER) AS date_key, f.raised_ts, f.fault_class, f.severity, f.restored,
       f.restore_hours, f.impacted_subscribers,
       round(f.impacted_subscribers * coalesce(f.restore_hours, 0), 1) AS impacted_subscriber_hours,
       f.restored AND f.restore_hours <= 4 AS restored_within_sla
FROM CURATED_SILVER.NETWORK_FAULT f
JOIN CONFORMED_GOLD.DIM_CELL_SITE c ON c.site_id = f.site_id;
