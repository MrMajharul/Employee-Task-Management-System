const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'task_management_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, 'your-secret-key', (err, user) => {
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

// Google Login endpoint
app.post('/api/google-login', async (req, res) => {
    const { username, full_name, email, role, picture } = req.body;
    
    try {
        // Check if user exists
        const checkQuery = 'SELECT * FROM users WHERE username = ?';
        db.query(checkQuery, [username], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            let user;
            if (results.length === 0) {
                // Create new user
                const insertQuery = 'INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, ?)';
                const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10); // Random password for Google users
                
                db.query(insertQuery, [full_name, username, hashedPassword, role], (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    user = {
                        id: result.insertId,
                        username: username,
                        full_name: full_name,
                        role: role
                    };
                    
                    const token = jwt.sign(
                        { id: user.id, username: user.username, role: user.role },
                        'your-secret-key',
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
                    'your-secret-key',
                    { expiresIn: '24h' }
                );
                
                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        role: user.role
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    });
});

// Registration endpoint with stored procedure and transaction
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
    
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Use stored procedure for user creation with transaction
        const query = 'CALL sp_create_user(?, ?, ?, ?, ?)';
        
        db.query(query, [full_name, email, username, hashedPassword, role], (err, results) => {
            if (err) {
                console.error('Registration error:', err);
                if (err.message.includes('Email already exists')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                if (err.message.includes('Username already exists')) {
                    return res.status(409).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: 'Failed to create account' });
            }
            
            const userId = results[0][0].user_id;
            
            // Get the created user details
            const getUserQuery = `
                SELECT id, username, full_name, email, role, status, created_at 
                FROM users 
                WHERE id = ?
            `;
            
            db.query(getUserQuery, [userId], (err, userResults) => {
                if (err) {
                    console.error('Error fetching user:', err);
                    return res.status(500).json({ error: 'Account created but failed to retrieve details' });
                }
                
                const newUser = userResults[0];
                
                const token = jwt.sign(
                    { id: newUser.id, username: newUser.username, role: newUser.role },
                    'your-secret-key',
                    { expiresIn: '24h' }
                );
                
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
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Dashboard data endpoint with stored procedure
app.get('/api/dashboard', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    // Use stored procedure to get dashboard data
    const query = 'CALL sp_get_user_dashboard(?)';
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Dashboard query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const dashboardData = results[0][0];
        
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

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const query = 'SELECT * FROM users WHERE role = "employee"';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add task with stored procedure and transaction
app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, description, assigned_to, due_date, priority, estimated_hours } = req.body;
    
    // Validate required fields
    if (!title || !assigned_to) {
        return res.status(400).json({ error: 'Title and assigned user are required' });
    }
    
    // Use stored procedure for task assignment with transaction
    const query = 'CALL sp_assign_task(?, ?, ?, ?, ?, ?, ?)';
    const params = [
        title, 
        description || null, 
        assigned_to, 
        req.user.id, // assigned_by
        priority || 'medium',
        due_date || null,
        estimated_hours || null
    ];
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Task creation error:', err);
            if (err.message.includes('does not exist or is inactive')) {
                return res.status(400).json({ error: 'Assigned user does not exist or is inactive' });
            }
            return res.status(500).json({ error: 'Failed to create task' });
        }
        
        const taskId = results[0][0].task_id;
        
        // Get the created task details using the view
        const getTaskQuery = `
            SELECT * FROM vw_task_summary WHERE id = ?
        `;
        
        db.query(getTaskQuery, [taskId], (err, taskResults) => {
            if (err) {
                console.error('Error fetching created task:', err);
                return res.status(500).json({ error: 'Task created but failed to retrieve details' });
            }
            
            res.status(201).json({
                message: 'Task created successfully',
                task: taskResults[0]
            });
        });
    });
});

// Update task with stored procedure for status changes
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, description, assigned_to, due_date, status, priority, actual_hours } = req.body;
    
    // If only status is being updated, use stored procedure
    if (status && Object.keys(req.body).length <= 3) { // status, and optionally actual_hours
        const query = 'CALL sp_update_task_status(?, ?, ?, ?)';
        
        db.query(query, [id, req.user.id, status, actual_hours || null], (err, results) => {
            if (err) {
                console.error('Task status update error:', err);
                if (err.message.includes('Task not found')) {
                    return res.status(404).json({ error: 'Task not found' });
                }
                if (err.message.includes('Insufficient permissions')) {
                    return res.status(403).json({ error: 'Insufficient permissions to update this task' });
                }
                return res.status(500).json({ error: 'Failed to update task status' });
            }
            
            res.json({ message: 'Task status updated successfully' });
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

// Get user notifications
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
            t.title as task_title,
            sender.full_name as sender_name
        FROM notifications n
        LEFT JOIN tasks t ON n.task_id = t.id
        LEFT JOIN users sender ON n.sender_id = sender.id
        WHERE n.recipient_id = ?
    `;
    
    let params = [userId];
    
    if (unread_only === 'true') {
        query += ' AND n.is_read = FALSE';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Notifications query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Use transaction to ensure atomic update
    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ error: 'Transaction error' });
        }
        
        // Check if notification belongs to user
        const checkQuery = 'SELECT id FROM notifications WHERE id = ? AND recipient_id = ?';
        
        db.query(checkQuery, [id, userId], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ error: 'Database error' });
                });
            }
            
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).json({ error: 'Notification not found' });
                });
            }
            
            // Update notification
            const updateQuery = `
                UPDATE notifications 
                SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.query(updateQuery, [id], (err, result) => {
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
                    
                    res.json({ message: 'Notification marked as read' });
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

// Get notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const query = 'SELECT * FROM notifications WHERE recipient = ? ORDER BY date DESC';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const query = 'UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient = ?';
    db.query(query, [id, userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Notification marked as read' });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
