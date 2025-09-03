import { InferOutput } from 'valibot';

import { BaseRequestPayloadSchema } from '../schemas';

export type BaseRequestPayload = InferOutput<typeof BaseRequestPayloadSchema>;
