import { CatalogErrors } from './catalog-errors';
import { INITIAL_STEP } from './constants';
import { GVAGoalService } from './services';
import { BaseRequestPayload, FunctionConfig, KvStoreFactory, LoggerInterface, ServiceResponse } from './types';

export class RequestHandler {
  private gvaGoalService: GVAGoalService;
  constructor(
    config: FunctionConfig,
    private logger: LoggerInterface,
    kvStoreFactory: KvStoreFactory,
  ) {
    this.gvaGoalService = new GVAGoalService(config, logger, kvStoreFactory);
  }
  async handleRequest(requestPayload: BaseRequestPayload): Promise<ServiceResponse<unknown>> {
    const gvaPayload = this.gvaGoalService.parsePayload(requestPayload.payload);
    if (!gvaPayload.status) {
      const errorMessage = `${CatalogErrors.FAILED_GVA_PAYLOAD}: ${gvaPayload.message}`;
      await this.logger.error(errorMessage);
      return { error: errorMessage, status: false };
    }

    let customJourneyContext: Record<string, unknown> = {};
    if (gvaPayload.output.customJourneyContext) {
      const parseResult = this.gvaGoalService.safeJSONParse(gvaPayload.output.customJourneyContext);
      if (parseResult.status) {
        customJourneyContext = parseResult.output;
      }
    }

    const step = typeof customJourneyContext.STEP === 'string' ? customJourneyContext.STEP : INITIAL_STEP;
    // ✅ New logs
    await this.logger.info(`EngagementId: ${gvaPayload.output.engagementId}, GVA Step selected: ${step}`);
    try {
      const stepHandler = this.gvaGoalService.resolve(step);
      const result = await stepHandler(gvaPayload.output);
      // ✅ log rusults before sending the responce
      await this.logger.info(
        `EngagementId: ${gvaPayload.output.engagementId},
        GVA Step result: responseId=${result.responseId},
        isFinalStep=${!!result.isFinalStep}`,
      );
      return {
        ...result,
        customJourneyContext: JSON.stringify(result.customJourneyContext),
      };
    } catch (error) {
      const errorMessage = `${CatalogErrors.GOAL_PROCESSING_ERROR}: ${error instanceof Error ? error.message : String(error)}`;
      await this.logger.error(errorMessage);
      return {
        error: errorMessage,
        status: false,
      };
    }
  }
}
