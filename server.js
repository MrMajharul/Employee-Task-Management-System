const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3002;

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(o => o.trim()),
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'task_management_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL database');
    // Ensure documents table exists
    const createDocumentsTable = `
        CREATE TABLE IF NOT EXISTS documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            type ENUM('board','document','spreadsheet','presentation','file') NOT NULL DEFAULT 'file',
            filename VARCHAR(255) NULL,
            mime_type VARCHAR(128) NULL,
            size INT NULL,
            created_by INT NOT NULL,
            shared TINYINT(1) NOT NULL DEFAULT 0,
            published TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX(created_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    db.query(createDocumentsTable, (e) => {
        if (e) {
            console.warn('Could not ensure documents table:', e.message);
        } else {
            console.log('Documents table ready');
        }
    });

    // Ensure task_checklists table exists
    const createTaskChecklists = `
        CREATE TABLE IF NOT EXISTS task_checklists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            is_completed TINYINT(1) NOT NULL DEFAULT 0,
            created_by INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX(task_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    db.query(createTaskChecklists, (e) => {
        if (e) console.warn('Could not ensure task_checklists table:', e.message);
        else console.log('task_checklists table ready');
    });

    // Ensure task_files table exists
    const createTaskFiles = `
        CREATE TABLE IF NOT EXISTS task_files (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(128) NULL,
            size INT NULL,
            uploaded_by INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX(task_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    db.query(createTaskFiles, (e) => {
        if (e) console.warn('Could not ensure task_files table:', e.message);
        else console.log('task_files table ready');
    });

    // Ensure projects table exists (fallback if DB wasn't imported)
    const createProjects = `
        CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            created_by INT NOT NULL,
            status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
            priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            start_date DATE,
            due_date DATE,
            completion_date DATE NULL,
            budget DECIMAL(10,2) NULL,
            progress_percentage INT DEFAULT 0,
            color VARCHAR(7) DEFAULT '#3B82F6',
            is_archived BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_created_by (created_by),
            INDEX idx_status (status),
            INDEX idx_priority (priority),
            INDEX idx_is_archived (is_archived),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    db.query(createProjects, (e) => {
        if (e) console.warn('Could not ensure projects table:', e.message);
        else console.log('projects table ready');
    });

    // Ensure project_members table exists
    const createProjectMembers = `
        CREATE TABLE IF NOT EXISTS project_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            user_id INT NOT NULL,
            role ENUM('owner', 'manager', 'member', 'viewer') DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            UNIQUE KEY unique_project_member (project_id, user_id),
            INDEX idx_project_id (project_id),
            INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    db.query(createProjectMembers, (e) => {
        if (e) console.warn('Could not ensure project_members table:', e.message);
        else console.log('project_members table ready');
    });
});

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'profile');
const documentsDir = path.join(__dirname, 'public', 'uploads', 'documents');
const tasksFilesDir = path.join(__dirname, 'public', 'uploads', 'tasks');
try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(documentsDir, { recursive: true });
    fs.mkdirSync(tasksFilesDir, { recursive: true });
} catch (e) {
    console.warn('Could not ensure uploads directory:', e.message);
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `user_${req.user?.id || 'guest'}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

// Multer storage for documents (allow common doc types)
const docStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, documentsDir);
    },
    filename: function (req, file, cb) {
        const original = path.basename(file.originalname);
        const safe = original.replace(/\s+/g, '_');
        const ext = path.extname(safe);
        const base = path.basename(safe, ext);
        cb(null, `${base}_${Date.now()}${ext}`);
    }
});

const allowedDocMimes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown'
]);

const uploadDoc = multer({
    storage: docStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        if (!allowedDocMimes.has(file.mimetype)) {
            return cb(new Error('Unsupported file type'));
        }
        cb(null, true);
    }
});

// Multer storage for task attachments (allow broad set of common file types)
const taskFileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tasksFilesDir);
    },
    filename: function (req, file, cb) {
        const original = path.basename(file.originalname);
        const safe = original.replace(/\s+/g, '_');
        const ext = path.extname(safe);
        const base = path.basename(safe, ext);
        cb(null, `${base}_${Date.now()}${ext}`);
    }
});

const uploadTaskFiles = multer({
    storage: taskFileStorage,
    limits: { fileSize: 30 * 1024 * 1024 }, // 30MB per file
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Google Login endpoint
app.post('/api/google-login', async (req, res) => {
    const { username, full_name, email, role, picture } = req.body;
    
    try {
    // Check if user exists by email (preferred) or username
    const checkQuery = 'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1';
    db.query(checkQuery, [email, username], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            let user;
            if (results.length === 0) {
                // Create new user
        const insertQuery = 'INSERT INTO users (full_name, email, username, password, role) VALUES (?, ?, ?, ?, ?)';
                const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10); // Random password for Google users
                
        // Fallback role validation
        const safeRole = ['admin','manager','employee'].includes(role) ? role : 'employee';

        db.query(insertQuery, [full_name, email, username, hashedPassword, safeRole], (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    user = {
                        id: result.insertId,
            username: username,
            email: email,
                        full_name: full_name,
            role: safeRole
                    };
                    
                    const token = jwt.sign(
                        { id: user.id, username: user.username, role: user.role },
                        process.env.JWT_SECRET || 'your-secret-key',
                        { expiresIn: '24h' }
                    );
                    
                    res.json({
                        token,
                        user: user
                    });
                });
            } else {
                // User exists, return user data
                user = results[0];
                const token = jwt.sign(
                    { id: user.id, username: user.username, role: user.role },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );
                
                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        email: user.email,
                        role: user.role
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Public config endpoint for frontend
app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || null
    });
});

// Helper to map mime to document type
function mapMimeToDocType(mime) {
    if (!mime) return 'file';
    if (mime.includes('word')) return 'document';
    if (mime.includes('sheet') || mime.includes('excel')) return 'spreadsheet';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
    return 'file';
}

// Documents API
app.get('/api/documents', authenticateToken, (req, res) => {
    const { q, filter } = req.query;
    let where = 'WHERE created_by = ?';
    const params = [req.user.id];
    if (q) { where += ' AND title LIKE ?'; params.push(`%${q}%`); }
    if (filter === 'shared') where += ' AND shared = 1';
    if (filter === 'published') where += ' AND published = 1';
    const sql = `SELECT * FROM documents ${where} ORDER BY updated_at DESC`;
    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/documents', authenticateToken, (req, res) => {
    const { title, type } = req.body;
    const safeType = ['board','document','spreadsheet','presentation','file'].includes(type) ? type : 'file';
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const sql = 'INSERT INTO documents (title, type, created_by) VALUES (?, ?, ?)';
    db.query(sql, [title, safeType, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ id: result.insertId, title, type: safeType, created_by: req.user.id, shared: 0, published: 0 });
    });
});

