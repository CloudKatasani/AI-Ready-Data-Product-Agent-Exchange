CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_DIGITAL_SESSION AS
SELECT row_number() OVER (ORDER BY s.session_id) AS session_key, s.session_id, c.customer_key,
       CAST(strftime(s.session_date, '%Y%m%d') AS INTEGER) AS date_key, s.session_ts, s.digital_channel, s.feature,
       s.login_success, round(s.duration_sec / 60.0, 2) AS duration_min
FROM CURATED_SILVER.DIGITAL_SESSION s
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = s.customer_id;
