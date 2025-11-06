export const MEMBER_NUMBER_REGEX = /(?<!\d)\d{6,12}(?!\d)/; // member id 6–12 digits
export const IDENTIFIER_REGEX = /(?<!\d)\d{9}(?!\d)/;
export const OTP_CODE_REGEX = /(?<!\d)\d{6}(?!\d)/;
export const MEMBER_PIN_REGEX = /(?<!\d)\d{4}(?!\d)/; // classic 4-digit PIN
export const ZERO_NUMBER = /(?<!\d)0(?!\d)/;

export const GVAGoalSteps = {
  VALIDATE_MEMBER_NUMBER: 'VALIDATE_MEMBER_NUMBER',
  VALIDATE_OTP_CODE: 'VALIDATE_OTP_CODE',
  VALIDATE_OTP_IDENTIFIER: 'VALIDATE_OTP_IDENTIFIER',
  VALIDATE_PIN: 'VALIDATE_PIN',
};

export const INITIAL_STEP = 'InitialStep';

export const AnswerOptionsList = {
  FORGET_THE_PIN: 'forget_the_pin',
  MEMBER_EXIT_OPTION: 'member_exit',
  MEMBER_NUMBER: 'member_number',
  MEMBER_PIN: 'member_pin',
  OTP_CODE: 'otp_code',
  OTP_IDENTIFIER: 'otp_identifier',
  TALK_TO_AGENT_OPTION: 'talk_to_agent',
  ZERO_NUMBER: 'zero_number',
};

export const AnswerSynonyms = {
  FORGET_THE_PIN: ['forgot', 'forget', 'lost', 'no', 'not', 'don'],
  MEMBER_EXIT_OPTION: [
    'exit',
    'quit',
    'finish',
    'end',
    'cancel',
    'abort',
    'nevermind',
    'never mind',
    'stop',
    'bye',
    'goodbye',
    'main menu',
    'menu',
    'back',
    'go back',
    'start over',
    'restart',
    'begin',
  ],
  MEMBER_NUMBER: [MEMBER_NUMBER_REGEX],
  MEMBER_PIN: [MEMBER_PIN_REGEX],
  OTP_CODE: [OTP_CODE_REGEX],
  OTP_IDENTIFIER: [IDENTIFIER_REGEX],
  TALK_TO_AGENT_OPTION: [
    'person',
    'representative',
    'agent',
    'service',
    'support',
    'human',
    'live',
    'chat',
    'operator',
    'technical',
    'tech',
    'customer',
  ],
  ZERO_NUMBER: [ZERO_NUMBER, 'zero'],
};

export const IdentifierTitles = {
  ACCOUNT_NUMBER: 'Account Number',
  CARD_NUMBER: 'Card Number',
  SOCIAL_SECURITY_NUMBER: 'Social Security Number',
};