app.post('/api/documents/upload', authenticateToken, uploadDoc.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const title = req.body.title || req.file.originalname;
    const mime_type = req.file.mimetype;
    const size = req.file.size;
    const filename = req.file.filename;
    const type = mapMimeToDocType(mime_type);
    const sql = 'INSERT INTO documents (title, type, filename, mime_type, size, created_by) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [title, type, filename, mime_type, size, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ id: result.insertId, title, type, filename, mime_type, size, created_by: req.user.id });
    });
});

app.put('/api/documents/:id', authenticateToken, (req, res) => {
    const { title, shared, published } = req.body;
    const fields = [];
    const params = [];
    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (shared !== undefined) { fields.push('shared = ?'); params.push(shared ? 1 : 0); }
    if (published !== undefined) { fields.push('published = ?'); params.push(published ? 1 : 0); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id, req.user.id);
    const sql = `UPDATE documents SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND created_by = ?`;
    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    const select = 'SELECT filename FROM documents WHERE id = ? AND created_by = ? LIMIT 1';
    db.query(select, [req.params.id, req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const filename = rows[0].filename;
        const del = 'DELETE FROM documents WHERE id = ? AND created_by = ?';
        db.query(del, [req.params.id, req.user.id], (e2) => {
            if (e2) return res.status(500).json({ error: 'Database error' });
            if (filename) {
                const filePath = path.join(documentsDir, filename);
                fs.unlink(filePath, () => {});
            }
            res.json({ success: true });
        });
    });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('Login attempt for:', username);
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Allow login with username or email
    const query = 'SELECT * FROM users WHERE (username = ? OR email = ?) AND status = "active" LIMIT 1';
    db.query(query, [username, username], async (err, results) => {
        if (err) {
            console.error('Login query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            console.log('Login failed: User not found -', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = results[0];
        console.log('Found user:', { id: user.id, username: user.username, email: user.email });
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            console.log('Login failed: Invalid password for user -', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        console.log('Login successful for user:', user.username);
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    });
});

// Registration endpoint with direct insert (bypassing stored procedure issues)
app.post('/api/register', async (req, res) => {
    const { full_name, email, username, password, role } = req.body;
    
    // Validate required fields
    if (!full_name || !email || !username || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    
    // Validate password length
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Validate role to match ENUM
    const safeRole = ['admin','manager','employee'].includes(role) ? role : 'employee';
    
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Check if user already exists
        const checkQuery = 'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1';
        db.query(checkQuery, [email, username], async (checkErr, exists) => {
            if (checkErr) {
                console.error('Registration check error:', checkErr);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (exists.length > 0) {
                return res.status(409).json({ error: 'Email or username already exists' });
            }
            
            // Insert new user
            const insertQuery = 'INSERT INTO users (full_name, email, username, password, role) VALUES (?, ?, ?, ?, ?)';
            db.query(insertQuery, [full_name, email, username, hashedPassword, safeRole], (insertErr, result) => {
                if (insertErr) {
                    console.error('Registration insert error:', insertErr);
                    const errMsg = (insertErr.message || '').toLowerCase();
                    if (errMsg.includes("for key 'email'") || errMsg.includes('email')) {
                        return res.status(409).json({ error: 'Email already exists' });
                    }
                    if (errMsg.includes("for key 'username'") || errMsg.includes('username')) {
                        return res.status(409).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Failed to create account' });
                }

                const userId = result.insertId;
                
                // Get the created user details
                const getUserQuery = `
                    SELECT id, username, full_name, email, role, status, created_at 
                    FROM users 
                    WHERE id = ?
                `;
                
                db.query(getUserQuery, [userId], (getUserErr, userResults) => {
                    if (getUserErr) {
                        console.error('Error fetching user:', getUserErr);
                        return res.status(500).json({ error: 'Account created but failed to retrieve details' });
                    }
                    
                    const newUser = userResults[0];
                    
                    // Generate token for auto-login
                    const token = jwt.sign(
                        { id: newUser.id, username: newUser.username, role: newUser.role },
                        process.env.JWT_SECRET || 'your-secret-key',
                        { expiresIn: '24h' }
                    );
                    
                    console.log('User registered successfully:', { id: newUser.id, username: newUser.username, email: newUser.email });
                    
                    res.status(201).json({
                        message: 'Account created successfully',
                        token,
                        user: {
                            id: newUser.id,
                            username: newUser.username,
                            full_name: newUser.full_name,
                            email: newUser.email,
                            role: newUser.role
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Dashboard data endpoint with stored procedure
app.get('/api/dashboard', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    // Get dashboard data using direct queries instead of stored procedures
    const dashboardQuery = `
        SELECT 
            COUNT(CASE WHEN t.status = 'pending' AND t.assigned_to = ? THEN 1 END) as pending_tasks,
            COUNT(CASE WHEN t.status = 'in_progress' AND t.assigned_to = ? THEN 1 END) as active_tasks,
            COUNT(CASE WHEN t.status = 'completed' AND t.assigned_to = ? THEN 1 END) as completed_tasks,
            COUNT(CASE WHEN t.due_date < NOW() AND t.status IN ('pending', 'in_progress') AND t.assigned_to = ? THEN 1 END) as overdue_tasks,
            COUNT(CASE WHEN t.assigned_by = ? THEN 1 END) as tasks_created
        FROM tasks t
    `;
    
    db.query(dashboardQuery, [userId, userId, userId, userId, userId], (err, results) => {
        if (err) {
            console.error('Dashboard query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const dashboardData = results[0];
        
        // Also get recent tasks using SQL views
        const recentTasksQuery = `
            SELECT 
                id, title, status, priority, due_date, urgency_status,
                assigned_to_name, progress_percentage
            FROM vw_task_summary 
            WHERE assigned_to_name IS NOT NULL
            ORDER BY updated_at DESC 
            LIMIT 10
        `;
        
        db.query(recentTasksQuery, (err, taskResults) => {
            if (err) {
                console.error('Recent tasks query error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Get unread notifications count
            const notificationsQuery = `
                SELECT COUNT(*) as unread_count
                FROM notifications 
                WHERE recipient_id = ? AND is_read = FALSE
            `;
            
            db.query(notificationsQuery, [userId], (err, notifResults) => {
                if (err) {
                    console.error('Notifications query error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                res.json({
                    ...dashboardData,
                    recentTasks: taskResults,
                    unreadNotifications: notifResults[0].unread_count
                });
            });
        });
    });
});

// Get all tasks using SQL view
app.get('/api/tasks', authenticateToken, (req, res) => {
    const userRole = req.user.role;
    
    let query;
    let params = [];
    
    if (userRole === 'admin' || userRole === 'manager') {
        // Admin/Manager can see all tasks with enhanced view
        query = `
            SELECT 
                id, title, description, status, priority, due_date, 
                progress_percentage, estimated_hours, actual_hours,
                assigned_to_name, assigned_to_email, assigned_by_name,
                urgency_status, created_at, updated_at
            FROM vw_task_summary 
            ORDER BY 
                CASE urgency_status 
                    WHEN 'overdue' THEN 1 
                    WHEN 'due_today' THEN 2 
                    ELSE 3 
                END,
                CASE priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                updated_at DESC
        `;
    } else {
        // Employee can only see their assigned tasks
        query = `
            SELECT 
                t.id, t.title, t.description, t.status, t.priority, t.due_date,
                t.progress_percentage, t.estimated_hours, t.actual_hours,
                t.assigned_to,
                assigner.full_name as assigned_by_name,
                CASE 
                    WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 'overdue'
                    WHEN t.due_date = CURRENT_DATE AND t.status != 'completed' THEN 'due_today'
                    ELSE 'normal'
                END as urgency_status,
                t.created_at, t.updated_at
            FROM tasks t
            LEFT JOIN users assigner ON t.assigned_by = assigner.id
            WHERE t.assigned_to = ?
            ORDER BY 
                CASE 
                    WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 1
                    WHEN t.due_date = CURRENT_DATE AND t.status != 'completed' THEN 2
                    ELSE 3
                END,
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                t.updated_at DESC
        `;
        params = [req.user.id];
    }
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Tasks query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Get single task by ID
app.get('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    
    let query;
    let params;
    
    if (userRole === 'admin' || userRole === 'manager') {
        // Admin/Manager can see any task with full details
        query = `
            SELECT 
                t.id, t.title, t.description, t.status, t.priority, t.due_date,
                t.progress_percentage, t.estimated_hours, t.actual_hours,
                t.assigned_to, t.assigned_by, t.start_date, t.completion_date,
                assigned_user.full_name as assigned_to_name,
                assigned_user.email as assigned_to_email,
                assigner.full_name as assigned_by_name,
                t.created_at, t.updated_at
            FROM tasks t
            LEFT JOIN users assigned_user ON t.assigned_to = assigned_user.id
            LEFT JOIN users assigner ON t.assigned_by = assigner.id
            WHERE t.id = ?
        `;
        params = [id];
    } else {
        // Employee can only see their own assigned tasks
        query = `
            SELECT 
                t.id, t.title, t.description, t.status, t.priority, t.due_date,
                t.progress_percentage, t.estimated_hours, t.actual_hours,
                t.assigned_to, t.assigned_by, t.start_date, t.completion_date,
                assigner.full_name as assigned_by_name,
                t.created_at, t.updated_at
            FROM tasks t
            LEFT JOIN users assigner ON t.assigned_by = assigner.id
            WHERE t.id = ? AND t.assigned_to = ?
        `;
        params = [id, req.user.id];
    }
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Task query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Task not found or access denied' });
        }
        
        res.json(results[0]);
    });
});

// Get all users (admin and manager can see all, employees see limited info)
app.get('/api/users', authenticateToken, (req, res) => {
    let query;
    let columns;
    
    if (req.user.role === 'admin') {
        // Admin can see all user details
        columns = 'id, full_name, username, email, role, created_at';
    } else if (req.user.role === 'manager') {
        // Manager can see basic info for task assignment
        columns = 'id, full_name, username, role';
    } else {
        // Employee can only see basic info for task assignment
        columns = 'id, full_name, username';
    }
    
    query = `SELECT ${columns} FROM users WHERE status = 'active' ORDER BY full_name`;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add task with direct SQL queries (bypassing stored procedure issues)
app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, description, assigned_to, due_date, priority, estimated_hours } = req.body;
    
    // Validate required fields
    if (!title || !assigned_to) {
        return res.status(400).json({ error: 'Title and assigned user are required' });
    }
    
    // Use direct SQL insert instead of stored procedure
    const insertQuery = `
        INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, estimated_hours, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `;
    
    const params = [
        title, 
        description || null, 
        assigned_to, 
        req.user.id, // assigned_by
        priority || 'medium',
        due_date || null,
        estimated_hours || null
    ];
    
    db.query(insertQuery, params, (err, result) => {
        if (err) {
            console.error('Task creation error:', err);
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'Assigned user does not exist or is inactive' });
            }
            return res.status(500).json({ error: 'Failed to create task' });
        }
        
        const taskId = result.insertId;
        
        // Get the created task details
        const getTaskQuery = `
            SELECT 
                t.id, t.title, t.description, t.status, t.priority, t.due_date,
                t.progress_percentage, t.estimated_hours, t.actual_hours,
                assigned_user.full_name as assigned_to_name,
                assigned_user.email as assigned_to_email,
                assigner.full_name as assigned_by_name,
                CASE 
                    WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 'overdue'
                    WHEN t.due_date = CURRENT_DATE AND t.status != 'completed' THEN 'due_today'
                    ELSE 'normal'
                END as urgency_status,
                t.created_at, t.updated_at
            FROM tasks t
            LEFT JOIN users assigned_user ON t.assigned_to = assigned_user.id
            LEFT JOIN users assigner ON t.assigned_by = assigner.id
            WHERE t.id = ?
        `;
        
        db.query(getTaskQuery, [taskId], (err, taskResults) => {
            if (err) {
                console.error('Error fetching created task:', err);
                return res.status(500).json({ error: 'Task created but failed to retrieve details' });
            }
            // Fire-and-forget: create a notification for the assignee
            try {
                const createdTask = taskResults[0] || {};
                const pr = (priority || createdTask.priority || 'medium');
                const notifPriority = pr === 'urgent' || pr === 'high' ? 'high' : (pr === 'low' ? 'low' : 'medium');
                notifyTaskAssigned({
                    recipientId: assigned_to,
                    senderId: req.user.id,
                    taskId,
                    taskTitle: title,
                    priority: notifPriority
                });
            } catch (e) {
                console.warn('Could not enqueue assignment notification:', e.message);
            }

            res.status(201).json({
                message: 'Task created successfully',
                task: taskResults[0]
            });
        });
    });
});

// Update task with direct SQL queries (bypassing stored procedure issues)
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, description, assigned_to, due_date, status, priority, actual_hours } = req.body;
    
    // If only status is being updated, use direct SQL
    if (status && Object.keys(req.body).length <= 3) { // status, and optionally actual_hours
        // First check if user has permission to update this task
        const checkPermissionQuery = `
            SELECT assigned_to, assigned_by 
            FROM tasks 
            WHERE id = ?
        `;
        
        db.query(checkPermissionQuery, [id], (err, taskResults) => {
            if (err) {
                console.error('Task permission check error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (taskResults.length === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            const task = taskResults[0];
            const userRole = req.user.role;
            
            // Check permissions
            if (task.assigned_to !== req.user.id && 
                task.assigned_by !== req.user.id && 
                !['admin', 'manager'].includes(userRole)) {
                return res.status(403).json({ error: 'Insufficient permissions to update this task' });
            }
            
            // Update task status
            let updateQuery = 'UPDATE tasks SET status = ?, updated_at = NOW()';
            let params = [status];
            
            if (actual_hours) {
                updateQuery += ', actual_hours = ?';
                params.push(actual_hours);
            }
            
            if (status === 'completed') {
                updateQuery += ', completion_date = NOW()';
            } else if (status === 'in_progress' && task.start_date === null) {
                updateQuery += ', start_date = NOW()';
            }
            
            updateQuery += ' WHERE id = ?';
            params.push(id);
            
            db.query(updateQuery, params, (err, result) => {
                if (err) {
                    console.error('Task status update error:', err);
                    return res.status(500).json({ error: 'Failed to update task status' });
                }
                
                res.json({ message: 'Task status updated successfully' });
            });
        });
    } else {
        // For other updates, use transaction
        db.beginTransaction((err) => {
            if (err) {
                return res.status(500).json({ error: 'Transaction error' });
            }
            
            // Check if user has permission to update this task
            const checkPermissionQuery = `
                SELECT assigned_to, assigned_by 
                FROM tasks 
                WHERE id = ?
            `;
            
            db.query(checkPermissionQuery, [id], (err, taskResults) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ error: 'Database error' });
                    });
                }
                
                if (taskResults.length === 0) {
                    return db.rollback(() => {
                        res.status(404).json({ error: 'Task not found' });
                    });
                }
                
                const task = taskResults[0];
                const originalAssignee = task.assigned_to;
                const userRole = req.user.role;
                
                // Check permissions
                if (task.assigned_to !== req.user.id && 
                    task.assigned_by !== req.user.id && 
                    !['admin', 'manager'].includes(userRole)) {
                    return db.rollback(() => {
                        res.status(403).json({ error: 'Insufficient permissions' });
                    });
                }
                
                // Update task
                const updateQuery = `
                    UPDATE tasks 
                    SET title = COALESCE(?, title),
                        description = COALESCE(?, description),
                        assigned_to = COALESCE(?, assigned_to),
                        due_date = COALESCE(?, due_date),
                        priority = COALESCE(?, priority)
                    WHERE id = ?
                `;
                
                db.query(updateQuery, [title, description, assigned_to, due_date, priority, id], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: 'Database error' });
                        });
                    }
                    
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: 'Transaction commit error' });
                            });
                        }
                        // After successful update, if assignee changed, send notification
                        const assigneeChanged = typeof assigned_to !== 'undefined' && String(assigned_to) !== String(originalAssignee || '');
                        if (assigneeChanged) {
                            // Fetch task title and priority to craft notification (non-blocking)
                            db.query('SELECT title, priority FROM tasks WHERE id = ? LIMIT 1', [id], (qe, rows) => {
                                const t = rows && rows[0] ? rows[0] : { title, priority };
                                const pr = (priority || t.priority || 'medium');
                                const notifPriority = pr === 'urgent' || pr === 'high' ? 'high' : (pr === 'low' ? 'low' : 'medium');
                                try {
                                    notifyTaskAssigned({
                                        recipientId: assigned_to,
                                        senderId: req.user.id,
                                        taskId: id,
                                        taskTitle: t.title || title || 'Task',
                                        priority: notifPriority
                                    });
                                } catch (e) {
                                    console.warn('Failed to create assignment notification on update:', e.message);
                                }
                            });
                        }
                        res.json({ message: 'Task updated successfully' });
                    });
                });
            });
        });
    }
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const query = 'DELETE FROM tasks WHERE id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Task deleted successfully' });
    });
});

