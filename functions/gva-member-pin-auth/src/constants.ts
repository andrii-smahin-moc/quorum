export const IDENTIFIER_REGEX = /(?<!\d)\d{6,12}(?!\d)/;
export const OTP_CODE_REGEX = /(?<!\d)\d{6}(?!\d)/;
export const MEMBER_PIN_REGEX = /(?<!\d)\d{4}(?!\d)/;
export const ZERO_NUMBER = /(?<!\d)0(?!\d)/;
export const INITIAL_STEP = 'initial';

export const IdentifierTitles = {
  ACCOUNT_NUMBER: 'Account Number',
  CARD_NUMBER: 'Card Number',
  SOCIAL_SECURITY_NUMBER: 'Social Security Number',
} as const;
