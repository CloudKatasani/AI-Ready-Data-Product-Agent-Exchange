-- Item master: deduplicated CDC, categories conformed and rolled up to departments.
CREATE OR REPLACE TABLE CURATED_SILVER.MERCH_ITEM AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MDM_ITEM
  QUALIFY row_number() OVER (PARTITION BY item_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), conformed AS (
  SELECT *, CURATED_SILVER.canon(category, ['Bedding', 'Bath', 'Kitchenware', 'Home decor', 'Womenswear', 'Menswear', 'Kidswear', 'Snacks', 'Beverages',
                                            'Pantry staples', 'Personal care', 'Cosmetics', 'Garden & outdoor', 'Seasonal decor']) AS category_c
  FROM latest WHERE _op <> 'D'
)
SELECT item_id, trim(item_desc) AS item_desc, category_c AS category,
       CASE WHEN category_c IN ('Bedding', 'Bath', 'Kitchenware', 'Home decor') THEN 'Home'
            WHEN category_c IN ('Womenswear', 'Menswear', 'Kidswear') THEN 'Apparel'
            WHEN category_c IN ('Snacks', 'Beverages', 'Pantry staples') THEN 'Food & pantry'
            WHEN category_c IN ('Personal care', 'Cosmetics') THEN 'Health & beauty'
            ELSE 'Seasonal & outdoor' END AS department,
       CURATED_SILVER.canon(brand_type, ['Private label', 'National brand']) AS brand_type,
       vendor_id, unit_cost, unit_price,
       CURATED_SILVER.canon(lifecycle_status, ['Active', 'Seasonal', 'Discontinued']) AS lifecycle_status,
       launch_date, _loaded_at AS loaded_at
FROM conformed;
