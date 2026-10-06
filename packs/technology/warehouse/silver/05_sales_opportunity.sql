-- Opportunities: deduplicated, types and sources conformed; stage derived from the close date against asOf.
CREATE OR REPLACE TABLE CURATED_SILVER.SALES_OPPORTUNITY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_OPPORTUNITY
  QUALIFY row_number() OVER (PARTITION BY opportunity_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT opportunity_id, account_id, rep_id,
       CURATED_SILVER.canon(opp_type, ['New business', 'Expansion', 'Renewal']) AS opp_type,
       CURATED_SILVER.canon(lead_source, ['Outbound', 'Inbound', 'Partner', 'Event']) AS lead_source,
       created_date, close_date, amount_usd,
       close_date <= GOVERNANCE.as_of() AS is_closed,
       is_won AND close_date <= GOVERNANCE.as_of() AS is_won,
       CASE WHEN close_date > GOVERNANCE.as_of() THEN CURATED_SILVER.canon(open_stage, ['Discovery', 'Solution design', 'Proposal', 'Negotiation'])
            WHEN is_won THEN 'Closed won' ELSE 'Closed lost' END AS stage,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