// Get task history (audit trail)
app.get('/api/tasks/:id/history', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            th.id,
            th.action,
            th.old_status,
            th.new_status,
            old_user.full_name as old_assigned_to_name,
            new_user.full_name as new_assigned_to_name,
            actor.full_name as actor_name,
            th.description,
            th.created_at
        FROM task_history th
        LEFT JOIN users old_user ON th.old_assigned_to = old_user.id
        LEFT JOIN users new_user ON th.new_assigned_to = new_user.id
        LEFT JOIN users actor ON th.user_id = actor.id
        WHERE th.task_id = ?
        ORDER BY th.created_at DESC
    `;
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Task history query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Task Checklists API
app.get('/api/tasks/:id/checklists', authenticateToken, (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM task_checklists WHERE task_id = ? ORDER BY created_at ASC';
    db.query(sql, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/tasks/:id/checklists', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const sql = 'INSERT INTO task_checklists (task_id, title, created_by) VALUES (?, ?, ?)';
    db.query(sql, [id, title, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ id: result.insertId, task_id: id, title, is_completed: 0 });
    });
});

app.put('/api/checklists/:checklistId', authenticateToken, (req, res) => {
    const { checklistId } = req.params;
    const { title, is_completed } = req.body;
    const fields = [];
    const params = [];
    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (is_completed !== undefined) { fields.push('is_completed = ?'); params.push(is_completed ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(checklistId);
    const sql = `UPDATE task_checklists SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.delete('/api/checklists/:checklistId', authenticateToken, (req, res) => {
    const { checklistId } = req.params;
    const sql = 'DELETE FROM task_checklists WHERE id = ?';
    db.query(sql, [checklistId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Task Files API
app.get('/api/tasks/:id/files', authenticateToken, (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT id, filename, original_name, mime_type, size, uploaded_by, created_at FROM task_files WHERE task_id = ? ORDER BY created_at DESC';
    db.query(sql, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows.map(r => ({ ...r, url: `/uploads/tasks/${r.filename}` })));
    });
});

app.post('/api/tasks/:id/files', authenticateToken, uploadTaskFiles.array('files', 10), (req, res) => {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const values = req.files.map(f => [id, f.filename, f.originalname, f.mimetype, f.size, req.user.id]);
    const sql = 'INSERT INTO task_files (task_id, filename, original_name, mime_type, size, uploaded_by) VALUES ?';
    db.query(sql, [values], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ success: true, count: req.files.length });
    });
});

