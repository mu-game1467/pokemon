const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.pokemon-champions-data', 'users');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeUserId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
}

function getUserFilePath(userId) {
  return path.join(DATA_DIR, safeUserId(userId) + '.json');
}

module.exports = async function handler(req, res) {
  const userId = safeUserId(req.query.userId || '');

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
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (res.status) res.status(200);
      if (res.json) res.json(data);
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); }
    } catch (e) {
      if (res.status) res.status(500);
      if (res.json) res.json({ error: 'Failed to read user data' });
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Failed to read user data' })); }
    }
  } else if (req.method === 'POST') {
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
};
