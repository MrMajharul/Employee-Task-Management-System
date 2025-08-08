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
        
        // Users table
        await db.promise().execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(50) NOT NULL,
                email VARCHAR(100),
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'employee') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Users table created');

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

        // Tasks table
        await db.promise().execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                assigned_to INT,
                status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
                due_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✓ Tasks table created');

        // Notifications table
        await db.promise().execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message TEXT NOT NULL,
                recipient INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                date DATE NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (recipient) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✓ Notifications table created');

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
                'INSERT INTO tasks (title, description, assigned_to, status, due_date) VALUES (?, ?, ?, ?, ?)',
                ['Complete Project Setup', 'Set up the development environment and install dependencies', 2, 'pending', '2024-01-15']
            );
            
            await db.promise().execute(
                'INSERT INTO tasks (title, description, assigned_to, status, due_date) VALUES (?, ?, ?, ?, ?)',
                ['Review Code', 'Review the latest code changes and provide feedback', 2, 'in_progress', '2024-01-20']
            );
            
            await db.promise().execute(
                'INSERT INTO tasks (title, description, assigned_to, status, due_date) VALUES (?, ?, ?, ?, ?)',
                ['Update Documentation', 'Update the project documentation with latest changes', 2, 'completed', '2024-01-10']
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
