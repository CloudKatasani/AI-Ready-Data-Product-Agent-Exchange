-- NPS survey responses, one per surveyed ticket (latest answer wins).
CREATE OR REPLACE TABLE CURATED_SILVER.SURVEY_RESPONSE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SURVEY_RESPONSE
  QUALIFY row_number() OVER (PARTITION BY response_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT response_id, ticket_id, response_ts, nps_score,
       CURATED_SILVER.canon(survey_channel, ['Email', 'In-app', 'SMS']) AS survey_channel, _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY ticket_id ORDER BY _loaded_at DESC, response_id DESC) = 1;
