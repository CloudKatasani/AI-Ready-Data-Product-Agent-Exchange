-- Line-month base movements: month number decoded to the month-end date; movement codes conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.LINE_MONTH AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BSS_LINE_MONTH
  QUALIFY row_number() OVER (PARTITION BY line_month_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT line_month_id, subscriber_id, market_id, plan_id,
       CURATED_SILVER.canon(segment, ['Postpaid', 'Prepaid', 'Broadband']) AS segment,
       CURATED_SILVER.canon(segment, ['Postpaid', 'Prepaid', 'Broadband']) = 'Prepaid' AND dormant_flag AS prepaid_inactive,
       CAST(last_day(DATE '2025-01-01' + to_months(month_no - 1)) AS DATE) AS month_end,
       CURATED_SILVER.canon(movement, ['Retained', 'Voluntary disconnect', 'Port-out', 'Involuntary disconnect', 'Plan migration', 'Gross add']) AS movement,
       save_offer_made, save_offer_made AND save_offer_accepted AS save_offer_accepted,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
