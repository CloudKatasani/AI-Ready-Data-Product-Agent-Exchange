-- One row per sampled site-day of OSS counters.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_NETWORK_DAILY AS
SELECT row_number() OVER (ORDER BY k.kpi_id) AS network_day_key, k.kpi_id, c.site_key,
       CAST(strftime(k.kpi_date, '%Y%m%d') AS INTEGER) AS date_key, k.kpi_date, k.call_attempts, k.dropped_calls, k.setup_failures,
       k.outage_type, k.planned_maintenance, k.downtime_min, 1440 AS scheduled_min, k.data_tb, k.throughput_mbps
FROM CURATED_SILVER.CELL_KPI_DAILY k
JOIN CONFORMED_GOLD.DIM_CELL_SITE c ON c.site_id = k.site_id;
