const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data', 'users');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeUserId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
}

function getUserFilePath(userId) {
  return path.join(DATA_DIR, safeUserId(userId) + '.json');
}

app.get('/api/user/:userId', (req, res) => {
  const userId = safeUserId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
  const filePath = getUserFilePath(userId);
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

app.post('/api/user/:userId', (req, res) => {
  const userId = safeUserId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
  const filePath = getUserFilePath(userId);
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

app.post('/api/user/:userId/delete', (req, res) => {
  const userId = safeUserId(req.params.userId);
  const filePath = getUserFilePath(userId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

app.get('/api/user/:userId/exists', (req, res) => {
  const userId = safeUserId(req.params.userId);
  const filePath = getUserFilePath(userId);
  res.json({ exists: fs.existsSync(filePath) });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
