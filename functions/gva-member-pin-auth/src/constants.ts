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

// // ====== Patterns / Regex ======
// export const IDENTIFIER_REGEX = /(?<!\d)\d{6,12}(?!\d)/; // member id 6–12 digits
// export const OTP_CODE_REGEX = /(?<!\d)\d{6}(?!\d)/;
// export const MEMBER_PIN_REGEX = /(?<!\d)\d{4}(?!\d)/; // classic 4-digit PIN
// export const MEMBER_PIN_4_8_REGEX = /(?<!\d)\d{4,8}(?!\d)/; // to cover the case 4–8, for AI VALID_ENTRY
// export const ZERO_NUMBER = /(?<!\d)0(?!\d)/;
// export const NON_DIGITS_REGEX = /[^\d]+/g;

// // ====== Steps (must match your flow handlers) ====== //
// export const STEPS = {
//   ASK_MEMBER_ID: 'ask_member_id',
//   ASK_PIN: 'ask_pin',
//   CANCEL: 'cancel',
//   FORGOT_PIN: 'forgot_pin',
//   INITIAL: 'initial',
//   TEXT_INPUT: 'text_input', // fallback / re-prompt
//   TRANSFER_TO_HUMAN: 'transfer_to_human',
//   VERIFY_MEMBER_ID: 'verify_member_id',
//   VERIFY_PIN: 'verify_pin',
// } as const;
// export type Step = (typeof STEPS)[keyof typeof STEPS];

// // request-handler.ts should get this name
// export const INITIAL_STEP: Step = STEPS.INITIAL;

// // ====== AI Classification Categories ====== //
// export const AI_CLASSIFICATION = {
//   CANCEL: 'CANCEL',
//   FORGOT_CREDENTIALS: 'FORGOT_CREDENTIALS',
//   REQUEST_HUMAN: 'REQUEST_HUMAN',
//   UNCLEAR: 'UNCLEAR',
//   VALID_ENTRY: 'VALID_ENTRY',
// } as const;
// export type AiClassification = (typeof AI_CLASSIFICATION)[keyof typeof AI_CLASSIFICATION];

// // ====== Titles / Labels ====== //
// export const IdentifierTitles = {
//   ACCOUNT_NUMBER: 'Account Number',
//   CARD_NUMBER: 'Card Number',
//   MEMBER_ID: 'Member ID',
//   PIN: 'PIN',
//   SOCIAL_SECURITY_NUMBER: 'Social Security Number',
// } as const;

// // ====== KV / Context Keys ====== //
// export const CONTEXT_KEYS = {
//   ATTEMPTS_MEMBER_ID: 'ATTEMPTS_MEMBER_ID',
//   ATTEMPTS_PIN: 'ATTEMPTS_PIN',
//   MEMBER_ID: 'MEMBER_ID',
//   PIN: 'PIN',
//   STEP: 'STEP',
// } as const;

// // ====== Limits / Attempts ====== //
// export const MAX_ATTEMPTS = {
//   MEMBER_ID: 3,
//   PIN: 3,
// } as const;

// // ====== Heuristic phrase buckets (backup if AI is down) ====== //
// export const PHRASES = {
//   CANCEL: ['cancel', 'exit', 'stop', 'quit', 'never mind', 'goodbye', 'скасувати', 'вийти', 'стоп', 'досить', 'до побачення'],
//   FORGOT_CREDENTIALS: [
//     "i don't know",
//     "don't know",
//     'i forgot',
//     'forgot',
//     'lost it',
//     'no member id',
//     'no pin',
//     "what's my pin",
//     'help me remember',
//     "i can't remember",
//     'не знаю',
//     'забув',
//     'не пам’ятаю',
//   ],
//   REQUEST_HUMAN: [
//     'speak to someone',
//     'talk to a person',
//     'live agent',
//     'human',
//     'representative',
//     'transfer me',
//     'connect me',
//     'support',
//     'оператор',
//     'живий оператор',
//     'підтримка',
//   ],
// } as const;

// // ====== Utility guards ====== //
// export const looksLikeMemberId = (text: string): boolean => IDENTIFIER_REGEX.test(text);

// export const looksLikePin = (text: string): boolean => MEMBER_PIN_REGEX.test(text) || MEMBER_PIN_4_8_REGEX.test(text);

// // ====== Default prompts (optional) ====== //
// export const PROMPTS = {
//   ASK_MEMBER_ID: 'Please enter your Member ID (6–12 digits).',
//   ASK_PIN: 'Please enter your 4-digit PIN.',
// } as const;

// /**
//  * ====== AI routing map ======
//  * Gives the target step in order how classified current step
//  * Looks as a clear table we can re-use in a aiStepExtractor,
//  * and in a manual keyword fallback.
//  */
// export const AI_NEXT_STEP_MAP: Record<AiClassification, Partial<Record<Step | '*', Step>>> = {
//   [AI_CLASSIFICATION.CANCEL]: {
//     '*': STEPS.CANCEL,
//   },
//   [AI_CLASSIFICATION.FORGOT_CREDENTIALS]: {
//     '*': STEPS.FORGOT_PIN,
//   },
//   [AI_CLASSIFICATION.REQUEST_HUMAN]: {
//     '*': STEPS.TRANSFER_TO_HUMAN,
//   },
//   [AI_CLASSIFICATION.UNCLEAR]: {
//     '*': STEPS.TEXT_INPUT, // or re-prompt of current step?
//   },
//   [AI_CLASSIFICATION.VALID_ENTRY]: {
//     '*': STEPS.ASK_MEMBER_ID, // in case if it is not obvious where we are, start from member id
//     [STEPS.ASK_MEMBER_ID]: STEPS.VERIFY_MEMBER_ID,
//     [STEPS.ASK_PIN]: STEPS.VERIFY_PIN,
//   },
// };

// // Steps ordering (for validation and debag)
// export const STEP_ORDER: Step[] = [
//   STEPS.INITIAL,
//   STEPS.ASK_MEMBER_ID,
//   STEPS.VERIFY_MEMBER_ID,
//   STEPS.ASK_PIN,
//   STEPS.VERIFY_PIN,
//   STEPS.FORGOT_PIN,
//   STEPS.TRANSFER_TO_HUMAN,
//   STEPS.CANCEL,
//   STEPS.TEXT_INPUT,
// ];

// // ====== Shared messages/keys for logs ====== //
// export const LOG_TAGS = {
//   AI_CLASSIFICATION_RESULT: 'AI classified as',
//   AI_CLASSIFICATION_STARTED: 'AI classification started',
//   ROUTING_DECISION: 'Routing decision',
// } as const;
