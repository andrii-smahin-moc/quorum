// node_modules/valibot/dist/index.js
var store;
// @__NO_SIDE_EFFECTS__
function getGlobalConfig(config2) {
  return {
    lang: config2?.lang ?? store?.lang,
    message: config2?.message,
    abortEarly: config2?.abortEarly ?? store?.abortEarly,
    abortPipeEarly: config2?.abortPipeEarly ?? store?.abortPipeEarly
  };
}
var store2;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage(lang) {
  return store2?.get(lang);
}
var store3;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage(lang) {
  return store3?.get(lang);
}
var store4;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage(reference, lang) {
  return store4?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify(input) {
  const type = typeof input;
  if (type === "string") {
    return `"${input}"`;
  }
  if (type === "number" || type === "bigint" || type === "boolean") {
    return `${input}`;
  }
  if (type === "object" || type === "function") {
    return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  }
  return type;
}
function _addIssue(context, label, dataset, config2, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config2.lang,
    abortEarly: config2.abortEarly,
    abortPipeEarly: config2.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message2 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage(issue.lang) : null) ?? config2.message ?? /* @__PURE__ */ getGlobalMessage(issue.lang);
  if (message2 !== void 0) {
    issue.message = typeof message2 === "function" ? (
      // @ts-expect-error
      message2(issue)
    ) : message2;
  }
  if (isSchema) {
    dataset.typed = false;
  }
  if (dataset.issues) {
    dataset.issues.push(issue);
  } else {
    dataset.issues = [issue];
  }
}
// @__NO_SIDE_EFFECTS__
function _getStandardProps(context) {
  return {
    version: 1,
    vendor: "valibot",
    validate(value2) {
      return context["~run"]({ value: value2 }, /* @__PURE__ */ getGlobalConfig());
    }
  };
}
// @__NO_SIDE_EFFECTS__
function _isValidObjectKey(object2, key) {
  return Object.hasOwn(object2, key) && key !== "__proto__" && key !== "prototype" && key !== "constructor";
}
// @__NO_SIDE_EFFECTS__
function _joinExpects(values2, separator) {
  const list = [...new Set(values2)];
  if (list.length > 1) {
    return `(${list.join(` ${separator} `)})`;
  }
  return list[0] ?? "never";
}
// @__NO_SIDE_EFFECTS__
function getFallback(schema, dataset, config2) {
  return typeof schema.fallback === "function" ? (
    // @ts-expect-error
    schema.fallback(dataset, config2)
  ) : (
    // @ts-expect-error
    schema.fallback
  );
}
// @__NO_SIDE_EFFECTS__
function getDefault(schema, dataset, config2) {
  return typeof schema.default === "function" ? (
    // @ts-expect-error
    schema.default(dataset, config2)
  ) : (
    // @ts-expect-error
    schema.default
  );
}
// @__NO_SIDE_EFFECTS__
function literal(literal_, message2) {
  return {
    kind: "schema",
    type: "literal",
    reference: literal,
    expects: /* @__PURE__ */ _stringify(literal_),
    async: false,
    literal: literal_,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value === this.literal) {
        dataset.typed = true;
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object(entries2, message2) {
  return {
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries: entries2,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && // @ts-expect-error
          valueSchema.default !== void 0) {
            const value2 = key in input ? (
              // @ts-expect-error
              input[key]
            ) : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value2 }, config2);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value2
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) {
                  issue.path.unshift(pathItem);
                } else {
                  issue.path = [pathItem];
                }
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) {
                dataset.issues = valueDataset.issues;
              }
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) {
              dataset.typed = false;
            }
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) {
            dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          } else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue(this, "key", dataset, config2, {
              input: void 0,
              expected: `"${key}"`,
              path: [
                {
                  type: "object",
                  origin: "key",
                  input,
                  key,
                  // @ts-expect-error
                  value: input[key]
                }
              ]
            });
            if (config2.abortEarly) {
              break;
            }
          }
        }
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) {
          dataset.value = /* @__PURE__ */ getDefault(this, dataset, config2);
        }
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config2);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function record(key, value2, message2) {
  return {
    kind: "schema",
    type: "record",
    reference: record,
    expects: "Object",
    async: false,
    key,
    value: value2,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const entryKey in input) {
          if (/* @__PURE__ */ _isValidObjectKey(input, entryKey)) {
            const entryValue = input[entryKey];
            const keyDataset = this.key["~run"]({ value: entryKey }, config2);
            if (keyDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "key",
                input,
                key: entryKey,
                value: entryValue
              };
              for (const issue of keyDataset.issues) {
                issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) {
                dataset.issues = keyDataset.issues;
              }
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            const valueDataset = this.value["~run"](
              { value: entryValue },
              config2
            );
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key: entryKey,
                value: entryValue
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) {
                  issue.path.unshift(pathItem);
                } else {
                  issue.path = [pathItem];
                }
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) {
                dataset.issues = valueDataset.issues;
              }
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!keyDataset.typed || !valueDataset.typed) {
              dataset.typed = false;
            }
            if (keyDataset.typed) {
              dataset.value[keyDataset.value] = valueDataset.value;
            }
          }
        }
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function string(message2) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (typeof dataset.value === "string") {
        dataset.typed = true;
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function _subIssues(datasets) {
  let issues;
  if (datasets) {
    for (const dataset of datasets) {
      if (issues) {
        issues.push(...dataset.issues);
      } else {
        issues = dataset.issues;
      }
    }
  }
  return issues;
}
// @__NO_SIDE_EFFECTS__
function union(options, message2) {
  return {
    kind: "schema",
    type: "union",
    reference: union,
    expects: /* @__PURE__ */ _joinExpects(
      options.map((option) => option.expects),
      "|"
    ),
    async: false,
    options,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      let validDataset;
      let typedDatasets;
      let untypedDatasets;
      for (const schema of this.options) {
        const optionDataset = schema["~run"]({ value: dataset.value }, config2);
        if (optionDataset.typed) {
          if (optionDataset.issues) {
            if (typedDatasets) {
              typedDatasets.push(optionDataset);
            } else {
              typedDatasets = [optionDataset];
            }
          } else {
            validDataset = optionDataset;
            break;
          }
        } else {
          if (untypedDatasets) {
            untypedDatasets.push(optionDataset);
          } else {
            untypedDatasets = [optionDataset];
          }
        }
      }
      if (validDataset) {
        return validDataset;
      }
      if (typedDatasets) {
        if (typedDatasets.length === 1) {
          return typedDatasets[0];
        }
        _addIssue(this, "type", dataset, config2, {
          issues: /* @__PURE__ */ _subIssues(typedDatasets)
        });
        dataset.typed = true;
      } else if (untypedDatasets?.length === 1) {
        return untypedDatasets[0];
      } else {
        _addIssue(this, "type", dataset, config2, {
          issues: /* @__PURE__ */ _subIssues(untypedDatasets)
        });
      }
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function unknown() {
  return {
    kind: "schema",
    type: "unknown",
    reference: unknown,
    expects: "unknown",
    async: false,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset) {
      dataset.typed = true;
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse(schema, input, config2) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config2));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}

// src/schemas/config-schema.ts
var BaseEnvironmentSchema = object({
  CALL_RETRIES: optional(string()),
  DD_API_KEY: string(),
  FDMS_VERSION: string(),
  GLIA_AI_MAX_TOKENS: string(),
  GLIA_AI_STOP_SEQUENCES: string(),
  GLIA_AI_TEMPERATURE: string(),
  GLIA_API_DOMAIN: string(),
  GLIA_USER_API_KEY: string(),
  GLIA_USER_API_KEY_SECRET: string(),
  GOAL_ALREADY_AUTHENTICATED: string(),
  GOAL_ENTER_A_PIN: string(),
  GOAL_FORGOT_PIN: string(),
  GOAL_INVALID_MEMBER_NUMBER: string(),
  GOAL_INVALID_PIN: string(),
  GOAL_NEED_TO_AUTHENTICATION: string(),
  GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN: string(),
  GOAL_TRANSFER_TO_LIVE_OPERATOR: string(),
  IS_DEV_MOD: optional(string()),
  PROMPT_DETECT_CONFIDENCE: string(),
  PROMPT_OPTION_DETECTOR: string(),
  REQUEST_TIMEOUT: optional(string()),
  RETRY_DELAY: optional(string()),
  SITE_ID: string()
});

// src/schemas/glia-schema.ts
var GVAFunctionPayloadSchema = object({
  authToken: optional(string()),
  buttonPayload: optional(record(string(), unknown())),
  buttonText: optional(string()),
  customJourneyContext: optional(string()),
  engagementId: string(),
  gvaId: string(),
  messageType: union([literal("text"), literal("quickReplyTap")]),
  text: optional(string())
});

// src/schemas/request-schema.ts
var BaseRequestPayloadSchema = object({
  metadata: object({
    action: literal("web_api_invoke"),
    id: string(),
    invoker: object({
      id: string(),
      type: literal("operator")
    }),
    timestamp: string()
  }),
  payload: string()
});

// src/validator.ts
function validateSchema(schema, input, logPrefix) {
  const result = safeParse(schema, input);
  if (!result.success) {
    const invalidPayload = result.issues.map((issue) => issue.message).join("; ");
    const message = `${logPrefix}: Invalid payload: ${invalidPayload}`;
    return { message, status: false };
  }
  return { output: result.output, status: true };
}

// src/config.ts
function validateConfig(environment) {
  const validationResult = validateSchema(BaseEnvironmentSchema, environment, "Environment validation");
  if (!validationResult.status) {
    return validationResult;
  }
  return {
    output: {
      callRetries: Number(validationResult.output.CALL_RETRIES) || 3,
      dataDog: {
        callRetries: Number(validationResult.output.CALL_RETRIES) || 3,
        customer: "quorum",
        ddApiKey: validationResult.output.DD_API_KEY,
        functionName: "gva-member-pin-auth-function",
        isDevMode: validationResult.output.IS_DEV_MOD === "true",
        requestTimeout: Number(validationResult.output.REQUEST_TIMEOUT) || 5e3,
        retryDelay: Number(validationResult.output.RETRY_DELAY) || 3e3,
        siteId: validationResult.output.SITE_ID,
        version: validationResult.output.FDMS_VERSION
      },
      glia: {
        apiDomain: validationResult.output.GLIA_API_DOMAIN,
        siteId: validationResult.output.SITE_ID,
        userApiKey: validationResult.output.GLIA_USER_API_KEY,
        userApiKeySecret: validationResult.output.GLIA_USER_API_KEY_SECRET
      },
      gliaAI: {
        detectConfidence: Number(validationResult.output.PROMPT_DETECT_CONFIDENCE),
        detectOptionPrompt: validationResult.output.PROMPT_OPTION_DETECTOR,
        maxTokens: Number(validationResult.output.GLIA_AI_MAX_TOKENS),
        stopSequences: (() => {
          const raw = validationResult.output.GLIA_AI_STOP_SEQUENCES;
          if (!raw) {
            return [];
          }
          return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        })(),
        temperature: Number(validationResult.output.GLIA_AI_TEMPERATURE)
      },
      gvaGoals: {
        alreadyAuthenticated: validationResult.output.GOAL_ALREADY_AUTHENTICATED,
        enterAPin: validationResult.output.GOAL_ENTER_A_PIN,
        forgotPin: validationResult.output.GOAL_FORGOT_PIN,
        invalidMemberNumber: validationResult.output.GOAL_INVALID_MEMBER_NUMBER,
        invalidPin: validationResult.output.GOAL_INVALID_PIN,
        needToAuthentication: validationResult.output.GOAL_NEED_TO_AUTHENTICATION,
        successfullyVerifiesMemberNumberAndPin: validationResult.output.GOAL_SUCCESSFULLY_VERIFIES_MEMBER_NUMBER_AND_PIN,
        transferToLiveOperator: validationResult.output.GOAL_TRANSFER_TO_LIVE_OPERATOR
      },
      requestTimeout: Number(validationResult.output.REQUEST_TIMEOUT) || 5e3,
      retryDelay: Number(validationResult.output.RETRY_DELAY) || 3e3
    },
    status: true
  };
}

// src/apis/data-dog-api.ts
var DATA_DOG_LOG_URL = "https://http-intake.logs.datadoghq.com/api/v2/logs";
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function shouldStopRetrying(status, attempt, max) {
  if (!status) {
    return attempt >= max - 1;
  }
  if (status >= 400 && status < 429) {
    return attempt >= max - 1;
  }
  return false;
}
function toFinalError(error, status) {
  if (!status) {
    console.error("DATADOG REQUEST: No status and max retries reached.");
    return error instanceof Error ? error : new Error("Unknown error");
  }
  console.error("DATADOG REQUEST: Max retry attempts reached.");
  return new Error("Max retry attempts reached. Operation failed.");
}
function logRequestError(error, attempt) {
  console.error(`DATADOG REQUEST Error (Attempt ${attempt + 1}):`, error);
}
async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}
async function postRequest(retryOptions, { data, headers, url }) {
  const controller = new AbortController();
  for (let attempts = 0; attempts < retryOptions.callRetries; attempts += 1) {
    const timeout = setTimeout(() => controller.abort(), retryOptions.requestTimeout);
    let responseStatus;
    try {
      const response = await fetch(url, {
        body: JSON.stringify(data),
        headers,
        method: "POST"
      });
      responseStatus = response.status;
      const responseValue = await parseResponse(response);
      if (response.ok) {
        return responseValue;
      }
      console.error(`DATADOG REQUEST Error: ${response.status} - ${response.statusText}`, responseValue);
      throw new Error(`DATADOG BAD REQUEST! Status: ${response.status}`);
    } catch (error) {
      logRequestError(error, attempts);
      if (shouldStopRetrying(responseStatus, attempts, retryOptions.callRetries)) {
        throw toFinalError(error, responseStatus);
      }
      await delay(retryOptions.retryDelay);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Unexpected failure in postRequest retry loop.");
}
async function dataDogLog(config, payload) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "DD-API-KEY": config.ddApiKey
  });
  const data = {
    message: payload.message,
    ddsource: config.siteId,
    ddtags: `customer:${config.customer},site_id:${config.siteId},function:${config.functionName},version:${config.version}`,
    hostname: config.functionName,
    service: config.customer,
    status: payload.status
  };
  try {
    await postRequest(
      { callRetries: config.callRetries, requestTimeout: config.requestTimeout, retryDelay: config.retryDelay },
      { data, headers, url: DATA_DOG_LOG_URL }
    );
  } catch (error) {
    console.error("DATADOG Log Error:", error);
  }
}

