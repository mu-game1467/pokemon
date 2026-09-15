const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

// -- 実ユーザーデータを汚さないよう、os.homedir を一時ディレクトリに差し替えてから
//    static-server.js を読み込む（DATA_DIR は require 時に決定される）
const FAKE_HOME = path.join(os.tmpdir(), 'pokemon-server-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
os.homedir = () => FAKE_HOME;

const app = require(path.join(__dirname, '..', '..', 'static-server.js'));

afterAll(() => {
  try {
    fs.rmSync(FAKE_HOME, { recursive: true, force: true });
  } catch (e) {
    console.error('cleanup failed:', e);
  }
});

const DEFAULTS = { party: [], savedParties: [], battleLogs: [], memo: '', partyName: '' };

describe('GET /api/user/:userId', () => {
  test('存在しないユーザーは空デフォルトを200で返す', async () => {
    const res = await request(app).get('/api/user/nonexistent-user-' + Date.now());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULTS);
  });

  test('サニタイズ後に空になるユーザーIDは400', async () => {
    // '!' は safeUserId で除去され空文字 → 400
    const res = await request(app).get('/api/user/%21');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid user ID' });
  });

  test('パストラバーサル（..）はルートにマッチせず404', async () => {
    const res = await request(app).get('/api/user/%2e%2e');
    expect(res.status).toBe(404);
  });

  test('ユーザーIDはサニタイズされ文字化けや区切りは除去される', async () => {
    const dirty = encodeURIComponent('héllo/名');
    const res = await request(app).get('/api/user/' + dirty);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULTS);
  });
});

describe('user-server POST/GET 往復', () => {
  const user = 'roundtrip-' + Date.now();

  test('POST 保存 → GET で取得できる', async () => {
    const data = {
      party: [{ name: 'フシギバナ' }, { name: 'リザードン' }],
      savedParties: [{ name: 'PT1', party: [{ name: 'フシギバナ' }], savedAt: '2026-01-01T00:00:00.000Z' }],
      battleLogs: [{ id: 'b1', result: 'win' }],
      memo: 'テストメモ',
      partyName: 'サンプルパーティ',
    };
    const post = await request(app).post('/api/user/' + user).send(data);
    expect(post.status).toBe(200);
    expect(post.body).toEqual({ success: true });

    const get = await request(app).get('/api/user/' + user);
    expect(get.status).toBe(200);
    expect(get.body.party).toEqual(data.party);
    expect(get.body.savedParties).toEqual(data.savedParties);
    expect(get.body.battleLogs).toEqual(data.battleLogs);
    expect(get.body.memo).toBe('テストメモ');
    expect(get.body.partyName).toBe('サンプルパーティ');
    expect(get.body.updatedAt).toBeDefined();
  });

  test('部分POSTは既存フィールドを保持して上書きマージする', async () => {
    const u = 'partial-' + Date.now();
    await request(app).post('/api/user/' + u).send({ party: [1, 2], partyName: 'x' });
    const res2 = await request(app).post('/api/user/' + u).send({ memo: '新しいメモ' });
    expect(res2.status).toBe(200);
    const get = await request(app).get('/api/user/' + u);
    expect(get.body.party).toEqual([1, 2]);
    expect(get.body.partyName).toBe('x');
    expect(get.body.memo).toBe('新しいメモ');
    expect(get.body.savedParties).toEqual([]);
  });

  test('accountフィールドも保持される', async () => {
    const u = 'acct-' + Date.now();
    await request(app).post('/api/user/' + u).send({ account: { hash: 'abc', createdAt: 'x' } });
    const get = await request(app).get('/api/user/' + u);
    expect(get.body.account).toEqual({ hash: 'abc', createdAt: 'x' });
  });
});

describe('ユーザーIDの安全化（パストラバーサル防止）', () => {
  test('サニタイズ後は実ファイルを越えられない', async () => {
    // '/api/user/%2e%2e%2f..%2fetc' はデコード後に '../../etc' と見えるが、
    // safeUserId により 'etc' として扱われるため、ファイルシステム脱出は起きない
    const res = await request(app).get('/api/user/%2e%2e%2f..%2fetc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULTS); // ただの 'etc' ユーザーとして読まれる
    const fs = require('fs');
    expect(fs.existsSync(path.join(process.cwd(), 'etc.json'))).toBe(false);
  });
});