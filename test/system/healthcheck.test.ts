import * as supertest from 'supertest';
import { app } from '../../src/app';

test('healthcheck is ok', async () => {
  const res = await supertest(app).get('/healthcheck');

  expect(res.status).toEqual(200);

  const body = JSON.parse(res.text);
  expect(body.ok).toBe(true);
  expect(body.gitSha).toBeTruthy();
});
