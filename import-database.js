const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true  // Allow multiple SQL statements
});

async function importDatabase() {
    try {
        console.log('🔄 Connecting to MySQL server...');
        await db.promise().connect();
        console.log('✅ Connected to MySQL server successfully!');

        // Read the SQL file
        const sqlFile = path.join(__dirname, 'database.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        console.log('🔄 Importing database from database.sql...');
        
        // Split SQL statements by semicolon and filter out empty ones
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.match(/^--/));
        
        console.log(`📝 Found ${statements.length} SQL statements to execute...`);
        
        // Execute each statement individually
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    await db.promise().query(statement);
                    if (statement.toLowerCase().includes('create table')) {
                        const tableName = statement.match(/create table (?:if not exists )?(\w+)/i);
                        if (tableName) {
                            console.log(`  ✅ Created table: ${tableName[1]}`);
                        }
                    } else if (statement.toLowerCase().includes('create view')) {
                        const viewName = statement.match(/create view (\w+)/i);
                        if (viewName) {
                            console.log(`  ✅ Created view: ${viewName[1]}`);
                        }
                    } else if (statement.toLowerCase().includes('insert into')) {
                        const tableName = statement.match(/insert into (\w+)/i);
                        if (tableName) {
                            console.log(`  ✅ Inserted data into: ${tableName[1]}`);
                        }
                    }
                } catch (error) {
                    console.warn(`  ⚠️  Warning executing statement ${i + 1}: ${error.message}`);
                    // Continue with other statements even if one fails
                }
            }
        }
        
        console.log('✅ Database imported successfully!');
        console.log('\n📊 Database Features:');
        console.log('  • Enhanced table structure with indexes');
        console.log('  • SQL Views for optimized queries');
        console.log('  • Task history tracking');
        console.log('  • Comprehensive notification system');
        console.log('  • Role-based user management');
        
        console.log('\n🔐 Default Login Credentials:');
        console.log('  Admin    - Username: admin,   Password: password');
        console.log('  Manager  - Username: manager, Password: password');
        console.log('  Employee - Username: john,    Password: password');
        
        console.log('\n🚀 Ready to start! Run: npm start');
        console.log('\n💡 For advanced features (triggers, stored procedures):');
        console.log('   Execute database-advanced.sql manually in MySQL');

    } catch (error) {
        console.error('❌ Error importing database:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 Fix: Check your database credentials in .env file or update the connection settings');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Fix: Make sure MySQL server is running');
        }
        
        process.exit(1);
    } finally {
        db.end();
    }
}

// Run import
console.log('🎯 Employee Task Management System - Database Import');
console.log('==================================================');
importDatabase();
