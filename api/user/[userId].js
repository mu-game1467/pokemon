const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = process.env.VERCEL ? path.join(os.tmpdir(), 'pokemon-champions-users') : path.join(os.homedir(), '.pokemon-champions-data', 'users');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch(e) {
    console.error('Failed to create data dir:', e);
  }
}

function safeUserId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
}

function getUserFilePath(userId) {
  return path.join(DATA_DIR, safeUserId(userId) + '.json');
}

module.exports = async function handler(req, res) {
  try {
  const userId = safeUserId((req.query.userId || req.params?.userId || '') + '');

  if (!userId) {
    if (res.status) res.status(400);
    else res.statusCode = 400;
    if (res.json) res.json({ error: 'Invalid user ID' });
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid user ID' })); }
    return;
  }

  const filePath = getUserFilePath(userId);

  if (req.method === 'GET') {
    if (!fs.existsSync(filePath)) {
      if (res.status) res.status(200);
      const data = { party: [], savedParties: [], battleLogs: [], memo: '', partyName: '' };
      if (res.json) res.json(data);
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); }
      return;
    }
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (res.status) res.status(200);
      if (res.json) res.json(existing);
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(existing)); }
    } catch (e) {
      if (res.status) res.status(500);
      if (res.json) res.json({ error: 'Failed to read user data' });
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Failed to read user data' })); }
    }
  } else if (req.method === 'POST') {
    let existing = {};
    try { existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {}; } catch(e) {}
    const data = {
      party: req.body.party !== undefined ? req.body.party : (existing.party || []),
      savedParties: req.body.savedParties !== undefined ? req.body.savedParties : (existing.savedParties || []),
      battleLogs: req.body.battleLogs !== undefined ? req.body.battleLogs : (existing.battleLogs || []),
      memo: req.body.memo !== undefined ? req.body.memo : (existing.memo || ''),
      partyName: req.body.partyName !== undefined ? req.body.partyName : (existing.partyName || ''),
      account: req.body.account !== undefined ? req.body.account : (existing.account || null),
      updatedAt: new Date().toISOString()
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      if (res.status) res.status(200);
      if (res.json) res.json({ success: true });
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true })); }
    } catch (e) {
      if (res.status) res.status(500);
      if (res.json) res.json({ error: 'Failed to save user data' });
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Failed to save user data' })); }
    }
  } else {
    if (res.status) res.status(405);
    if (res.json) res.json({ error: 'Method not allowed' });
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Method not allowed' })); }
  }
  } catch(e) {
    console.error('Handler error:', e);
    try {
      if (res.status) res.status(500);
      if (res.json) res.json({ error: 'Server error' });
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Server error' })); }
    } catch(e2) {}
  }
};
