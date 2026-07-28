import request from 'supertest';
import { describe, it } from 'vitest';

import { createApp } from './app.js';
import { createAuthDependencies } from './modules/auth/test-support/auth-doubles.js';
import {
  createLoginInput,
  createPublicUserFixture,
  createRegistrationInput,
  createUserFixture,
  GENERATED_ACCESS_TOKEN,
} from './modules/auth/test-support/auth-fixtures.js';
import { createAuthApiSubject } from './modules/auth/test-support/auth-subjects.js';

describe('authentication Express routes', () => {
  it('mounts registration at POST /api/auth/register', async () => {
    const dependencies = createAuthDependencies();
    const app = createApp(createAuthApiSubject(dependencies));

    await request(app)
      .post('/api/auth/register')
      .send(createRegistrationInput())
      .expect(201)
      .expect('Content-Type', /json/u)
      .expect({ data: { user: createPublicUserFixture() } });
  });

  it('mounts login at POST /api/auth/login', async () => {
    const dependencies = createAuthDependencies();
    dependencies.userRepository.findByEmail.mockResolvedValue(createUserFixture());
    const app = createApp(createAuthApiSubject(dependencies));

    await request(app)
      .post('/api/auth/login')
      .send(createLoginInput())
      .expect(200)
      .expect({
        data: {
          accessToken: GENERATED_ACCESS_TOKEN,
          user: createPublicUserFixture(),
        },
      });
  });

  it('maps malformed JSON to the standard validation response', async () => {
    const app = createApp(createAuthApiSubject(createAuthDependencies()));

    await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400)
      .expect({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request is invalid.',
          details: { body: ['Request body must contain valid JSON.'] },
        },
      });
  });
});
