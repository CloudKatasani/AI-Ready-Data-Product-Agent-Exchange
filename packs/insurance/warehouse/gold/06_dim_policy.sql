-- Policy dimension: conformed line, agency and policyholder keys, in-force flag (BR-INS-013) and tenure from original inception.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_POLICY AS
SELECT row_number() OVER (ORDER BY p.policy_id) AS policy_key, p.policy_id, h.policyholder_key, a.agency_key, l.line_key,
       p.region, p.state, p.segment, p.channel, a.agency_name, p.line_of_business, l.statement_line,
       p.annual_premium, p.insured_value, p.cat_zone, p.inception_date, p.term_start,
       date_diff('day', p.inception_date, GOVERNANCE.as_of()) / 365.25 AS tenure_years,
       p.policy_status, p.policy_status = 'In force' AS in_force,
       p.renewal_outcome, p.renewal_due, p.renewed, h.multi_line
FROM CURATED_SILVER.INSURANCE_POLICY p
JOIN CONFORMED_GOLD.DIM_POLICYHOLDER h ON h.policyholder_id = p.policyholder_id
LEFT JOIN CONFORMED_GOLD.DIM_AGENCY a ON a.agency_id = p.agency_id
LEFT JOIN CONFORMED_GOLD.DIM_LINE l ON l.line_of_business = p.line_of_business;
