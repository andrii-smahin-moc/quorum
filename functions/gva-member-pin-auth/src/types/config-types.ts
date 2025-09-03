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
  askNumberGoalId: string;
  validNumberGoalId: string;
  reAskNumberGoalId: string;
}

export interface FunctionConfig {
  callRetries: number;
  dataDog: DataDogConfig;
  glia: GliaConfig;
  gvaGoals: GVAGoals;
  requestTimeout: number;
  retryDelay: number;
}
