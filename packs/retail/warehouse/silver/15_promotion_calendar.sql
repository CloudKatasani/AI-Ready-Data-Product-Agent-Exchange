CREATE OR REPLACE TABLE CURATED_SILVER.PROMOTION_CALENDAR AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MKT_PROMOTION
  QUALIFY row_number() OVER (PARTITION BY promo_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT promo_id, trim(promo_name) AS promo_name,
       CURATED_SILVER.canon(promo_type, ['Percent off', 'Buy one get one', 'Bundle', 'Clearance']) AS promo_type,
       CURATED_SILVER.canon(category, ['Bedding', 'Bath', 'Kitchenware', 'Home decor', 'Womenswear', 'Menswear', 'Kidswear', 'Snacks', 'Beverages', 'Pantry staples', 'Personal care', 'Cosmetics', 'Garden & outdoor', 'Seasonal decor']) AS category,
       start_date, end_date, discount_pct, vendor_funded, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
