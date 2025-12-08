const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Configuração do Banco de Dados SQLite ---
const db = new sqlite3.Database('./dma_database.db', (err) => {
    if (err) console.error("Erro ao abrir banco de dados:", err.message);
    else console.log("Conectado ao banco de dados SQLite.");
});

// Cria as tabelas necessárias
db.serialize(() => {
    // Tabela de imagens
    db.run(`
        CREATE TABLE IF NOT EXISTS images (
            image_id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_id TEXT, 
            original_name TEXT,
            mime_type TEXT,
            data BLOB,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de TOKENS
    db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
            token_id TEXT PRIMARY KEY,
            image_id INTEGER,
            pos_x INTEGER DEFAULT 0,
            pos_y INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (image_id) REFERENCES images(image_id)
        )
    `);

    // Tabela de CENAS
    db.run(`
        CREATE TABLE IF NOT EXISTS cenas (
            cena_id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            is_active INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de relacionamento CENA_TOKENS
    db.run(`
        CREATE TABLE IF NOT EXISTS cena_tokens (
            cena_id INTEGER,
            token_id TEXT,
            PRIMARY KEY (cena_id, token_id),
            FOREIGN KEY (cena_id) REFERENCES cenas(cena_id) ON DELETE CASCADE,
            FOREIGN KEY (token_id) REFERENCES tokens(token_id) ON DELETE CASCADE
        )
    `);
});

// --- Configuração do Express e Socket.io ---
const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

// --- Configuração do Multer ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Rotas HTTP (API de Imagens) ---

// Upload de Imagem
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const tokenId = req.body.token_id || `token-${Date.now()}`;
    
    const sql = `INSERT INTO images (token_id, original_name, mime_type, data) VALUES (?, ?, ?, ?)`;
    const params = [tokenId, req.file.originalname, req.file.mimetype, req.file.buffer];

    db.run(sql, params, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao salvar imagem no banco.' });
        }
        
        const imageUrl = `${req.protocol}://${req.get('host')}/api/image/${this.lastID}`;
        
        res.json({ 
            url: imageUrl, 
            image_id: this.lastID, 
            token_id: tokenId 
        });
    });
});

// Recuperar Imagem
app.get('/api/image/:id', (req, res) => {
    const sql = `SELECT mime_type, data FROM images WHERE image_id = ?`;
    
    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Imagem não encontrada.' });

        res.setHeader('Content-Type', row.mime_type);
        res.setHeader('Content-Length', row.data.length);
        res.send(row.data);
    });
});

// Listar Imagens
app.get('/api/images/list', (req, res) => {
    db.all("SELECT image_id, token_id, original_name FROM images", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- API de Tokens ---

// Criar ou atualizar token
app.post('/api/tokens', (req, res) => {
    const { token_id, image_id, pos_x, pos_y } = req.body;
    
    if (!token_id) {
        return res.status(400).json({ error: 'token_id é obrigatório' });
    }

    const sql = `
        INSERT INTO tokens (token_id, image_id, pos_x, pos_y, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(token_id) DO UPDATE SET
            image_id = excluded.image_id,
            pos_x = excluded.pos_x,
            pos_y = excluded.pos_y,
            updated_at = CURRENT_TIMESTAMP
    `;

    db.run(sql, [token_id, image_id, pos_x || 0, pos_y || 0], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao salvar token.' });
        }
        res.json({ token_id, image_id, pos_x, pos_y });
    });
});

// Atualizar posição de um token
app.patch('/api/tokens/:token_id/position', (req, res) => {
    const { token_id } = req.params;
    const { pos_x, pos_y } = req.body;

    const sql = `
        UPDATE tokens 
        SET pos_x = ?, pos_y = ?, updated_at = CURRENT_TIMESTAMP
        WHERE token_id = ?
    `;

    db.run(sql, [pos_x, pos_y, token_id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao atualizar posição.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Token não encontrado.' });
        }
        res.json({ token_id, pos_x, pos_y });
    });
});

