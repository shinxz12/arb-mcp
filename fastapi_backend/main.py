import os
from contextlib import asynccontextmanager
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Security, Request, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import asyncpg
import secrets
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)
    
    async with pool.acquire() as conn:
        # DROP OLD TABLES FOR CLEAN DEPLOYMENT
        await conn.execute("DROP TABLE IF EXISTS messages CASCADE")
        await conn.execute("DROP TABLE IF EXISTS users CASCADE")
        await conn.execute("DROP TABLE IF EXISTS conversations CASCADE")
        await conn.execute("DROP TABLE IF EXISTS participants CASCADE")

        # NEW SCHEMA WITH WORKFLOW FEATURES
        await conn.execute("""
            CREATE TABLE users (
                username VARCHAR(255) PRIMARY KEY,
                role VARCHAR(50),
                api_key VARCHAR(255) UNIQUE,
                status VARCHAR(50) DEFAULT 'ACTIVE', -- 'ACTIVE' or 'OOO'
                delegate_to VARCHAR(255) REFERENCES users(username) -- Who to route to if OOO
            );

            CREATE TABLE conversations (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                tickets TEXT[],
                status VARCHAR(50) DEFAULT 'OPEN',
                priority VARCHAR(50) DEFAULT 'NORMAL', -- 'NORMAL', 'HIGH', 'BLOCKING'
                created_by VARCHAR(255) REFERENCES users(username),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE participants (
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                username VARCHAR(255) REFERENCES users(username),
                PRIMARY KEY (conversation_id, username)
            );

            CREATE TABLE messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                from_user VARCHAR(255) REFERENCES users(username),
                content TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
    yield
    await pool.close()

app = FastAPI(lifespan=lifespan)
templates = Jinja2Templates(directory="templates")
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    api_key = credentials.credentials
    async with pool.acquire() as conn:
        user = await conn.fetchrow('SELECT * FROM users WHERE api_key = $1', api_key)
        if not user:
            raise HTTPException(status_code=403, detail="Invalid API Key")
        return dict(user)

# ==========================================
# NHÓM 1: TỐI ƯU CHO AI (SEARCH & PRIORITY)
# ==========================================

@app.get("/conversations/search")
async def search_conversations(q: str, user: dict = Depends(get_current_user)):
    # Tìm kiếm theo title hoặc content của tin nhắn
    async with pool.acquire() as conn:
        query = """
            SELECT DISTINCT c.id, c.title, c.tickets, c.status
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.title ILIKE $1 OR m.content ILIKE $1
            ORDER BY c.id DESC LIMIT 10
        """
        rows = await conn.fetch(query, f"%{q}%")
        return [dict(row) for row in rows]

class PriorityUpdate(BaseModel):
    priority: str

@app.put("/conversations/{conv_id}/priority")
async def update_priority(conv_id: int, payload: PriorityUpdate, user: dict = Depends(get_current_user)):
    if payload.priority not in ['NORMAL', 'HIGH', 'BLOCKING']:
        raise HTTPException(status_code=400, detail="Invalid priority")
        
    async with pool.acquire() as conn:
        is_part = await conn.fetchval("SELECT 1 FROM participants WHERE conversation_id = $1 AND username = $2", conv_id, user['username'])
        if not is_part:
            raise HTTPException(status_code=403, detail="Not in conversation")
            
        await conn.execute("UPDATE conversations SET priority = $1 WHERE id = $2", payload.priority, conv_id)
        
        # Thêm log message
        await conn.execute(
            "INSERT INTO messages (conversation_id, from_user, content) VALUES ($1, $2, $3)",
            conv_id, user['username'], f"[SYSTEM] Priority updated to {payload.priority}"
        )
        return {"success": True}

# ==========================================
# NHÓM 2: TƯƠNG TÁC CON NGƯỜI (STATUS & PARTICIPANTS)
# ==========================================

class StatusUpdate(BaseModel):
    status: str
    delegate_to: Optional[str] = None

@app.put("/users/status")
async def update_status(payload: StatusUpdate, user: dict = Depends(get_current_user)):
    if payload.status not in ['ACTIVE', 'OOO']:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE or OOO")
        
    async with pool.acquire() as conn:
        if payload.delegate_to:
            exists = await conn.fetchval("SELECT 1 FROM users WHERE username = $1", payload.delegate_to)
            if not exists:
                raise HTTPException(status_code=400, detail="Delegate user not found")
                
        await conn.execute(
            "UPDATE users SET status = $1, delegate_to = $2 WHERE username = $3",
            payload.status, payload.delegate_to, user['username']
        )
        return {"success": True}

class AddParticipant(BaseModel):
    username: str

@app.post("/conversations/{conv_id}/participants")
async def add_participant(conv_id: int, payload: AddParticipant, user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        is_part = await conn.fetchval("SELECT 1 FROM participants WHERE conversation_id = $1 AND username = $2", conv_id, user['username'])
        if not is_part:
            raise HTTPException(status_code=403, detail="Not in conversation")
            
        exists = await conn.fetchval("SELECT 1 FROM users WHERE username = $1", payload.username)
        if not exists:
            raise HTTPException(status_code=404, detail="User not found")
            
        try:
            await conn.execute("INSERT INTO participants (conversation_id, username) VALUES ($1, $2)", conv_id, payload.username)
            await conn.execute(
                "INSERT INTO messages (conversation_id, from_user, content) VALUES ($1, $2, $3)",
                conv_id, user['username'], f"[SYSTEM] Added {payload.username} to the conversation."
            )
        except asyncpg.exceptions.UniqueViolationError:
            pass # Already participant
            
        return {"success": True}

# ==========================================
# CÁC API CORE CŨ (Đã update logic OOO Routing)
# ==========================================


@app.get("/users")
async def get_users(role: Optional[str] = None, user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        if role:
            rows = await conn.fetch('SELECT username, role, status, delegate_to FROM users WHERE role = $1', role.upper())
        else:
            rows = await conn.fetch('SELECT username, role, status, delegate_to FROM users')
        return [dict(row) for row in rows]

class ConversationCreate(BaseModel):
    title: str
    tickets: List[str]
    participants: List[str]
    initial_message: str

@app.post("/conversations")
async def start_conversation(conv: ConversationCreate, user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            conv_id = await conn.fetchval(
                "INSERT INTO conversations (title, tickets, created_by) VALUES ($1, $2, $3) RETURNING id",
                conv.title, conv.tickets, user['username']
            )
            
            final_participants = set([user['username']])
            routing_notes = []
            
            # Xử lý Logic Out Of Office (OOO) Routing
            for p in conv.participants:
                u_record = await conn.fetchrow("SELECT username, status, delegate_to FROM users WHERE username = $1", p)
                if u_record:
                    if u_record['status'] == 'OOO' and u_record['delegate_to']:
                        final_participants.add(u_record['delegate_to'])
                        routing_notes.append(f"{p} is OOO. Automatically routed to {u_record['delegate_to']}.")
                    else:
                        final_participants.add(p)

            for p in final_participants:
                await conn.execute("INSERT INTO participants (conversation_id, username) VALUES ($1, $2)", conv_id, p)
            
            await conn.execute(
                "INSERT INTO messages (conversation_id, from_user, content) VALUES ($1, $2, $3)",
                conv_id, user['username'], conv.initial_message
            )
            
            # Ghi chú routing nếu có
            for note in routing_notes:
                await conn.execute(
                    "INSERT INTO messages (conversation_id, from_user, content) VALUES ($1, $2, $3)",
                    conv_id, user['username'], f"[SYSTEM] {note}"
                )
                
            return {"conversation_id": conv_id, "routed": len(routing_notes) > 0}

@app.get("/conversations")
async def get_my_conversations(user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        query = """
            SELECT c.id, c.title, c.tickets, c.status, c.priority, c.created_at,
                   (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as last_message
            FROM conversations c
            JOIN participants p ON c.id = p.conversation_id
            WHERE p.username = $1 AND c.status = 'OPEN'
            ORDER BY 
                CASE c.priority WHEN 'BLOCKING' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END ASC,
                c.created_at DESC
        """
        rows = await conn.fetch(query, user['username'])
        return [dict(row) for row in rows]

@app.get("/conversations/{conv_id}/messages")
async def get_conversation_history(conv_id: int, user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        is_part = await conn.fetchval("SELECT 1 FROM participants WHERE conversation_id = $1 AND username = $2", conv_id, user['username'])
        if not is_part:
            raise HTTPException(status_code=403, detail="Not in conversation")
        rows = await conn.fetch("SELECT id, from_user, content, timestamp FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC", conv_id)
        return [dict(row) for row in rows]

class MessageCreate(BaseModel):
    content: str

@app.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: int, msg: MessageCreate, user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        is_part = await conn.fetchval("SELECT 1 FROM participants WHERE conversation_id = $1 AND username = $2", conv_id, user['username'])
        if not is_part:
            raise HTTPException(status_code=403, detail="Not in conversation")
        await conn.execute("INSERT INTO messages (conversation_id, from_user, content) VALUES ($1, $2, $3)", conv_id, user['username'], msg.content)
        return {"success": True}

@app.post("/conversations/{conv_id}/resolve")
async def resolve_conversation(conv_id: int, user: dict = Depends(get_current_user)):
    async with pool.acquire() as conn:
        is_part = await conn.fetchval("SELECT 1 FROM participants WHERE conversation_id = $1 AND username = $2", conv_id, user['username'])
        if not is_part:
            raise HTTPException(status_code=403, detail="Not in conversation")
        await conn.execute("UPDATE conversations SET status = 'RESOLVED' WHERE id = $1", conv_id)
        return {"success": True}

# ==========================================
# WEB UI ENDPOINTS
# ==========================================

security_basic = HTTPBasic()

def verify_admin(credentials: HTTPBasicCredentials = Depends(security_basic)):
    correct_username = secrets.compare_digest(credentials.username, "admin")
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, admin: str = Depends(verify_admin)):
    async with pool.acquire() as conn:
        users = await conn.fetch("SELECT * FROM users")
        convs = await conn.fetch("SELECT * FROM conversations ORDER BY created_at DESC")
        conversations = []
        for c in convs:
            conv_dict = dict(c)
            parts = await conn.fetch("SELECT username FROM participants WHERE conversation_id = $1", c['id'])
            conv_dict['participants'] = [p['username'] for p in parts]
            msgs = await conn.fetch("SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC", c['id'])
            conv_dict['messages'] = [dict(m) for m in msgs]
            conversations.append(conv_dict)
            
    return templates.TemplateResponse(
        request=request, name="index.html", 
        context={"users": users, "conversations": conversations}
    )

@app.post("/admin/register")
async def register_user(request: Request, username: str = Form(...), role: str = Form(...), api_key: str = Form(...), admin: str = Depends(verify_admin)):
    async with pool.acquire() as conn:
        try:
            await conn.execute("INSERT INTO users (username, role, api_key) VALUES ($1, $2, $3)", username, role, api_key)
        except asyncpg.exceptions.UniqueViolationError:
            pass
    return HTMLResponse(status_code=303, headers={"Location": "/"})
