const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'task_management_db'
});

async function setupDatabase() {
    try {
        console.log('Connecting to database...');
        await db.promise().connect();
        console.log('Connected to database successfully!');

        // Create tables
        console.log('Creating tables...');
        
        // Users table (align with database.sql)
        await db.promise().execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'manager', 'employee') NOT NULL DEFAULT 'employee',
                status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
                last_login TIMESTAMP NULL,
                login_attempts INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_username (username),
                INDEX idx_role (role),
                INDEX idx_status (status)
            )
        `);
        console.log('✓ Users table ready');

        // Add email column if it doesn't exist (for existing databases)
        try {
            await db.promise().execute(`
                ALTER TABLE users ADD COLUMN email VARCHAR(100) AFTER full_name
            `);
            console.log('✓ Email column added to users table');
        } catch (error) {
            // Column might already exist, which is fine
            if (!error.message.includes('Duplicate column name')) {
                console.log('ℹ Email column already exists in users table');
            }
        }

        // Projects table (needed for tasks FK)
        await db.promise().execute(`
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
            )
        `);
        console.log('✓ Projects table ready');

        // Tasks table (align with database.sql)
        await db.promise().execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                assigned_to INT,
                assigned_by INT,
                project_id INT NULL,
                status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold') DEFAULT 'pending',
                priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                due_date DATE,
                start_date DATE,
                completion_date TIMESTAMP NULL,
                estimated_hours DECIMAL(5,2),
                actual_hours DECIMAL(5,2),
                progress_percentage INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE,
                INDEX idx_assigned_to (assigned_to),
                INDEX idx_assigned_by (assigned_by),
                INDEX idx_project_id (project_id),
                INDEX idx_status (status),
                INDEX idx_priority (priority),
                INDEX idx_due_date (due_date),
                CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
            )
        `);
        console.log('✓ Tasks table ready');

        // Notifications table (align with database.sql)
        await db.promise().execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recipient_id INT NOT NULL,
                sender_id INT,
                task_id INT,
                type ENUM('task_assigned', 'task_completed', 'task_overdue', 'deadline_reminder', 'status_update', 'system') NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
                read_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
                INDEX idx_recipient_id (recipient_id),
                INDEX idx_sender_id (sender_id),
                INDEX idx_task_id (task_id),
                INDEX idx_type (type),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at)
            )
        `);
        console.log('✓ Notifications table ready');

        // Check if admin user exists
        const [adminUsers] = await db.promise().execute(
            'SELECT * FROM users WHERE username = ?',
            ['admin']
        );

        if (adminUsers.length === 0) {
            // Create default admin user
            const hashedPassword = await bcrypt.hash('password', 10);
            await db.promise().execute(
                'INSERT INTO users (full_name, email, username, password, role) VALUES (?, ?, ?, ?, ?)',
                ['Admin User', 'admin@taskmanagement.com', 'admin', hashedPassword, 'admin']
            );
            console.log('✓ Default admin user created (username: admin, password: password)');
        } else {
            console.log('✓ Admin user already exists');
        }

        // Create sample employee user
        const [employeeUsers] = await db.promise().execute(
            'SELECT * FROM users WHERE username = ?',
            ['employee']
        );

        if (employeeUsers.length === 0) {
            const hashedPassword = await bcrypt.hash('password', 10);
            await db.promise().execute(
                'INSERT INTO users (full_name, email, username, password, role) VALUES (?, ?, ?, ?, ?)',
                ['John Employee', 'employee@taskmanagement.com', 'employee', hashedPassword, 'employee']
            );
            console.log('✓ Sample employee user created (username: employee, password: password)');
        } else {
            console.log('✓ Employee user already exists');
        }

    // Create sample tasks
    const [tasks] = await db.promise().execute('SELECT COUNT(*) as count FROM tasks');
        
        if (tasks[0].count === 0) {
            await db.promise().execute(
                'INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, start_date) VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE)',
                ['Complete Project Setup', 'Set up the development environment and install dependencies', 2, 1, 'high', '2025-09-15']
            );
            
            await db.promise().execute(
                'INSERT INTO tasks (title, description, assigned_to, assigned_by, status, priority, due_date, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)',
                ['Review Code', 'Review the latest code changes and provide feedback', 2, 1, 'in_progress', 'medium', '2025-09-20']
            );
            
            await db.promise().execute(
                'INSERT INTO tasks (title, description, assigned_to, assigned_by, status, priority, due_date, start_date, completion_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, CURRENT_TIMESTAMP)',
                ['Update Documentation', 'Update the project documentation with latest changes', 2, 1, 'completed', 'low', '2025-09-10']
            );
            
            console.log('✓ Sample tasks created');
        } else {
            console.log('✓ Sample tasks already exist');
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\nDefault login credentials:');
        console.log('Admin - Username: admin, Password: password');
        console.log('Employee - Username: employee, Password: password');
        console.log('\nYou can now start the application with: npm start');

    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    } finally {
        db.end();
    }
}

// Run setup
setupDatabase();
