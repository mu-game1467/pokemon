const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';

const app = require('../../local-server.js');
const { safeUserId, getUserFilePath, getAccounts, saveAccounts } = require('../../local-server.js');

const TEST_USER = 'testuser_auth';
const TEST_PASS = 'testpass123';

function getAuthHeaders(token) {
  return { Authorization: 'Bearer ' + token };
}

describe('Server API: safeUserId', () => {
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

describe('Server API: /api/register and /api/login', () => {
  test('register creates a new account', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: TEST_USER, password: TEST_PASS });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('username', TEST_USER);
  });

  test('register rejects duplicate username', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: TEST_USER, password: TEST_PASS });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  test('register rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: '', password: '' });
    expect(res.status).toBe(400);
  });

  test('login succeeds with correct credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: TEST_USER, password: TEST_PASS });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('username', TEST_USER);
  });

  test('login fails with wrong password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: TEST_USER, password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('login fails with nonexistent user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'nonexistent', password: 'whatever' });
    expect(res.status).toBe(401);
  });
});

describe('Server API: /api/data (authenticated)', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: TEST_USER, password: TEST_PASS });
    token = res.body.token;
  });

  test('GET returns default structure', async () => {
    const res = await request(app)
      .get('/api/data')
      .set(getAuthHeaders(token));
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
      savedParties: [{ name: 'テストパーティ', party: [] }],
      battleLogs: [{ result: 'win' }],
      memo: 'テストメモ',
      partyName: 'テストチーム'
    };

    const postRes = await request(app)
      .post('/api/data')
      .set(getAuthHeaders(token))
      .send(testData);

    expect(postRes.status).toBe(200);
    expect(postRes.body).toHaveProperty('success', true);

    const getRes = await request(app)
      .get('/api/data')
      .set(getAuthHeaders(token));
    expect(getRes.status).toBe(200);
    expect(getRes.body.party).toEqual(testData.party);
    expect(getRes.body.memo).toBe('テストメモ');
    expect(getRes.body.partyName).toBe('テストチーム');
    expect(getRes.body).toHaveProperty('updatedAt');
  });

  test('GET without token returns 401', async () => {
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('DELETE removes user data', async () => {
    await request(app)
      .post('/api/data')
      .set(getAuthHeaders(token))
      .send({ party: [{ name: 'to-delete' }] });

    const delRes = await request(app)
      .post('/api/data/delete')
      .set(getAuthHeaders(token));
    expect(delRes.status).toBe(200);
    expect(delRes.body).toHaveProperty('success', true);

    const getRes = await request(app)
      .get('/api/data')
      .set(getAuthHeaders(token));
    expect(getRes.body.party).toEqual([]);
  });
});

describe('Server API: /api/user/:userId/exists (legacy)', () => {
  test('returns exists status', async () => {
    const res = await request(app).get('/api/user/' + TEST_USER + '/exists');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exists');
  });
});

afterAll(async () => {
  const accounts = getAccounts();
  if (accounts[TEST_USER]) {
    delete accounts[TEST_USER];
    saveAccounts(accounts);
  }
  const filePath = getUserFilePath(TEST_USER);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
});
