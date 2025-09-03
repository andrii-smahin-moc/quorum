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
  transferToLiveOperator: string;
  alreadyAuthenticated: string;
  successfullyVerifiesMemberNumberAndPin: string;
  enterAPin: string;
  invalidMemberNumber: string;
  invalidPin: string;
  forgotPin: string;
}

export interface FunctionConfig {
  callRetries: number;
  dataDog: DataDogConfig;
  glia: GliaConfig;
  gvaGoals: GVAGoals;
  requestTimeout: number;
  retryDelay: number;
}
