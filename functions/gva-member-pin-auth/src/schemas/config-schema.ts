import * as v from 'valibot';

export const BaseEnvironmentSchema = v.object({
  CALL_RETRIES: v.optional(v.string()),
  DD_API_KEY: v.string(),
  FDMS_VERSION: v.string(),
  GLIA_API_DOMAIN: v.string(),
  GLIA_USER_API_KEY: v.string(),
  GLIA_USER_API_KEY_SECRET: v.string(),
  IS_DEV_MOD: v.optional(v.string()),
  REQUEST_TIMEOUT: v.optional(v.string()),
  RETRY_DELAY: v.optional(v.string()),
  SITE_ID: v.string(),
  GOAL_NEED_TO_AUTHENTICATION: v.string(),
  GOAL_TRANSFER_TO_LIVE_OPERATOR: v.string(),
  GOAL_ALREADY_AUTHENTICATED: v.string(),
  GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN: v.string(),
  GOAL_ENTER_A_PIN: v.string(),
  GOAL_INVALID_MEMBER_NUMBER: v.string(),
  GOAL_FORGOT_PIN: v.string(),
  GOAL_INVALID_PIN: v.string(),
});
