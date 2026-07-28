import { describe, expect, it } from 'vitest';

import { STARTUP_MESSAGE } from './startup-message.js';

describe('startup message', () => {
  it('returns the application foundation startup message', () => {
    expect(STARTUP_MESSAGE).toBe('Car Dealership Inventory backend foundation initialized');
  });
});