app.delete('/api/tasks/:taskId/files/:fileId', authenticateToken, (req, res) => {
    const { taskId, fileId } = req.params;
    const select = 'SELECT filename FROM task_files WHERE id = ? AND task_id = ? LIMIT 1';
    db.query(select, [fileId, taskId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const filename = rows[0].filename;
        const del = 'DELETE FROM task_files WHERE id = ? AND task_id = ?';
        db.query(del, [fileId, taskId], (e2) => {
            if (e2) return res.status(500).json({ error: 'Database error' });
            if (filename) {
                const filePath = path.join(tasksFilesDir, filename);
                fs.unlink(filePath, () => {});
            }
            res.json({ success: true });
        });
    });
});

// Get user notifications (new schema)
app.get('/api/notifications', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { limit = 20, unread_only = false } = req.query;

    let query = `
        SELECT 
            n.id,
            n.type,
            n.title,
            n.message,
            n.is_read,
            n.priority,
            n.created_at,
            n.read_at,
            n.task_id,
            t.title as task_title,
            sender.full_name as sender_name
        FROM notifications n
        LEFT JOIN tasks t ON n.task_id = t.id
        LEFT JOIN users sender ON n.sender_id = sender.id
        WHERE n.recipient_id = ?
    `;

    const params = [userId];
    if (String(unread_only) === 'true') {
        query += ' AND n.is_read = FALSE';
    }
    query += ' ORDER BY n.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Notifications query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Mark notification as read (new schema)
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: 'Transaction error' });

        const checkQuery = 'SELECT id FROM notifications WHERE id = ? AND recipient_id = ?';
        db.query(checkQuery, [id, userId], (err, results) => {
            if (err) return db.rollback(() => res.status(500).json({ error: 'Database error' }));
            if (results.length === 0) return db.rollback(() => res.status(404).json({ error: 'Notification not found' }));

            const updateQuery = 'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ?';
            db.query(updateQuery, [id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ error: 'Database error' }));
                db.commit((err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: 'Transaction commit error' }));
                    res.json({ message: 'Notification marked as read' });
                });
            });
        });
    });
});