// src/logger.ts
var LoggerWithDD = class {
  constructor(CONFIG) {
    this.CONFIG = CONFIG;
    this.CONFIG.isDevMode ??= false;
  }
  async error(message, error) {
    return this.log("error", message, error);
  }
  async info(message) {
    return this.log("info", message);
  }
  async warn(message) {
    return this.log("warn", message);
  }
  getDDConfig() {
    const { callRetries, customer, ddApiKey, functionName, isDevMode, requestTimeout, retryDelay, siteId, version } = this.CONFIG;
    return {
      callRetries,
      customer,
      ddApiKey,
      functionName,
      isDevMode,
      requestTimeout,
      retryDelay,
      siteId,
      version
    };
  }
  async log(status, message, error) {
    const prefix = status.toUpperCase();
    switch (status) {
      case "error": {
        console.error(`${prefix}: ${message}`, error);
        break;
      }
      case "info": {
        console.info(`${prefix}: ${message}`);
        break;
      }
      case "warn": {
        console.warn(`${prefix}: ${message}`);
        break;
      }
      default: {
        console.info(`${prefix}: ${message}`);
        break;
      }
    }
    if (this.CONFIG.isDevMode) {
      return;
    }
    await dataDogLog(this.getDDConfig(), { message, status });
  }
};

