-- Thirty-day feature adoption for active customers, with the feature catalogue (name, category, minimum
-- plan tier) and whether the account's plan entitles it to the feature.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_FEATURE_ADOPTION AS
WITH catalogue AS (
  SELECT * FROM (VALUES
    ('FT-01', 'Dashboards', 'Core', 'Starter'),
    ('FT-02', 'Workflow automation', 'Core', 'Starter'),
    ('FT-03', 'Shared workspaces', 'Collaboration', 'Starter'),
    ('FT-04', 'Mobile app', 'Collaboration', 'Starter'),
    ('FT-05', 'Advanced analytics', 'Analytics', 'Growth'),
    ('FT-06', 'API and webhooks', 'Integrations', 'Growth'),
    ('FT-07', 'Single sign-on', 'Security', 'Scale'),
    ('FT-08', 'Sandbox environments', 'Integrations', 'Scale'),
    ('FT-09', 'AI Assistant', 'AI', 'Growth'),
    ('FT-10', 'Audit log export', 'Security', 'Enterprise')
  ) c(feature_code, feature_name, feature_category, min_plan_tier)
), tiers AS (
  SELECT * FROM (VALUES ('Starter', 1), ('Growth', 2), ('Scale', 3), ('Enterprise', 4)) t(plan_tier, tier_rank)
)
SELECT row_number() OVER (ORDER BY f.account_id, f.feature_code) AS feature_adoption_key, a.account_key,
       f.feature_code, c.feature_name, c.feature_category, c.min_plan_tier,
       ta.tier_rank >= tm.tier_rank AS entitled, f.events_30d > 0 AS adopted, f.events_30d, f.last_event_date
FROM CURATED_SILVER.FEATURE_USAGE f
JOIN CONFORMED_GOLD.DIM_ACCOUNT a ON a.account_id = f.account_id
JOIN catalogue c ON c.feature_code = f.feature_code
JOIN tiers ta ON ta.plan_tier = a.plan_tier
JOIN tiers tm ON tm.plan_tier = c.min_plan_tier
WHERE a.customer_status = 'Active';