// ========== PROJECTS API ==========

// Get all projects for current user
app.get('/api/projects', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            p.*,
            (
                SELECT u.full_name 
                FROM users u 
                WHERE u.id = p.created_by
            ) AS created_by_name,
            (
                SELECT pm.role 
                FROM project_members pm 
                WHERE pm.project_id = p.id AND pm.user_id = ?
                LIMIT 1
            ) AS user_role,
            (
                SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id
            ) AS task_count,
            (
                SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id
            ) AS member_count,
            (
                SELECT AVG(t2.progress_percentage) FROM tasks t2 WHERE t2.project_id = p.id
            ) AS avg_progress
        FROM projects p
        WHERE p.is_archived = FALSE
          AND (
                p.created_by = ?
                OR EXISTS (
                    SELECT 1 FROM project_members pm3 
                    WHERE pm3.project_id = p.id AND pm3.user_id = ?
                )
          )
        ORDER BY p.created_at DESC
    `;

    db.query(query, [req.user.id, req.user.id, req.user.id], (err, results) => {
        if (err) {
            console.error('Projects query error:', err.message);
            return res.status(500).json({ error: 'Failed to fetch projects' });
        }
        res.json(results);
    });
});

// Get single project
app.get('/api/projects/:id', authenticateToken, (req, res) => {
    const projectId = req.params.id;
    
    const query = `
        SELECT 
            p.*,
            (
                SELECT u.full_name 
                FROM users u 
                WHERE u.id = p.created_by
            ) AS created_by_name,
            (
                SELECT pm.role 
                FROM project_members pm 
                WHERE pm.project_id = p.id AND pm.user_id = ?
                LIMIT 1
            ) AS user_role
        FROM projects p
        WHERE p.id = ? 
          AND (
                p.created_by = ? 
                OR EXISTS (
                    SELECT 1 FROM project_members pm2 
                    WHERE pm2.project_id = p.id AND pm2.user_id = ?
                )
          )
    `;
    
    db.query(query, [req.user.id, projectId, req.user.id, req.user.id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch project' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }
        
        res.json(results[0]);
    });
});

// Create new project
app.post('/api/projects', authenticateToken, (req, res) => {
    const { name, description, priority, start_date, due_date, color, budget } = req.body;
    
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Project name is required' });
    }
    
    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: 'Transaction error' });
        
        const projectQuery = `
            INSERT INTO projects (name, description, created_by, priority, start_date, due_date, color, budget)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.query(projectQuery, [
            name.trim(),
            description || null,
            req.user.id,
            priority || 'medium',
            start_date || null,
            due_date || null,
            color || '#3B82F6',
            budget || null
        ], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error('Database error:', err);
                    res.status(500).json({ error: 'Failed to create project' });
                });
            }
            
            const projectId = result.insertId;
            
            // Add creator as project owner
            const memberQuery = `
                INSERT INTO project_members (project_id, user_id, role)
                VALUES (?, ?, 'owner')
            `;
            
            db.query(memberQuery, [projectId, req.user.id], (err) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Database error:', err);
                        res.status(500).json({ error: 'Failed to set project ownership' });
                    });
                }
                
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: 'Transaction commit error' });
                        });
                    }
                    
                    res.status(201).json({ 
                        message: 'Project created successfully',
                        projectId: projectId 
                    });
                });
            });
        });
    });
});

