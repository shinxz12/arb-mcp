declare global {
  namespace Express {
    interface Request {
      user?: { username: string; role: string };
    }
  }
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Bỏ comment nếu chạy cloud DB yêu cầu SSL
  // ssl: { rejectUnauthorized: false }
});

// Hàm khởi tạo DB ban đầu
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(255) PRIMARY KEY,
      role VARCHAR(50), -- 'DEV' or 'PO'
      api_key VARCHAR(255) UNIQUE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(255),
      from_user VARCHAR(255),
      to_user VARCHAR(255),
      content TEXT,
      status VARCHAR(50) DEFAULT 'PENDING',
      reply_to_id INTEGER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(from_user) REFERENCES users(username),
      FOREIGN KEY(to_user) REFERENCES users(username)
    );
  `);
  console.log("Database tables checked/created.");
};

// Middleware kiểm tra API Key
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const apiKey = authHeader.split(' ')[1];
  try {
    const result = await pool.query('SELECT username, role FROM users WHERE api_key = $1', [apiKey]);
    if (result.rows.length === 0) {
      res.status(403).json({ error: 'Invalid API Key' });
      return;
    }
    // Gắn thông tin user vào request để các route sau dùng
    req.user = result.rows[0] as { username: string; role: string };
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database error during authentication' });
  }
};

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Lấy danh sách users
app.get('/users', requireAuth, async (req, res) => {
  const { role } = req.query;
  try {
    if (role) {
      const result = await pool.query('SELECT username, role FROM users WHERE role = $1', [String(role).toUpperCase()]);
      res.json(result.rows);
    } else {
      const result = await pool.query('SELECT username, role FROM users');
      res.json(result.rows);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. Tạo câu hỏi mới
app.post('/messages', requireAuth, async (req, res) => {
  const { ticket_id, to_user, content } = req.body;
  // Dùng username từ token thay vì trust client gửi lên (bảo mật hơn)
  const authenticatedUser = req.user!.username;

  try {
    const result = await pool.query(
      `INSERT INTO messages (ticket_id, from_user, to_user, content) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [ticket_id, authenticatedUser, to_user, content]
    );
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// 3. Xem hộp thư đến
app.get('/messages/inbox', requireAuth, async (req, res) => {
  // Bắt buộc chỉ lấy inbox của người đang cầm API Key này
  const authenticatedUser = req.user!.username;

  try {
    const result = await pool.query(
      `SELECT * FROM messages WHERE to_user = $1 AND status = 'PENDING' ORDER BY timestamp DESC`,
      [authenticatedUser]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// 4. Trả lời câu hỏi
app.post('/messages/:id/reply', requireAuth, async (req, res) => {
  const messageId = req.params.id;
  const { content } = req.body;
  const authenticatedUser = req.user!.username;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Tìm tin nhắn gốc
    const origRes = await client.query('SELECT ticket_id, from_user, to_user FROM messages WHERE id = $1', [messageId]);
    if (origRes.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    
    const original = origRes.rows[0];
    
    // Đảm bảo chỉ người nhận mới được phép reply
    if (original.to_user !== authenticatedUser) {
      res.status(403).json({ error: 'You are not authorized to reply to this message' });
      return;
    }

    // Insert reply
    await client.query(
      `INSERT INTO messages (ticket_id, from_user, to_user, content, reply_to_id, status) 
       VALUES ($1, $2, $3, $4, $5, 'RESOLVED')`,
      [original.ticket_id, authenticatedUser, original.from_user, content, messageId]
    );

    // Update status tin gốc
    await client.query(`UPDATE messages SET status = 'RESOLVED' WHERE id = $1`, [messageId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to reply' });
  } finally {
    client.release();
  }
});

// Endpoint phụ: Đăng ký user nhanh (chỉ dùng lúc đầu setup, thực tế nên giấu hoặc cho Admin)
app.post('/admin/register', async (req, res) => {
  const { username, role, api_key } = req.body;
  try {
    await pool.query(
      `INSERT INTO users (username, role, api_key) VALUES ($1, $2, $3)`,
      [username, role, api_key]
    );
    res.json({ success: true, message: "User registered" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initDb();
  console.log(`VPS Backend API is running on port ${PORT}`);
});
