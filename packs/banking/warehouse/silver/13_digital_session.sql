CREATE OR REPLACE TABLE CURATED_SILVER.DIGITAL_SESSION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.DIG_SESSION
  QUALIFY row_number() OVER (PARTITION BY session_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT session_id, customer_id, session_ts, CAST(session_ts AS DATE) AS session_date,
       CURATED_SILVER.canon(digital_channel, ['Mobile app', 'Online banking']) AS digital_channel,
       CURATED_SILVER.canon(feature, ['Balance check', 'Transfers', 'Bill pay', 'Mobile deposit', 'Card controls', 'Statements', 'P2P payments']) AS feature,
       login_success, duration_sec, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
