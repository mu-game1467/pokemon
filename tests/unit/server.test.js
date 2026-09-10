const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';

const app = require('../../server.js');

describe('Server API: safeUserId', () => {
  const { safeUserId, getUserFilePath } = require('../../server.js');

  test('allows alphanumeric, hyphen, underscore', () => {
    expect(safeUserId('user_123-abc')).toBe('user_123-abc');
  });

  test('strips special characters', () => {
    expect(safeUserId('user@123!test')).toBe('user123test');
    expect(safeUserId('user<script>')).toBe('userscript');
  });

  test('truncates to 32 characters', () => {
    expect(safeUserId('a'.repeat(50))).toHaveLength(32);
  });

  test('returns empty string for input with no valid chars', () => {
    expect(safeUserId('..!!@@')).toBe('');
  });
});

describe('Server API: /api/user/:userId', () => {
  const TEST_USER_ID = 'test_user_ut_001';

  afterAll(async () => {
    // Clean up test data
    const { getUserFilePath } = require('../../server.js');;
    const filePath = getUserFilePath(TEST_USER_ID);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test('GET returns default structure for non-existent user', async () => {
    const res = await request(app).get('/api/user/' + TEST_USER_ID + '_noexist');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('party');
    expect(res.body).toHaveProperty('savedParties');
    expect(res.body).toHaveProperty('battleLogs');
    expect(res.body).toHaveProperty('memo');
    expect(res.body).toHaveProperty('partyName');
    expect(Array.isArray(res.body.party)).toBe(true);
    expect(Array.isArray(res.body.savedParties)).toBe(true);
    expect(Array.isArray(res.body.battleLogs)).toBe(true);
  });

  test('POST saves and GET retrieves user data', async () => {
    const testData = {
      party: [{ name: 'テストポケモン', id: 'n9999' }],
      savedParties: [{ name: 'テストパーティ', pokemon: [] }],
      battleLogs: [{ result: 'win' }],
      memo: 'テストメモ',
      partyName: 'テストチーム'
    };

    const postRes = await request(app)
      .post('/api/user/' + TEST_USER_ID)
      .send(testData);

    expect(postRes.status).toBe(200);
    expect(postRes.body).toHaveProperty('success', true);

    const getRes = await request(app).get('/api/user/' + TEST_USER_ID);
    expect(getRes.status).toBe(200);
    expect(getRes.body.party).toEqual(testData.party);
    expect(getRes.body.memo).toBe('テストメモ');
    expect(getRes.body.partyName).toBe('テストチーム');
    expect(getRes.body).toHaveProperty('updatedAt');
  });

  test('DELETE removes user data', async () => {
    // Ensure data exists
    await request(app).post('/api/user/' + TEST_USER_ID).send({ party: [] });

    const delRes = await request(app).post('/api/user/' + TEST_USER_ID + '/delete');
    expect(delRes.status).toBe(200);
    expect(delRes.body).toHaveProperty('success', true);

    // Verify it's gone
    const getRes = await request(app).get('/api/user/' + TEST_USER_ID);
    expect(getRes.body.party).toEqual([]);
  });
});
