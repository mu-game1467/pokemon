const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data', 'users');
const ACCOUNTS_FILE = path.join(__dirname, 'data', 'accounts.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(path.dirname(ACCOUNTS_FILE))) {
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
}

function safeUserId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
}

function getUserFilePath(userId) {
  return path.join(DATA_DIR, safeUserId(userId) + '.json');
}

function getAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch(e) {
    console.error('Failed to read accounts:', e);
    return {};
  }
}

function saveAccounts(accounts) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
  } catch(e) {
    console.error('Failed to save accounts:', e);
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const sessions = new Map();

function authenticate(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.body?.token;
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.username = session.username;
  req.userId = safeUserId(session.username);
  next();
}

app.get('/api/user/:userId/exists', (req, res) => {
  const userId = safeUserId(req.params.userId);
  const filePath = getUserFilePath(userId);
  res.json({ exists: fs.existsSync(filePath) });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください。' });
  }
  const safeName = safeUserId(username);
  if (!safeName) {
    return res.status(400).json({ error: '無効なユーザー名です。' });
  }
  const accounts = getAccounts();
  if (accounts[safeName]) {
    return res.status(409).json({ error: 'このユーザー名は既に使用されています。' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  accounts[safeName] = { salt, hash, createdAt: new Date().toISOString() };
  saveAccounts(accounts);
  fs.writeFileSync(getUserFilePath(safeName), JSON.stringify({ party: [], savedParties: [], battleLogs: [], memo: '', partyName: '', updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  res.json({ success: true, username: safeName });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください。' });
  }
  const safeName = safeUserId(username);
  const accounts = getAccounts();
  const account = accounts[safeName];
  if (!account) {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています。' });
  }
  const hash = hashPassword(password, account.salt);
  if (hash !== account.hash) {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています。' });
  }
  const token = generateToken();
  sessions.set(token, { username: safeName, createdAt: Date.now() });
   setTimeout(() => sessions.delete(token), 24 * 60 * 60 * 1000).unref();
  res.json({ success: true, token, username: safeName });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.body?.token;
  if (token && sessions.has(token)) {
    sessions.delete(token);
  }
  res.json({ success: true });
});

app.get('/api/data', authenticate, (req, res) => {
  const filePath = getUserFilePath(req.userId);
  if (!fs.existsSync(filePath)) {
    return res.json({ party: [], savedParties: [], battleLogs: [], memo: '', partyName: '' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'Failed to read user data' });
  }
});

app.post('/api/data', authenticate, (req, res) => {
  const filePath = getUserFilePath(req.userId);
  const data = {
    party: req.body.party || [],
    savedParties: req.body.savedParties || [],
    battleLogs: req.body.battleLogs || [],
    memo: req.body.memo || '',
    partyName: req.body.partyName || '',
    updatedAt: new Date().toISOString()
  };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to save user data' });
  }
});

app.post('/api/data/delete', authenticate, (req, res) => {
  const filePath = getUserFilePath(req.userId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('Server running on port ' + PORT);
    console.log('Local:  http://localhost:' + PORT);
    console.log('Network: http://' + ip + ':' + PORT);
  });
}

module.exports = app;
module.exports.safeUserId = safeUserId;
module.exports.getUserFilePath = getUserFilePath;
module.exports.hashPassword = hashPassword;
module.exports.getAccounts = getAccounts;
module.exports.saveAccounts = saveAccounts;
