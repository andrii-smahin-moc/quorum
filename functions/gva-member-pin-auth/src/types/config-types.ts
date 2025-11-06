export interface DataDogConfig {
  callRetries: number;
  customer: string;
  ddApiKey: string;
  functionName: string;
  isDevMode: boolean;
  requestTimeout: number;
  retryDelay: number;
  siteId: string;
  version: string;
}

export interface GliaConfig {
  apiDomain: string;
  liveOperatorQueueID: string;
  siteId: string;
  userApiKey: string;
  userApiKeySecret: string;
  kvStorageRepository: string;
}

export interface GVAGoals {
  needToAuthentication: string;
  alreadyAuthenticated: string;
  successfullyVerifiesMemberNumberAndPin: string;
  enterAPin: string;
  enterOTPCode: string;
  invalidMemberNumber: string;
  invalidPin: string;
  forgotPin: string;
  transferToLiveOperator: string;
  zeroPress: string;
  pinAttemptExceeded: string;
  otpFlowStart: string;
  invalidOtpIdentifier: string;
  invalidOtp: string;
}

export interface GliaAIConfig {
  detectOptionPrompt: string;
  detectSystemMessage: string;
  detectConfidence: number;
  temperature: number;
  maxTokens: number;
  model: string;
  stopSequences: string[];
}

export interface LynktekConfig {
  lynktekApiDomain: string;
  lynktekApiHeader: string;
  defaultPin: string;
  otpIdentifierType: string;
}

export interface FunctionConfig {
  callRetries: number;
  dataDog: DataDogConfig;
  glia: GliaConfig;
  gliaAI: GliaAIConfig;
  gvaGoals: GVAGoals;
  requestTimeout: number;
  retryDelay: number;
  inputValidationFailedAttemptsLimit: number;
  lynktekConfig: LynktekConfig;
}