// Listar todos os tokens
app.get('/api/tokens', (req, res) => {
    const sql = `
        SELECT t.token_id, t.image_id, t.pos_x, t.pos_y, t.created_at, t.updated_at
        FROM tokens t
        ORDER BY t.created_at DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Deletar token
app.delete('/api/tokens/:token_id', (req, res) => {
    const { token_id } = req.params;
    
    db.run('DELETE FROM tokens WHERE token_id = ?', [token_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Token não encontrado.' });
        }
        res.json({ deleted: token_id });
    });
});

// --- API de Cenas ---

// Criar cena
app.post('/api/cenas', (req, res) => {
    const { nome, descricao } = req.body;
    
    if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const sql = `INSERT INTO cenas (nome, descricao) VALUES (?, ?)`;
    
    db.run(sql, [nome, descricao || ''], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao criar cena.' });
        }
        res.json({ cena_id: this.lastID, nome, descricao });
    });
});

// Listar todas as cenas (com seus tokens)
app.get('/api/cenas', (req, res) => {
    const sql = `
        SELECT c.cena_id, c.nome, c.descricao, c.is_active, c.created_at, c.updated_at
        FROM cenas c
        ORDER BY c.updated_at DESC
    `;
    
    db.all(sql, [], (err, cenas) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const promises = cenas.map(cena => {
            return new Promise((resolve, reject) => {
                const tokenSql = `
                    SELECT ct.token_id
                    FROM cena_tokens ct
                    WHERE ct.cena_id = ?
                `;
                
                db.all(tokenSql, [cena.cena_id], (err, tokens) => {
                    if (err) reject(err);
                    else {
                        cena.tokens = tokens.map(t => t.token_id);
                        resolve(cena);
                    }
                });
            });
        });
        
        Promise.all(promises)
            .then(result => res.json(result))
            .catch(err => res.status(500).json({ error: err.message }));
    });
});

// Obter a cena ativa
app.get('/api/cenas/active', (req, res) => {
    const cenaSql = `SELECT * FROM cenas WHERE is_active = 1 LIMIT 1`;
    
    db.get(cenaSql, [], (err, cena) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!cena) return res.json(null); // Nenhuma cena ativa
        
        const tokensSql = `
            SELECT t.token_id, t.image_id, t.pos_x, t.pos_y
            FROM tokens t
            INNER JOIN cena_tokens ct ON t.token_id = ct.token_id
            WHERE ct.cena_id = ?
        `;
        
        db.all(tokensSql, [cena.cena_id], (err, tokens) => {
            if (err) return res.status(500).json({ error: err.message });
            cena.tokens = tokens;
            res.json(cena);
        });
    });
});

// Obter uma cena específica com detalhes completos dos tokens
app.get('/api/cenas/:cena_id', (req, res) => {
    const { cena_id } = req.params;
    
    const cenaSql = `SELECT * FROM cenas WHERE cena_id = ?`;
    
    db.get(cenaSql, [cena_id], (err, cena) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!cena) return res.status(404).json({ error: 'Cena não encontrada.' });
        
        const tokensSql = `
            SELECT t.token_id, t.image_id, t.pos_x, t.pos_y
            FROM tokens t
            INNER JOIN cena_tokens ct ON t.token_id = ct.token_id
            WHERE ct.cena_id = ?
        `;
        
        db.all(tokensSql, [cena_id], (err, tokens) => {
            if (err) return res.status(500).json({ error: err.message });
            cena.tokens = tokens;
            res.json(cena);
        });
    });
});

// Ativar uma cena (define como cena ativa)
app.post('/api/cenas/:cena_id/activate', (req, res) => {
    const { cena_id } = req.params;
    
    // Desativa todas as cenas primeiro
    db.run('UPDATE cenas SET is_active = 0', [], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Ativa a cena escolhida
        db.run('UPDATE cenas SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE cena_id = ?', [cena_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Cena não encontrada.' });
            }
            
            console.log(`✅ Cena ${cena_id} ativada!`);
            res.json({ cena_id, active: true });
        });
    });
});

// Atualizar cena
app.patch('/api/cenas/:cena_id', (req, res) => {
    const { cena_id } = req.params;
    const { nome, descricao } = req.body;
    
    const sql = `
        UPDATE cenas 
        SET nome = COALESCE(?, nome), 
            descricao = COALESCE(?, descricao),
            updated_at = CURRENT_TIMESTAMP
        WHERE cena_id = ?
    `;
    
    db.run(sql, [nome, descricao, cena_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Cena não encontrada.' });
        }
        res.json({ cena_id, nome, descricao });
    });
});

// Deletar cena
app.delete('/api/cenas/:cena_id', (req, res) => {
    const { cena_id } = req.params;
    
    db.run('DELETE FROM cenas WHERE cena_id = ?', [cena_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Cena não encontrada.' });
        }
        res.json({ deleted: cena_id });
    });
});

// Adicionar token a uma cena
app.post('/api/cenas/:cena_id/tokens', (req, res) => {
    const { cena_id } = req.params;
    const { token_id } = req.body;
    
    if (!token_id) {
        return res.status(400).json({ error: 'token_id é obrigatório' });
    }
    
    const sql = `INSERT INTO cena_tokens (cena_id, token_id) VALUES (?, ?)`;
    
    db.run(sql, [cena_id, token_id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Token já está nesta cena.' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ cena_id, token_id });
    });
});

// Remover token de uma cena
app.delete('/api/cenas/:cena_id/tokens/:token_id', (req, res) => {
    const { cena_id, token_id } = req.params;
    
    const sql = `DELETE FROM cena_tokens WHERE cena_id = ? AND token_id = ?`;
    
    db.run(sql, [cena_id, token_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Relação não encontrada.' });
        }
        res.json({ removed: token_id, from_cena: cena_id });
    });
});

// --- Socket.IO ---
const io = new Server(server, {
    cors: {
        origin: "*",  
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log(`🔌 Socket conectado: ${socket.id}`);

    // NOVO: Quando alguém conecta, envia a cena ativa
    const cenaSql = `SELECT * FROM cenas WHERE is_active = 1 LIMIT 1`;
    
    db.get(cenaSql, [], (err, cena) => {
        if (err || !cena) {
            console.log('Nenhuma cena ativa para enviar');
            return;
        }
        
        const tokensSql = `
            SELECT t.token_id, t.image_id, t.pos_x, t.pos_y
            FROM tokens t
            INNER JOIN cena_tokens ct ON t.token_id = ct.token_id
            WHERE ct.cena_id = ?
        `;
        
        db.all(tokensSql, [cena.cena_id], (err, tokens) => {
            if (err) return;
            
            cena.tokens = tokens;
            console.log(`📤 Enviando cena ativa "${cena.nome}" para ${socket.id}`);
            socket.emit("LoadActiveScene", cena);
        });
    });

    // NOVO: Quando alguém carrega uma cena, ativa ela e notifica todos
    socket.on("ActivateScene", (cenaId) => {
        console.log(`🎬 Ativando cena ${cenaId}`);
        
        // Desativa todas
        db.run('UPDATE cenas SET is_active = 0', [], (err) => {
            if (err) return;
            
            // Ativa a nova
            db.run('UPDATE cenas SET is_active = 1 WHERE cena_id = ?', [cenaId], (err) => {
                if (err) return;
                
                // Busca a cena completa
                const cenaSql = `SELECT * FROM cenas WHERE cena_id = ?`;
                db.get(cenaSql, [cenaId], (err, cena) => {
                    if (err || !cena) return;
                    
                    const tokensSql = `
                        SELECT t.token_id, t.image_id, t.pos_x, t.pos_y
                        FROM tokens t
                        INNER JOIN cena_tokens ct ON t.token_id = ct.token_id
                        WHERE ct.cena_id = ?
                    `;
                    
                    db.all(tokensSql, [cenaId], (err, tokens) => {
                        if (err) return;
                        
                        cena.tokens = tokens;
                        console.log(`📢 Broadcast: Cena "${cena.nome}" ativa para TODOS`);
                        
                        // Envia para TODOS os clientes (incluindo quem ativou)
                        io.emit("LoadActiveScene", cena);
                    });
                });
            });
        });
    });

    // Quando um token se move
    socket.on("TokenMoved", (data) => {
        console.log(`Move Token: ${data.id} -> (${data.x}, ${data.y})`);
        
        // Atualiza posição no banco de dados
        const sql = `
            UPDATE tokens 
            SET pos_x = ?, pos_y = ?, updated_at = CURRENT_TIMESTAMP
            WHERE token_id = ?
        `;
        
        db.run(sql, [data.x, data.y, data.id], (err) => {
            if (err) console.error('Erro ao atualizar posição do token:', err);
        });
        
        // Broadcast para outros clientes
        socket.broadcast.emit("TokenMoved", data);
    });

    // Quando um token é criado
    socket.on("CreateToken", (data) => {
        console.log(`Novo Token Criado: ${data.id} com imagem ${data.imageId}`);
        
        // Salva o token no banco de dados
        const sql = `
            INSERT INTO tokens (token_id, image_id, pos_x, pos_y) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(token_id) DO UPDATE SET
                image_id = excluded.image_id,
                pos_x = excluded.pos_x,
                pos_y = excluded.pos_y,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        db.run(sql, [data.id, data.imageId, data.x, data.y], (err) => {
            if (err) console.error('Erro ao salvar token:', err);
        });
        
        // Broadcast para outros clientes
        socket.broadcast.emit("TokenCreated", data);
    });

    socket.on("disconnect", () => {
        console.log("Socket desconectado:", socket.id);
    });
});

