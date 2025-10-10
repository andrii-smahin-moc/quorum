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
  siteId: string;
  userApiKey: string;
  userApiKeySecret: string;
}

export interface GVAGoals {
  needToAuthentication: string;
  alreadyAuthenticated: string;
  successfullyVerifiesMemberNumberAndPin: string;
  enterAPin: string;
  invalidMemberNumber: string;
  invalidPin: string;
  forgotPin: string;
  zeroPress: string;
  pinAttemptExceeded: string;
  transferToLiveOperator: string;
}

export interface GliaAIConfig {
  detectOptionPrompt: string;
  detectConfidence: number;
  temperature: number;
  maxTokens: number;
  stopSequences: string[];
}

export interface QuorumConfig {
  quorumApiDomain: string;
  quorumApiHeader: string;
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
  quorumConfig: QuorumConfig;
}
