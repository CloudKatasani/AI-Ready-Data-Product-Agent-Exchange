-- Branch dimension with the relationship managers based there.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_BRANCH AS
WITH rms AS (SELECT branch_id, count(*) AS rm_count FROM CURATED_SILVER.RELATIONSHIP_MANAGER GROUP BY branch_id)
SELECT row_number() OVER (ORDER BY b.branch_id) AS branch_key, b.branch_id, b.branch_name, b.city, b.region, b.branch_type, b.open_year,
       coalesce(r.rm_count, 0) AS rm_count
FROM CURATED_SILVER.BRANCH b
LEFT JOIN rms r ON r.branch_id = b.branch_id;
