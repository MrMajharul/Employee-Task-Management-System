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

/**
 * Parse a SQL file supporting DELIMITER changes (procedures/triggers/events).
 * Returns an array of executable statements without DELIMITER directives.
 */
function parseSqlWithDelimiter(sqlText) {
    const lines = sqlText.split(/\r?\n/);
    let delimiter = ';';
    let buffer = '';
    const statements = [];

    const flushBuffer = () => {
        let stmt = buffer.trim();
        if (!stmt) return;
        // Remove trailing delimiter if present
        if (delimiter !== '' && stmt.endsWith(delimiter)) {
            stmt = stmt.slice(0, -delimiter.length).trim();
        }
        if (stmt && !/^--/.test(stmt)) {
            statements.push(stmt);
        }
        buffer = '';
    };

    for (let rawLine of lines) {
        const line = rawLine.replace(/\uFEFF/g, ''); // strip BOM if any
        const delimMatch = line.match(/^\s*DELIMITER\s+(.+)\s*$/i);
        if (delimMatch) {
            // On delimiter change, flush any pending statement
            flushBuffer();
            delimiter = delimMatch[1];
            continue;
        }

        buffer += rawLine + '\n';

        // If current buffer ends with the active delimiter on a line boundary, flush
        const trimmed = buffer.trimEnd();
        if (delimiter && trimmed.endsWith(delimiter)) {
            flushBuffer();
        }
    }

    // Flush any remaining
    flushBuffer();
    return statements;
}

async function executeSqlFile(filePath) {
    const label = path.basename(filePath);
    console.log(`\n📄 Loading: ${label}`);
    if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️  Skipped (file not found)`);
        return;
    }
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    // If file uses DELIMITER, use advanced parser; else fall back to simple split
    const usesDelimiter = /\bDELIMITER\b/i.test(sqlContent);
    let statements = [];
    if (usesDelimiter) {
        statements = parseSqlWithDelimiter(sqlContent);
    } else {
        statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
    }

    console.log(`  📝 Executing ${statements.length} statements...`);
    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
            // Execute
            await db.promise().query(stmt);
            const low = stmt.toLowerCase();
            if (low.includes('create table')) {
                const m = stmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/i);
                if (m) console.log(`    ✅ Created table: ${m[1]}`);
            } else if (low.includes('create view')) {
                const m = stmt.match(/create\s+view\s+(\w+)/i);
                if (m) console.log(`    ✅ Created view: ${m[1]}`);
            } else if (low.includes('create trigger')) {
                const m = stmt.match(/create\s+trigger\s+(\w+)/i);
                if (m) console.log(`    ✅ Created trigger: ${m[1]}`);
            } else if (low.includes('create procedure')) {
                const m = stmt.match(/create\s+procedure\s+(\w+)/i);
                if (m) console.log(`    ✅ Created procedure: ${m[1]}`);
            } else if (low.includes('create event')) {
                const m = stmt.match(/create\s+event\s+(\w+)/i);
                if (m) console.log(`    ✅ Created event: ${m[1]}`);
            } else if (low.startsWith('insert into')) {
                const m = stmt.match(/insert\s+into\s+(\w+)/i);
                if (m) console.log(`    ✅ Inserted data into: ${m[1]}`);
            } else if (low.startsWith('use ')) {
                const m = stmt.match(/use\s+(\w+)/i);
                if (m) console.log(`    🔄 Using database: ${m[1]}`);
            }
        } catch (err) {
            console.warn(`    ⚠️  Statement ${i + 1} warning: ${err.message}`);
        }
    }
}

async function importDatabase() {
    try {
        console.log('🔄 Connecting to MySQL server...');
        await db.promise().connect();
        console.log('✅ Connected to MySQL server successfully!');

        const args = process.argv.slice(2);
        const importAll = args.includes('--all');
        const customFileIndex = args.indexOf('--file');
        const customFile = customFileIndex !== -1 ? args[customFileIndex + 1] : null;

        const files = [];
        if (customFile) {
            files.push(path.isAbsolute(customFile) ? customFile : path.join(__dirname, customFile));
        } else if (importAll) {
            files.push(
                path.join(__dirname, 'database.sql'),
                path.join(__dirname, 'database-advanced.sql'),
                path.join(__dirname, 'database-team-collaboration.sql')
            );
        } else {
            // Default: base schema/data only
            files.push(path.join(__dirname, 'database.sql'));
        }

        console.log(`\n📦 Import mode: ${customFile ? 'single file' : (importAll ? 'ALL SQL files' : 'base schema')}`);
        for (const file of files) {
            await executeSqlFile(file);
        }

        console.log('\n✅ Database import process completed!');
        console.log('\n📊 Database Features:');
        console.log('  • Tables, Views, Indexes');
        console.log('  • Stored Procedures & Triggers (advanced)');
        console.log('  • Events (if privileges allow)');
        console.log('  • Seed data and team collaboration additions');
        
        console.log('\n🔐 Default Login Credentials:');
        console.log('  Admin    - Username: admin,   Password: password');
        console.log('  Manager  - Username: manager, Password: password');
        console.log('  Employee - Username: john,    Password: password');
        
        console.log('\n� Tip: The file database-queries.sql contains 65 reporting queries you can run in a SQL client.');

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
