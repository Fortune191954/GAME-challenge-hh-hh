const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const users = {};

app.use(express.json());

// 游戏代码现在只有一份，就在仓库根目录（GitHub Pages 部署的也是这一份）。
// 直接托管根目录，但要挡掉开发文件，避免把 node_modules、源码、日志暴露到浏览器。
const BLOCKED_PATHS = /^\/(?:node_modules|\.git|image|test-api\.js|test-game\.js|server\.js|package(?:-lock)?\.json|convert-to-png\.js|generate-backgrounds\.js|[^/]*\.md)\b/i;

app.use((req, res, next) => {
  if (BLOCKED_PATHS.test(req.path)) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

app.use(express.static(__dirname, { dotfiles: 'deny', index: 'index.html' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

function generateUserId() {
  return 'USER_' + Math.random().toString(36).substring(2, 15).toUpperCase();
}

app.post('/api/register', async (req, res) => {
  try {
    console.log('Register request:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (users[username]) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const userId = generateUserId();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    users[username] = {
      userId,
      username,
      password: hashedPassword,
      score: 0,
      level: 1,
      coins: 100,
      inventory: {},
      equipment: { weapon: null, armor: null }
    };
    
    console.log('User registered:', username);
    res.json({ userId, username, score: 0, level: 1, coins: 100 });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('Login request:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = users[username];
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('User logged in:', username);
    res.json({ userId: user.userId, username: user.username, score: user.score, level: user.level, coins: user.coins });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/updateScore', async (req, res) => {
  try {
    const { userId, score, coins } = req.body;
    
    for (const username in users) {
      if (users[username].userId === userId) {
        users[username].score = Math.max(users[username].score, score);
        users[username].coins += coins || 0;
        return res.json({ success: true });
      }
    }
    
    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = Object.values(users)
      .map(u => ({ username: u.username, score: u.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', users: Object.keys(users).length });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop');
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});