// --- Inicialização ---
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
    console.log(`\n=== ROTAS DE IMAGENS ===`);
    console.log(`- Upload (POST):  http://localhost:${PORT}/api/upload`);
    console.log(`- Imagens (GET):  http://localhost:${PORT}/api/image/:id`);
    console.log(`- Listar (GET):   http://localhost:${PORT}/api/images/list`);
    console.log(`\n=== ROTAS DE TOKENS ===`);
    console.log(`- Criar/Atualizar (POST):    http://localhost:${PORT}/api/tokens`);
    console.log(`- Listar (GET):              http://localhost:${PORT}/api/tokens`);
    console.log(`- Atualizar Posição (PATCH): http://localhost:${PORT}/api/tokens/:token_id/position`);
    console.log(`- Deletar (DELETE):          http://localhost:${PORT}/api/tokens/:token_id`);
    console.log(`\n=== ROTAS DE CENAS ===`);
    console.log(`- Criar (POST):              http://localhost:${PORT}/api/cenas`);
    console.log(`- Listar (GET):              http://localhost:${PORT}/api/cenas`);
    console.log(`- Cena Ativa (GET):          http://localhost:${PORT}/api/cenas/active`);
    console.log(`- Ver Cena (GET):            http://localhost:${PORT}/api/cenas/:cena_id`);
    console.log(`- Ativar Cena (POST):        http://localhost:${PORT}/api/cenas/:cena_id/activate`);
    console.log(`- Atualizar (PATCH):         http://localhost:${PORT}/api/cenas/:cena_id`);
    console.log(`- Deletar (DELETE):          http://localhost:${PORT}/api/cenas/:cena_id`);
    console.log(`- Adicionar Token (POST):    http://localhost:${PORT}/api/cenas/:cena_id/tokens`);
    console.log(`- Remover Token (DELETE):    http://localhost:${PORT}/api/cenas/:cena_id/tokens/:token_id`);
});