const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const DATA_DIR = path.join(os.homedir(), '.pokemon-champions-data', 'users');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeUserId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
}

app.get('/api/user/:userId', (req, res) => {
  const userId = safeUserId(req.params.userId || '');
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const filePath = path.join(DATA_DIR, userId + '.json');
  if (!fs.existsSync(filePath)) {
    return res.status(200).json({ party: [], savedParties: [], battleLogs: [], memo: '', partyName: '' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read user data' });
  }
});

app.post('/api/user/:userId', (req, res) => {
  const userId = safeUserId(req.params.userId || '');
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const filePath = path.join(DATA_DIR, userId + '.json');
  const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
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
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save user data' });
  }
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Static server running on port ' + PORT);
  });
}

module.exports = app;
