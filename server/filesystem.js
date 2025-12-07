// src/server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');

const db = require('./db');

const app = express();
const PORT = 4000;
app.use(cors({
  origin: "*",   // permite só o React
  credentials: true
}));
// Ensure folders exist
fs.mkdirSync('./storage', { recursive: true });

// Multer: store in memory first (we'll write manually)
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  storage: multer.memoryStorage()
});

// Fake auth — in real app you'd have JWT/session
const getUserId = (req) => {
  // For demo: use header or default to "user1"
  return req.headers['x-user-id'] || 'user1';
};

// Middleware: ensure user exists
const ensureUser = (req, res, next) => {
  const userId = getUserId(req);
  db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, row) => {
    if (!row) {
      db.run(`INSERT INTO users(user_id) VALUES(?)`, [userId]);
    }
    req.userId = userId;
    next();
  });
};

app.use(express.json());
app.use(ensureUser);

// 1. Upload file
// UPLOAD ENDPOINT – VERSÃO CORRIGIDA E TESTADA
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const userId = req.userId;

  // Primeiro: insere no banco e pega o ID autoincrementado
  db.run(
    `INSERT INTO files (user_id, original_name, mime_type, size, path) 
     VALUES (?, ?, ?, ?, ?)`,
    [userId, req.file.originalname, req.file.mimetype, req.file.size, 'temp-path'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const fileId = this.lastID;                    // ← ID numérico sequencial!
      const ext = path.extname(req.file.originalname) || '';
      const filename = `${fileId}${ext}`;

      // CORREÇÃO: caminho absoluto garantido
      const storageDir = path.join(__dirname, 'storage');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const filePath = path.join(storageDir, filename);

      // Salva o arquivo físico
      fs.writeFile(filePath, req.file.buffer, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save file' });

        // Atualiza o caminho real no banco
        db.run(`UPDATE files SET path = ? WHERE id = ?`, [filePath, fileId], () => {
          // Atualiza quota
          db.run(`UPDATE users SET used_bytes = used_bytes + ? WHERE user_id = ?`, [req.file.size, userId]);

          res.json({
            id: fileId,
            name: req.file.originalname,
            size: req.file.size,
            url: `http://localhost:${PORT}/files/${fileId}`
          });
        });
      });
    }
  );
});

// 2. Serve file securely by ID
app.get('/files/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  db.get(`SELECT * FROM files WHERE id = ? AND user_id = ?`, [id, userId], (err, file) => {
    if (err || !file) return res.status(404).send('Not found');

    // file.path já está salvo como caminho absoluto
    res.sendFile(file.path, (err) => {
      if (err) res.status(500).send('Error serving file');
    });
  });
});
// 3. List files + quota
app.get('/api/files', (req, res) => {
  const userId = req.userId;
  db.get(`SELECT used_bytes, quota_bytes FROM users WHERE user_id = ?`, [userId], (err, quota) => {
    db.all(`SELECT id, original_name, size, mime_type, uploaded_at FROM files WHERE user_id = ? ORDER BY uploaded_at DESC`, [userId], (err, files) => {
      res.json({
        files,
        quota: {
          used: quota.used_bytes,
          total: quota.quota_bytes,
          percent: ((quota.used_bytes / quota.quota_bytes) * 100).toFixed(1)
        }
      });
    });
  });
});

// 4. Delete file
app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  db.get(`SELECT * FROM files WHERE id = ? AND user_id = ?`, [id, userId], (err, file) => {
    if (!file) return res.status(404).json({ error: 'Not found' });

    fs.unlink(file.path, () => { /* ignore error if already gone */ });
    db.run(`DELETE FROM files WHERE id = ?`, [id]);
    db.run(`UPDATE users SET used_bytes = used_bytes - ? WHERE user_id = ?`, [file.size, userId]);

    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Local file server running at http://localhost:${PORT}`);
  console.log(`Upload test: curl -F "file=@mytoken.png" -H "x-user-id: player1" http://localhost:${PORT}/api/upload`);
});