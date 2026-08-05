import { describe, expect, it } from 'vitest';
import { retryPhase } from '../../instrumentation-node';

describe('Node startup retry phases', () => {
  it('retries a transient phase failure and returns the successful result', async () => {
    let attempts = 0;

    await expect(
      retryPhase(
        'test phase',
        async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('temporary failure');
          return 'ready';
        },
        2,
      ),
    ).resolves.toBe('ready');

    expect(attempts).toBe(2);
  });

  it('rejects after the configured attempts are exhausted', async () => {
    const failure = new Error('permanent failure');

    await expect(retryPhase('test phase', async () => {
      throw failure;
    }, 1)).rejects.toMatchObject({
      message: 'test phase failed after 1 attempts',
      cause: failure,
    });
  });
});
