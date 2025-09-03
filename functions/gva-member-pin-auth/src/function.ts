import { CatalogErrors } from './catalog-errors';
import { validateConfig } from './config';
import { LoggerWithDD } from './logger';
import { RequestHandler } from './request-handler';
import { validatePayload } from './request-validator';

export async function onInvoke(request: Request, environment: Record<string, unknown>) {
  const config = validateConfig(environment);

  if (!config.status) {
    const errorMessage = `${CatalogErrors.FAILED_CONFIG}: ${config.message} `;
    console.error(errorMessage);
    return Response.json({ message: errorMessage, status: false });
  }

  const logger = new LoggerWithDD(config.output.dataDog);
  await logger.info('--------Received request---------');

  const validatedPayload = await validatePayload(request);
  if (!validatedPayload.status) {
    const errorMessage = `${CatalogErrors.FAILED_PAYLOAD}: ${validatedPayload.message}`;
    await logger.error(errorMessage);
    return Response.json({ error: errorMessage, status: false });
  }

  const requestHandler = new RequestHandler(config.output, logger);
  const result = await requestHandler.handleRequest(validatedPayload.output);
  await logger.info('--------Request processed---------');

  return Response.json(result);
}
