const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.tmpdir(), 'pokemon-champions-users');

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
  const userId = safeUserId((req.query?.userId || req.params?.userId || '') + '');

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
    const body = req.body || {};
    const data = {
      party: body.party !== undefined ? body.party : (existing.party || []),
      savedParties: body.savedParties !== undefined ? body.savedParties : (existing.savedParties || []),
      battleLogs: body.battleLogs !== undefined ? body.battleLogs : (existing.battleLogs || []),
      memo: body.memo !== undefined ? body.memo : (existing.memo || ''),
      partyName: body.partyName !== undefined ? body.partyName : (existing.partyName || ''),
      account: body.account !== undefined ? body.account : (existing.account || null),
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
