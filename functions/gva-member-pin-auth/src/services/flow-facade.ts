// src/services/flow-facade.ts
import { INITIAL_STEP } from '../constants';
import { validateConfig } from '../config';
import { GVAGoalService } from './gva-goal-service';
import { LoggerInterface, ValidationResult } from '../types';
import { BaseGVAGoalService } from './base-gva-goal-service';

function pickStepFromCJC(cjcRaw: unknown): string {
  try {
    const cjc = typeof cjcRaw === 'string' ? JSON.parse(cjcRaw) : cjcRaw;
    if (cjc && typeof (cjc as any).STEP === 'string' && (cjc as any).STEP.length > 0) {
      return (cjc as any).STEP;
    }
  } catch {
    /* fall back */
  }
  return INITIAL_STEP;
}

/**
 * Уніфікований фасад:
 * - валідуює ENV → config
 * - парсить raw GVA payload (JSON string)
 * - обирає STEP з customJourneyContext або INITIAL
 * - виконує крок у GVAGoalService
 * Використовуй у тестах, локальних скриптах “replay”, або як утиліту.
 */
export async function runGvaFlowOnce(
  env: Record<string, unknown>,
  rawPayload: string,
  logger: LoggerInterface,
): Promise<{ ok: true; result: any } | { ok: false; error: string }> {
  // 1) ENV → config
  const cfgRes = validateConfig(env) as ValidationResult<any>;
  if (!cfgRes.status) {
    const msg = cfgRes.message ?? 'Invalid config';
    await logger.error(`Config validation failed: ${msg}`);
    return { ok: false, error: msg };
  }

  // 2) Payload parse + schema validation
  const base = new BaseGVAGoalService();
  const payloadRes = base.parsePayload(rawPayload);
  if (!payloadRes.status) {
    const msg = payloadRes.message ?? 'Invalid payload';
    await logger.error(`Payload validation failed: ${msg}`);
    return { ok: false, error: msg };
  }

  const config = cfgRes.output!;
  const context = payloadRes.output!;
  const step = pickStepFromCJC(context.customJourneyContext);

  // 3) Execute step
  const service = new GVAGoalService(config, logger);
  try {
    const result = await service.execute(step, context);
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logger.error(`Flow execution error on step "${step}": ${msg}`, e);
    return { ok: false, error: msg };
  }
}
