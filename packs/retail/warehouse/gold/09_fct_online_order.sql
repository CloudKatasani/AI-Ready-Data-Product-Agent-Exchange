-- Web-store orders with return and refund outcome; `mature` marks orders whose 30-day return window has closed.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_ONLINE_ORDER AS
SELECT row_number() OVER (ORDER BY o.order_id) AS order_key, o.order_id, m.member_key,
       CAST(strftime(o.order_date, '%Y%m%d') AS INTEGER) AS date_key, o.order_date, o.order_value,
       o.account_type, o.fulfilment_method, o.promised_days, o.delivered_days, o.delivered_on_time,
       o.returned, o.returned_value, o.days_to_refund,
       o.order_date <= GOVERNANCE.as_of() - INTERVAL 30 DAY AS mature
FROM CURATED_SILVER.ONLINE_ORDER o
JOIN CONFORMED_GOLD.DIM_MEMBER m ON m.member_id = o.member_id;