// src/constants.ts
var MEMBER_NUMBER_REGEX = /^\d{9}$/;
var MEMBER_PIN_REGEX = /^\d{4}$/;
var FORGET_THE_PIN = /\b(?:forgot|forget|lost|remember|recall|know|have|idk|no|not|don)\b/;
var INITIAL_STEP = "initial";

// glia-ai-sdk.json
var glia_ai_sdk_default = {
  GLIA_AI_FUNCTION_URL: "https://api.glia.com/integrations/7c5f52e4-371f-4192-814f-1f1173b3115f/endpoint",
  GLIA_AI_API_KEY: "75701c34-92fe-4951-8eb9-260e1d5c5968",
  GLIA_AI_API_KEY_SECRET: "glu_mBjoju9ly6K4PKrXVOa21nWvYfSgbgElOxyq",
  GLIA_AI_DOMAIN: "https://api.glia.com"
};

// glia-ai-sdk.ts
var aiClient = class _aiClient {
  modelName;
  static initialize(modelName) {
    const client = new _aiClient();
    client.modelName = modelName;
    return client;
  }
  async invokeModel(params) {
    const authToken = await this.fetchAuthToken();
    const response = await this.invokeTheFunction(authToken, params);
    return response;
  }
  async invokeTheFunction(authToken, params) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Bearer ${authToken}`);
    const body = JSON.stringify({ ...params, modelName: this.modelName });
    const requestOptions = {
      body,
      headers,
      method: "POST"
    };
    try {
      const result = await fetch(glia_ai_sdk_default.GLIA_AI_FUNCTION_URL, requestOptions);
      const data = await result.json();
      if ("status" in data && data.status === false) {
        throw new Error(data.message);
      }
      return data;
    } catch (error) {
      console.error("Error invoking function:", error);
      throw new Error("Failed to invoke function");
    }
  }
  async fetchAuthToken() {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Accept", "application/vnd.salemove.v1+json");
    const body = JSON.stringify({
      api_key_id: glia_ai_sdk_default.GLIA_AI_API_KEY,
      api_key_secret: glia_ai_sdk_default.GLIA_AI_API_KEY_SECRET
    });
    const requestOptions = {
      body,
      headers,
      method: "POST"
    };
    const url = `${glia_ai_sdk_default.GLIA_AI_DOMAIN}/operator_authentication/tokens`;
    try {
      const result = await fetch(url, requestOptions);
      const data = await result.json();
      return data.token;
    } catch (error) {
      console.error("Error fetching auth token:", error);
      throw new Error("Failed to fetch auth token");
    }
  }
};

// src/services/glia-ai-service.ts
var GliaAIService = class {
  constructor(config) {
    this.config = config;
    this.aiClient = aiClient.initialize("glia.micro.v1");
  }
  aiClient;
  async invokeModel(text) {
    const invokeConfiguration = {
      messages: [
        {
          content: [{ text }],
          role: "user"
        }
      ],
      options: {
        max_tokens: this.config.gliaAI.maxTokens,
        stop_sequences: this.config.gliaAI.stopSequences,
        temperature: this.config.gliaAI.temperature
      }
    };
    const resultValue = await this.aiClient.invokeModel(invokeConfiguration);
    let resultContent = "";
    if (resultValue && resultValue.message && resultValue.message.content) {
      resultValue.message.content.forEach((aContent) => resultContent += aContent.text);
      return resultContent;
    }
    throw new Error(`Glia AI response is empty: ${JSON.stringify(resultValue)}`);
  }
};

// src/services/answer-detector-service.ts
var AnswerDetectorService = class {
  constructor(config, logger, possibleAnswers) {
    this.config = config;
    this.logger = logger;
    this.possibleAnswers = possibleAnswers;
    this.gliaAiService = new GliaAIService(this.config);
  }
  gliaAiService;
  async detect(context) {
    const local = this.possibleAnswers.find((r) => r.match(context).isMatched ? r : null);
    if (local) {
      return local;
    }
    if (context.text) {
      await this.logger.info(`No local match found, invoking AI detection`);
      return this.detectWithAI(context.text);
    }
    return null;
  }
  async detectWithAI(text) {
    const prompt = this.config.gliaAI.detectOptionPrompt.replace("{userText}", text).replace("{possibleOptions}", this.possibleAnswers.map((r) => r.name).join(", "));
    try {
      const ai = await this.gliaAiService.invokeModel(prompt);
      const parsedResponse = this.safeParseAIResponse(ai);
      if (!parsedResponse) {
        await this.logger.warn(`Glia AI response could not be parsed as JSON: ${ai}`);
        return null;
      }
      await this.logger.info(`AI detected option: ${parsedResponse.option} with confidence: ${parsedResponse.confidence}`);
      if (parsedResponse.option && parsedResponse.confidence >= this.config.gliaAI.detectConfidence) {
        const option = this.possibleAnswers.find((r) => r.name === parsedResponse.option);
        if (option) {
          return option;
        }
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logger.error(`Error invoking Glia AI: ${errorMessage}`);
    }
    return null;
  }
  safeParseAIResponse(aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse);
      if (typeof parsed === "object" && parsed !== null && "optionName" in parsed && "confidence" in parsed && (typeof parsed.optionName === "string" || parsed.optionName === null) && typeof parsed.confidence === "number") {
        return { confidence: parsed.confidence, option: parsed.optionName };
      }
      return null;
    } catch {
      return null;
    }
  }
};

// src/services/base-gva-goal-service.ts
var BaseGVAGoalService = class {
  goalHandlers = /* @__PURE__ */ new Map();
  buildHandlerResultPayload(overrides) {
    const defaults = {
      customJourneyContext: {},
      customPayload: {},
      isFinalStep: false,
      responseData: {},
      responseId: "",
      transferToHuman: false
    };
    return {
      ...defaults,
      ...overrides
    };
  }
  execute(step, context) {
    const handler = this.resolve(step);
    return handler(context);
  }
  parsePayload(rawPayload) {
    const logPrefix = "Parse GVA Payload";
    const parsedResult = this.safeJSONParse(rawPayload);
    if (!parsedResult.status) {
      const message = `${logPrefix}: ${parsedResult.message}`;
      return { message, status: false };
    }
    return validateSchema(GVAFunctionPayloadSchema, parsedResult.output, logPrefix);
  }
  register(step, handler) {
    this.goalHandlers.set(step, handler);
  }
  resolve(step) {
    const handler = this.goalHandlers.get(step);
    if (!handler) {
      throw new Error(`No handler registered for step "${step}"`);
    }
    return handler;
  }
  safeJSONParse(jsonString) {
    try {
      const output = JSON.parse(jsonString);
      return { output, status: true };
    } catch (error) {
      const logError = error instanceof Error ? error : new Error(String(error));
      const message = `Failed to parse JSON. Error: ${logError.message}`;
      return { message, status: false };
    }
  }
};

// src/services/possible-answer.ts
var AnswerOption = class {
  constructor(name, patterns) {
    this.name = name;
    this.patterns = patterns;
  }
  matchedText = null;
  patternType = null;
  source = null;
  match(payload) {
    if (payload.messageType === "quickReplyTap" && payload.buttonText) {
      const buttonMatch = this.checkPatterns(payload.buttonText, "quickReplyTap");
      if (buttonMatch.isMatched) {
        return buttonMatch;
      }
    }
    if (payload.messageType === "text" && payload.text) {
      const textMatch = this.checkPatterns(payload.text, "text");
      if (textMatch.isMatched) {
        return textMatch;
      }
    }
    return this.noMatch();
  }
  buildMatch(pattern, matchedText, source) {
    const patternType = typeof pattern === "string" ? "string" : "regexp";
    this.matchedText = matchedText;
    this.source = source;
    this.patternType = patternType;
    return {
      isMatched: true,
      matchedText,
      name: this.name,
      patternType,
      source
    };
  }
  checkPatterns(input, source) {
    const normalizedInput = input.toLowerCase();
    for (const pattern of this.patterns) {
      if (typeof pattern === "string") {
        const normalizedPattern = pattern.toLowerCase();
        const isExact = source === "quickReplyTap" ? normalizedInput === normalizedPattern : normalizedInput.includes(normalizedPattern);
        if (isExact) {
          return this.buildMatch(pattern, pattern, source);
        }
      } else {
        const execResult = pattern.exec(input);
        if (execResult) {
          return this.buildMatch(pattern, execResult[0], source);
        }
      }
    }
    return this.noMatch();
  }
  noMatch() {
    this.matchedText = null;
    this.source = null;
    this.patternType = null;
    return {
      isMatched: false,
      matchedText: null,
      name: this.name,
      patternType: null,
      source: null
    };
  }
};

// src/services/gva-goal-service.ts
var AnswerOptionsList = {
  // CANCEL: 'cancel',
  // CONFIRM: 'confirm',
  MEMBER_NUMBER: "member_number"
};
var GVAGoalService = class extends BaseGVAGoalService {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.register(INITIAL_STEP, this.initialStep.bind(this));
    this.register("VALIDATE_MEMBER_NUMBER" /* VALIDATE_MEMBER_NUMBER */, this.validateMemberNumber.bind(this));
    this.register("VALIDATE_PIN" /* VALIDATE_PIN */, this.validatePin.bind(this));
    this.answerDetectorService = new AnswerDetectorService(this.config, this.logger, [
      // new AnswerOption(AnswerOptionsList.CANCEL, ['To Cancel', 'cancel', 'stop', 'abort']),
      // new AnswerOption(AnswerOptionsList.CONFIRM, ['To continue', 'Confirm', 'yes', 'ok']),
      new AnswerOption(AnswerOptionsList.MEMBER_NUMBER, [MEMBER_NUMBER_REGEX])
    ]);
  }
  answerDetectorService;
  async initialStep(context) {
    await this.logger.info(`EngagementId: ${context.engagementId}, Starting initial step`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: "VALIDATE_MEMBER_NUMBER" /* VALIDATE_MEMBER_NUMBER */ },
      responseId: this.config.gvaGoals.needToAuthentication
    });
  }
  async validateMemberNumber(context) {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating member number`);
    const detectedAnswer = await this.answerDetectorService.detect(context);
    if (detectedAnswer && detectedAnswer.name === AnswerOptionsList.MEMBER_NUMBER) {
      await this.logger.info(`EngagementId: ${context.engagementId}, Valid member number received: ${detectedAnswer.matchedText}`);
      return this.buildHandlerResultPayload({
        customJourneyContext: { STEP: "VALIDATE_PIN" /* VALIDATE_PIN */ },
        responseId: this.config.gvaGoals.enterAPin
      });
    }
    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid member number`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: "VALIDATE_MEMBER_NUMBER" /* VALIDATE_MEMBER_NUMBER */ },
      responseId: this.config.gvaGoals.invalidMemberNumber
    });
  }
  async validatePin(context) {
    await this.logger.info(`EngagementId: ${context.engagementId}, Validating PIN`);
    if (context.messageType === "text" && context.text) {
      const userInput = context.text.trim();
      if (MEMBER_PIN_REGEX.test(userInput)) {
        await this.logger.info(`EngagementId: ${context.engagementId}, Valid PIN received: ${userInput}`);
        return this.buildHandlerResultPayload({
          customJourneyContext: { STEP: null },
          isFinalStep: true,
          responseId: this.config.gvaGoals.successfullyVerifiesMemberNumberAndPin
        });
      }
      if (FORGET_THE_PIN.test(userInput.toLowerCase())) {
        await this.logger.info(`EngagementId: ${context.engagementId}, User forgot PIN`);
        return this.buildHandlerResultPayload({
          customJourneyContext: { STEP: null },
          isFinalStep: true,
          responseId: this.config.gvaGoals.forgotPin
        });
      }
    }
    await this.logger.info(`EngagementId: ${context.engagementId}, Invalid PIN`);
    return this.buildHandlerResultPayload({
      customJourneyContext: { STEP: "VALIDATE_PIN" /* VALIDATE_PIN */ },
      responseId: this.config.gvaGoals.invalidPin
    });
  }
};

// src/request-handler.ts
var RequestHandler = class {
  constructor(config, logger) {
    this.logger = logger;
    this.gvaGoalService = new GVAGoalService(config, logger);
  }
  gvaGoalService;
  async handleRequest(requestPayload) {
    const gvaPayload = this.gvaGoalService.parsePayload(requestPayload.payload);
    if (!gvaPayload.status) {
      const errorMessage = `${"Provided GVA payload is invalid" /* FAILED_GVA_PAYLOAD */}: ${gvaPayload.message}`;
      await this.logger.error(errorMessage);
      return {
        error: errorMessage,
        status: false
      };
    }
    let customJourneyContext = {};
    if (gvaPayload.output.customJourneyContext) {
      const parseResult = this.gvaGoalService.safeJSONParse(gvaPayload.output.customJourneyContext);
      if (parseResult.status) {
        customJourneyContext = parseResult.output;
      }
    }
    const step = typeof customJourneyContext.STEP === "string" ? customJourneyContext.STEP : INITIAL_STEP;
    try {
      const stepHandler = this.gvaGoalService.resolve(step);
      const result = await stepHandler(gvaPayload.output);
      return {
        ...result,
        customJourneyContext: JSON.stringify(result.customJourneyContext)
      };
    } catch (error) {
      const errorMessage = `${"Error occurred during goal processing" /* GOAL_PROCESSING_ERROR */}: ${error instanceof Error ? error.message : String(error)}`;
      await this.logger.error(errorMessage);
      return {
        error: errorMessage,
        status: false
      };
    }
  }
};

// src/request-validator.ts
var validatePayload = async (request) => {
  try {
    const requestJson = await request.json();
    return validateSchema(BaseRequestPayloadSchema, requestJson, "Request Payload validation");
  } catch (error) {
    const message = `Invalid payload: ${error?.message ?? "Unknown error"}`;
    console.error(message);
    return {
      message,
      status: false
    };
  }
};

// src/function.ts
async function onInvoke(request, environment) {
  const config = validateConfig(environment);
  if (!config.status) {
    const errorMessage = `${"Provided config(envs) is invalid" /* FAILED_CONFIG */}: ${config.message} `;
    console.error(errorMessage);
    return Response.json({ message: errorMessage, status: false });
  }
  const logger = new LoggerWithDD(config.output.dataDog);
  await logger.info("--------Received request---------");
  const validatedPayload = await validatePayload(request);
  if (!validatedPayload.status) {
    const errorMessage = `${"Provided payload is invalid" /* FAILED_PAYLOAD */}: ${validatedPayload.message}`;
    await logger.error(errorMessage);
    return Response.json({ error: errorMessage, status: false });
  }
  const requestHandler = new RequestHandler(config.output, logger);
  const result = await requestHandler.handleRequest(validatedPayload.output);
  await logger.info("--------Request processed---------");
  return Response.json(result);
}
export {
  onInvoke
};
