-- Every revenue line on an account in one shape: the base subscription (start = land date, end = cancellation)
-- plus add-on lines. Recurring add-ons co-term with the base subscription and stop when it is cancelled;
-- one-time professional services keep their own delivery window and form a separate revenue stream.
CREATE OR REPLACE TABLE CURATED_SILVER.SUBSCRIPTION_LINE AS
WITH base AS (
  SELECT * FROM RAW_BRONZE.BILL_SUBSCRIPTION
  QUALIFY row_number() OVER (PARTITION BY subscription_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), base_live AS (
  SELECT subscription_id, account_id, CURATED_SILVER.canon(plan_tier, ['Starter', 'Growth', 'Scale', 'Enterprise']) AS plan_tier,
         seats, start_date, CASE WHEN end_date >= start_date AND end_date <= GOVERNANCE.as_of() THEN end_date END AS end_date, arr_usd,
         CURATED_SILVER.canon(billing_frequency, ['Annual', 'Quarterly', 'Monthly']) AS billing_frequency, _loaded_at
  FROM base WHERE _op <> 'D'
), addon AS (
  SELECT * FROM RAW_BRONZE.BILL_ADDON_LINE
  QUALIFY row_number() OVER (PARTITION BY line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), addon_live AS (
  SELECT a.line_id, a.subscription_id, a.account_id,
         CURATED_SILVER.canon(a.line_type, ['Seat expansion', 'Module cross-sell', 'Seat reduction', 'Professional services']) AS line_type,
         CURATED_SILVER.canon(a.product_family, ['Core Platform', 'Analytics', 'Security', 'Integrations', 'AI Assistant']) AS product_family,
         CURATED_SILVER.canon(a.charge_type, ['Recurring', 'One-time']) AS charge_type,
         a.start_date, a.end_date AS delivery_end_date, a.amount_usd, a._loaded_at
  FROM addon a WHERE a._op <> 'D' AND a.start_date IS NOT NULL
)
SELECT subscription_id AS line_id, subscription_id, account_id, 'Base subscription' AS line_type, 'Core Platform' AS product_family,
       'Subscription' AS revenue_stream, plan_tier, seats, billing_frequency, start_date, end_date, arr_usd AS amount_usd, _loaded_at AS loaded_at
FROM base_live
UNION ALL
SELECT a.line_id, a.subscription_id, a.account_id, a.line_type, a.product_family,
       CASE WHEN a.charge_type = 'One-time' THEN 'Professional services' ELSE 'Subscription' END AS revenue_stream,
       b.plan_tier, NULL AS seats, b.billing_frequency, a.start_date,
       CASE WHEN a.charge_type = 'One-time' THEN a.delivery_end_date ELSE b.end_date END AS end_date,
       a.amount_usd, a._loaded_at AS loaded_at
FROM addon_live a
JOIN base_live b ON b.subscription_id = a.subscription_id
WHERE a.charge_type = 'One-time' OR b.end_date IS NULL OR a.start_date < b.end_date;
