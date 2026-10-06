-- Conformance helpers used by every Silver build.
-- canon(): map a dirty string (case/padding noise) back to its canonical value list.
-- proper(): title-case free text such as person names and street addresses.
CREATE OR REPLACE MACRO CURATED_SILVER.canon(s, vals) AS coalesce(list_filter(vals, lambda v: lower(v) = lower(trim(s)))[1], trim(s));
CREATE OR REPLACE MACRO CURATED_SILVER.proper(s) AS array_to_string(list_transform(string_split(lower(trim(s)), ' '), lambda w: upper(left(w, 1)) || substr(w, 2)), ' ');
-- CDC rank: a tombstone beats an update beats the insert when load times tie.
CREATE OR REPLACE MACRO CURATED_SILVER.op_rank(op) AS CASE op WHEN 'D' THEN 2 WHEN 'U' THEN 1 ELSE 0 END;