// Update project
app.put('/api/projects/:id', authenticateToken, (req, res) => {
    const projectId = req.params.id;
    const { name, description, status, priority, start_date, due_date, color, budget, progress_percentage } = req.body;
    
    // Check if user has permission to edit
    const permissionQuery = `
        SELECT p.id, pm.role 
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
        WHERE p.id = ? AND (p.created_by = ? OR pm.role IN ('owner', 'manager'))
    `;
    
    db.query(permissionQuery, [req.user.id, projectId, req.user.id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(403).json({ error: 'Access denied or project not found' });
        }
        
        const updateQuery = `
            UPDATE projects 
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                start_date = COALESCE(?, start_date),
                due_date = COALESCE(?, due_date),
                color = COALESCE(?, color),
                budget = COALESCE(?, budget),
                progress_percentage = COALESCE(?, progress_percentage),
                completion_date = CASE WHEN ? = 'completed' AND completion_date IS NULL THEN CURRENT_TIMESTAMP ELSE completion_date END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        db.query(updateQuery, [
            name || null,
            description || null,
            status || null,
            priority || null,
            start_date || null,
            due_date || null,
            color || null,
            budget || null,
            progress_percentage || null,
            status || null,
            projectId
        ], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update project' });
            }
            
            res.json({ message: 'Project updated successfully' });
        });
    });
});

// Delete project
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
    const projectId = req.params.id;
    
    // Check if user is project owner
    const permissionQuery = `
        SELECT id FROM projects 
        WHERE id = ? AND created_by = ?
    `;
    
    db.query(permissionQuery, [projectId, req.user.id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(403).json({ error: 'Access denied or project not found' });
        }
        
        // Archive project instead of deleting
        const archiveQuery = 'UPDATE projects SET is_archived = TRUE WHERE id = ?';
        
        db.query(archiveQuery, [projectId], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to archive project' });
            }
            
            res.json({ message: 'Project archived successfully' });
        });
    });
});

// Get project members
app.get('/api/projects/:id/members', authenticateToken, (req, res) => {
    const projectId = req.params.id;
    
    const query = `
        SELECT 
            pm.id,
            pm.role,
            pm.joined_at,
            u.id as user_id,
            u.full_name,
            u.email,
            u.role as user_role
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        JOIN projects p ON pm.project_id = p.id
        WHERE pm.project_id = ? AND (p.created_by = ? OR pm.user_id = ?)
        ORDER BY pm.role, u.full_name
    `;
    
    db.query(query, [projectId, req.user.id, req.user.id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch project members' });
        }
        
        res.json(results);
    });
});

// Add member to project
app.post('/api/projects/:id/members', authenticateToken, (req, res) => {
    const projectId = req.params.id;
    const { user_id, role = 'member' } = req.body;
    
    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if the requester is the project owner
    const ownerCheckQuery = `
        SELECT id FROM projects 
        WHERE id = ? AND created_by = ?
    `;
    
    db.query(ownerCheckQuery, [projectId, req.user.id], (err, ownerResults) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to verify project ownership' });
        }
        
        if (ownerResults.length === 0) {
            return res.status(403).json({ error: 'Only project owners can add members' });
        }
        
        // Check if user is already a member
        const memberCheckQuery = `
            SELECT id FROM project_members 
            WHERE project_id = ? AND user_id = ?
        `;
        
        db.query(memberCheckQuery, [projectId, user_id], (err, memberResults) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to check existing membership' });
            }
            
            if (memberResults.length > 0) {
                return res.status(400).json({ error: 'User is already a member of this project' });
            }
            
            // Add the member
            const insertQuery = `
                INSERT INTO project_members (project_id, user_id, role, joined_at)
                VALUES (?, ?, ?, NOW())
            `;
            
            db.query(insertQuery, [projectId, user_id, role], (err, result) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to add member to project' });
                }
                
                // Get the added member's details for response
                const getMemberQuery = `
                    SELECT 
                        pm.id,
                        pm.role,
                        pm.joined_at,
                        u.id as user_id,
                        u.full_name,
                        u.email,
                        u.role as user_role
                    FROM project_members pm
                    JOIN users u ON pm.user_id = u.id
                    WHERE pm.id = ?
                `;
                
                db.query(getMemberQuery, [result.insertId], (err, memberData) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(201).json({ message: 'Member added successfully' });
                    }
                    
                    res.status(201).json({
                        message: 'Member added successfully',
                        member: memberData[0]
                    });
                });
            });
        });
    });
});

// Get user statistics (using view)
app.get('/api/users/stats', authenticateToken, (req, res) => {
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const query = `
        SELECT 
            user_id,
            full_name,
            email,
            role,
            total_tasks,
            pending_tasks,
            in_progress_tasks,
            completed_tasks,
            overdue_tasks,
            ROUND(avg_completion_hours, 2) as avg_completion_hours,
            CASE 
                WHEN total_tasks = 0 THEN 0
                ELSE ROUND((completed_tasks / total_tasks) * 100, 2)
            END as completion_rate
        FROM vw_user_task_stats
        ORDER BY completion_rate DESC, total_tasks DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('User stats query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add user (admin only)
app.post('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { full_name, username, password, role } = req.body;
    
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'Error hashing password' });
        }
        
        const query = 'INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, ?)';
        db.query(query, [full_name, username, hashedPassword, role], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: result.insertId, message: 'User created successfully' });
        });
    });
});

// Update user (admin only)
app.put('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { id } = req.params;
    const { full_name, username, password, role } = req.body;
    
    if (password) {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ error: 'Error hashing password' });
            }
            
            const query = 'UPDATE users SET full_name = ?, username = ?, password = ?, role = ? WHERE id = ?';
            db.query(query, [full_name, username, hashedPassword, role, id], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'User updated successfully' });
            });
        });
    } else {
        const query = 'UPDATE users SET full_name = ?, username = ?, role = ? WHERE id = ?';
        db.query(query, [full_name, username, role, id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'User updated successfully' });
        });
    }
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { id } = req.params;
    
    const query = 'DELETE FROM users WHERE id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'User deleted successfully' });
    });
});

// Update profile
app.put('/api/profile', authenticateToken, (req, res) => {
    const { full_name, password } = req.body;
    const userId = req.user.id;
    
    if (password) {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ error: 'Error hashing password' });
            }
            
            const query = 'UPDATE users SET full_name = ?, password = ? WHERE id = ?';
            db.query(query, [full_name, hashedPassword, userId], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Profile updated successfully' });
            });
        });
    } else {
        const query = 'UPDATE users SET full_name = ? WHERE id = ?';
        db.query(query, [full_name, userId], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Profile updated successfully' });
        });
    }
});

// NOTE: Removed duplicate legacy notification endpoints using old schema (recipient/date)

// Update task status for Kanban board
app.put('/api/tasks/:id/status', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    
    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'on_hold'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
        });
    }
    
    // Check if user has permission to update this task
    const checkQuery = 'SELECT * FROM tasks WHERE id = ? AND (assigned_to = ? OR assigned_by = ?)';
    db.query(checkQuery, [id, userId, userId], (err, tasks) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        if (tasks.length === 0) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        
        // Update task status
        const updateQuery = 'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?';
        db.query(updateQuery, [status, id], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Failed to update task status' });
            }
            
            // Insert history record
            const historyQuery = 'INSERT INTO task_history (task_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)';
            db.query(historyQuery, [id, 'status', tasks[0].status, status, userId], (historyErr) => {
                if (historyErr) {
                    console.error('Error inserting history:', historyErr);
                }
            });
            
            res.json({ 
                success: true, 
                message: 'Task status updated successfully',
                task: { id, status }
            });
        });
    });
});

