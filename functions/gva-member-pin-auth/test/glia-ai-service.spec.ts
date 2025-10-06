import { beforeEach, describe, expect, it, vi } from 'vitest';

const { initializeMock, invokeModelMock } = vi.hoisted(() => {
  return {
    initializeMock: vi.fn(() => ({ invokeModel: invokeModelMock })),
    invokeModelMock: vi.fn(),
  };
});

vi.mock('ai', () => ({
  aiClient: {
    initialize: initializeMock,
  },
}));

import { GliaAIService } from '../src/services/glia-ai-service';

const cfg: any = {
  gliaAI: {
    maxTokens: 123,
    stopSequences: ['STOP'],
    temperature: 0.42,
  },
};

describe('GliaAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('init the aiClient з "glia.micro.v1"', () => {
    new GliaAIService(cfg);
    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledWith('glia.micro.v1');
  });

  it('invokeModel: send correct payload and tie up text from chuncks', async () => {
    const service = new GliaAIService(cfg);

    const chunks = [{ text: 'Hello' }, { text: ' ' }, { text: 'world!' }];
    invokeModelMock.mockResolvedValueOnce({ message: { content: chunks } });

    const res = await service.invokeModel('some user text');

    // payload check
    expect(invokeModelMock).toHaveBeenCalledTimes(1);
    expect(invokeModelMock.mock.calls[0][0]).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'some user text' }],
        },
      ],
      options: {
        max_tokens: cfg.gliaAI.maxTokens,
        stop_sequences: cfg.gliaAI.stopSequences,
        temperature: cfg.gliaAI.temperature,
      },
    });

    expect(res).toBe('Hello world!');
  });

  it('invokeModel: throw error in case responce is empty (message/content is missing)', async () => {
    const service = new GliaAIService(cfg);
    invokeModelMock.mockResolvedValueOnce({});

    await expect(service.invokeModel('x')).rejects.toThrow(/Glia AI response is empty:/);
  });

  it('invokeModel: in case of empty array content returns empty string', async () => {
    const service = new GliaAIService(cfg);
    invokeModelMock.mockResolvedValueOnce({ message: { content: [] } });

    await expect(service.invokeModel('x')).resolves.toBe('');
  });
});