// Analytics endpoint
app.get('/api/analytics', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Base query conditions based on user role
    let userCondition = '';
    let queryParams = [];
    
    if (userRole !== 'admin') {
        userCondition = 'WHERE t.assigned_to = ? OR t.created_by = ?';
        queryParams = [userId, userId];
    }
    
    // Get task statistics
    const taskStatsQuery = `
        SELECT 
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
            COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold_tasks,
            COUNT(CASE WHEN due_date < CURDATE() AND status != 'completed' THEN 1 END) as overdue_tasks
        FROM tasks t ${userCondition}
    `;
    
    db.query(taskStatsQuery, queryParams, (err, taskStats) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        const stats = taskStats[0];
        
        // Get user performance data
        const userStatsQuery = `
            SELECT 
                u.full_name,
                COUNT(t.id) as total_assigned,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
                ROUND(COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0), 1) as completion_rate
            FROM users u
            LEFT JOIN tasks t ON u.id = t.assigned_to
            ${userRole !== 'admin' ? 'WHERE u.id = ?' : ''}
            GROUP BY u.id, u.full_name
            ORDER BY completion_rate DESC
        `;
        
        const userStatsParams = userRole !== 'admin' ? [userId] : [];
        
        db.query(userStatsQuery, userStatsParams, (userErr, userStats) => {
            if (userErr) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            // Calculate team efficiency
            const totalTasks = stats.total_tasks || 1;
            const completedTasks = stats.completed_tasks || 0;
            const teamEfficiency = Math.round((completedTasks / totalTasks) * 100);
            
            // Get project count (simplified - using distinct created_by as projects)
            const projectQuery = `
                SELECT COUNT(DISTINCT created_by) as active_projects 
                FROM tasks t 
                WHERE status != 'completed' ${userCondition ? 'AND (' + userCondition.replace('WHERE ', '') + ')' : ''}
            `;
            
            db.query(projectQuery, queryParams, (projErr, projResults) => {
                if (projErr) {
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                
                const analytics = {
                    totalTasks: stats.total_tasks || 0,
                    completedTasks: stats.completed_tasks || 0,
                    activeProjects: projResults[0].active_projects || 0,
                    teamEfficiency: teamEfficiency,
                    tasksByStatus: {
                        total: stats.total_tasks || 0,
                        pending: stats.pending_tasks || 0,
                        in_progress: stats.in_progress_tasks || 0,
                        completed: stats.completed_tasks || 0,
                        on_hold: stats.on_hold_tasks || 0
                    },
                    userPerformance: userStats,
                    productivityData: {
                        // This would contain time-series data for charts
                        // For now, we'll return placeholder data
                        weeklyCompletion: [10, 15, 12, 18, 20, 16, 14],
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                    }
                };
                
                res.json({ 
                    success: true, 
                    analytics: analytics 
                });
            });
        });
    });
});

// Advanced SQL examples as JSON APIs (for demo/testing of complex SQL)
app.get('/api/reports/summary', authenticateToken, (req, res) => {
    const sql = `
        SELECT 
          status,
          COUNT(*) AS total,
          SUM(status = 'completed') AS completed,
          ROUND(SUM(status = 'completed') * 100 / NULLIF(COUNT(*), 0), 2) AS completion_rate
        FROM tasks
        GROUP BY status
        ORDER BY FIELD(status,'urgent'), status`;
    db.query(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/reports/users-performance', authenticateToken, (req, res) => {
    const sql = `
        SELECT u.full_name,
               COUNT(t.id) AS total,
               SUM(t.status='completed') AS completed,
               ROUND(SUM(t.status='completed')*100/NULLIF(COUNT(t.id),0),2) AS completion_rate,
               ROUND(AVG(t.actual_hours),2) AS avg_actual_hours
        FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id
        GROUP BY u.id
        ORDER BY completion_rate DESC, total DESC`;
    db.query(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/reports/workload', authenticateToken, (req, res) => {
    const sql = `
        SELECT u.full_name, t.priority, COUNT(*) cnt
        FROM users u JOIN tasks t ON t.assigned_to=u.id
        GROUP BY u.id, t.priority
        ORDER BY u.full_name, FIELD(t.priority,'urgent','high','medium','low')`;
    db.query(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// String functions demo (UPPER/LOWER/LTRIM/RTRIM/LEFT/RIGHT/SUBSTRING/CONCAT)
app.get('/api/reports/strings', authenticateToken, (req, res) => {
    const sql = `
        SELECT 
          u.id,
          u.full_name,
          UPPER(u.full_name) AS name_upper,
          LOWER(u.full_name) AS name_lower,
          LTRIM(RTRIM(u.username)) AS trimmed_username,
          LENGTH(u.username) AS byte_length,
          CHAR_LENGTH(u.username) AS char_length,
          LEFT(u.email, 5) AS email_left5,
          RIGHT(u.email, 8) AS email_right8,
          SUBSTRING(u.email, 2, 5) AS email_mid,
          CONCAT(u.full_name, ' <', u.email, '>') AS display
        FROM users u
        ORDER BY u.full_name`;
    db.query(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Set operators demo (UNION/ALL and INTERSECT/MINUS emulations)
app.get('/api/reports/setops', authenticateToken, (req, res) => {
    const userId = parseInt(req.query.userId, 10) || req.user.id;
    const unionSql = `(
        SELECT id, title, 'assigned_to_me' AS src FROM tasks WHERE assigned_to = ?
    )
    UNION
    (
        SELECT id, title, 'created_by_me' AS src FROM tasks WHERE assigned_by = ?
    )`;

    const intersectSql = `
        SELECT t1.id, t1.title
        FROM tasks t1
        WHERE t1.assigned_to = ?
          AND EXISTS (
            SELECT 1 FROM tasks t2 WHERE t2.assigned_by = ? AND t2.id = t1.id
          )`;

    const minusSql = `
        SELECT t1.id, t1.title
        FROM tasks t1
        WHERE t1.assigned_to = ?
          AND NOT EXISTS (
            SELECT 1 FROM tasks t2 WHERE t2.assigned_by = ? AND t2.id = t1.id
          )`;

    db.query(unionSql, [userId, userId], (e1, unionRows) => {
        if (e1) return res.status(500).json({ error: 'Database error (union)' });
        db.query(intersectSql, [userId, userId], (e2, interRows) => {
            if (e2) return res.status(500).json({ error: 'Database error (intersect)' });
            db.query(minusSql, [userId, userId], (e3, minusRows) => {
                if (e3) return res.status(500).json({ error: 'Database error (minus)' });
                res.json({ union: unionRows, intersect: interRows, minus: minusRows });
            });
        });
    });
});

// Get task statistics for dashboard
app.get('/api/task-statistics', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let userCondition = '';
    let queryParams = [];
    
    if (userRole !== 'admin') {
        userCondition = 'WHERE assigned_to = ? OR created_by = ?';
        queryParams = [userId, userId];
    }
    
    const query = `
        SELECT 
            status,
            priority,
            COUNT(*) as count,
            DATE(created_at) as date
        FROM tasks 
        ${userCondition}
        GROUP BY status, priority, DATE(created_at)
        ORDER BY created_at DESC
        LIMIT 30
    `;
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        res.json({ 
            success: true, 
            statistics: results 
        });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Profile photo upload
app.post('/api/user/profile-photo', authenticateToken, upload.single('profilePhoto'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const relativePath = `/uploads/profile/${req.file.filename}`;

    // Optionally, persist the photo URL in DB for the user
    const updateQuery = 'UPDATE users SET profile_photo = ? WHERE id = ?';
    db.query(updateQuery, [relativePath, req.user.id], (err) => {
        if (err) {
            console.error('Failed to update profile photo in DB:', err);
            // Still return success with path, as file is stored
            return res.json({ photoUrl: relativePath, warning: 'DB update failed' });
        }
        res.json({ photoUrl: relativePath });
    });
});

// Remove profile photo
app.delete('/api/user/profile-photo', authenticateToken, (req, res) => {
    // Fetch existing photo path
    const getQuery = 'SELECT profile_photo FROM users WHERE id = ? LIMIT 1';
    db.query(getQuery, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });

        const photoPath = results[0].profile_photo;
        const updateQuery = 'UPDATE users SET profile_photo = NULL WHERE id = ?';
        db.query(updateQuery, [req.user.id], (updErr) => {
            if (updErr) return res.status(500).json({ error: 'Failed to update user' });

            // Try to delete file if it exists
            if (photoPath) {
                const fullPath = path.join(__dirname, 'public', photoPath.replace(/^\/+/, ''));
                fs.unlink(fullPath, () => {});
            }
            res.json({ success: true });
        });
    });
});

// Logout all sessions (basic token invalidation placeholder)
app.post('/api/user/logout-all-sessions', authenticateToken, (req, res) => {
    // In a real system, maintain a token blacklist or rotate secrets per user
    // Here we simply respond success; frontend clears local storage
    res.json({ success: true });
});

// Export user data (placeholder endpoint)
app.get('/api/user/export-data', authenticateToken, (req, res) => {
    // Placeholder for data export functionality
    res.json({ message: 'Data export not implemented yet' });
});

// Socket.IO for real-time messaging
const activeUsers = new Map();
const chatRooms = new Map();

// Helper: create and emit a task assignment notification
function notifyTaskAssigned({ recipientId, senderId, taskId, taskTitle, priority = 'medium' }) {
    if (!recipientId || !taskId) return;
    const title = 'New Task Assigned';
    const message = `You have been assigned a new task: "${taskTitle || 'Task'}"`;
    const sql = `INSERT INTO notifications (recipient_id, sender_id, task_id, type, title, message, priority)
                 VALUES (?, ?, ?, 'task_assigned', ?, ?, ?)`;
    const params = [recipientId, senderId || null, taskId, title, message, priority];
    db.query(sql, params, (err, result) => {
        if (err) {
            return console.warn('Failed to insert notification:', err.message);
        }
        // Emit to recipient if online
        const payload = {
            id: result.insertId,
            type: 'task_assigned',
            title,
            message,
            is_read: 0,
            priority,
            task_id: taskId,
            created_at: new Date()
        };
        const recipient = activeUsers.get(recipientId);
        if (recipient) {
            io.to(recipient.socketId).emit('notification', payload);
        }
    });
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user authentication and joining
    socket.on('join', (userData) => {
        socket.userId = userData.userId;
        socket.username = userData.username;
        socket.fullName = userData.fullName;
        activeUsers.set(userData.userId, {
            socketId: socket.id,
            username: userData.username,
            fullName: userData.fullName,
            online: true
        });
        
        // Join general chat room by default
        socket.join('general');
        
        // Broadcast updated user list
        io.emit('users_updated', Array.from(activeUsers.values()));
        
        console.log(`${userData.username} joined the chat`);
    });

    // Handle joining specific rooms
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        if (!chatRooms.has(roomId)) {
            chatRooms.set(roomId, {
                id: roomId,
                name: roomId.includes('general') ? 'General Chat' : `Chat ${roomId}`,
                messages: [],
                members: []
            });
        }
        console.log(`User ${socket.username} joined room: ${roomId}`);
    });

    // Handle sending messages
    socket.on('send_message', (messageData) => {
        const message = {
            id: Date.now().toString(),
            text: messageData.text,
            sender: {
                id: socket.userId,
                username: socket.username,
                fullName: socket.fullName
            },
            timestamp: new Date(),
            roomId: messageData.roomId
        };

        // Store message in room
        if (chatRooms.has(messageData.roomId)) {
            chatRooms.get(messageData.roomId).messages.push(message);
        }

        // Send to room members
        io.to(messageData.roomId).emit('new_message', message);
        
        console.log(`Message from ${socket.username} in ${messageData.roomId}: ${messageData.text}`);
    });

    // Handle private messaging
    socket.on('send_private_message', (data) => {
        const message = {
            id: Date.now().toString(),
            text: data.text,
            sender: {
                id: socket.userId,
                username: socket.username,
                fullName: socket.fullName
            },
            recipient: data.recipient,
            timestamp: new Date(),
            private: true
        };

        // Send to recipient if online
        const recipient = activeUsers.get(data.recipient.id);
        if (recipient) {
            io.to(recipient.socketId).emit('new_private_message', message);
        }
        
        // Send back to sender for confirmation
        socket.emit('message_sent', message);
        
        console.log(`Private message from ${socket.username} to ${data.recipient.username}`);
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user_typing', {
            userId: socket.userId,
            username: socket.username,
            isTyping: data.isTyping
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (socket.userId) {
            activeUsers.delete(socket.userId);
            io.emit('users_updated', Array.from(activeUsers.values()));
            console.log(`${socket.username} disconnected`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
