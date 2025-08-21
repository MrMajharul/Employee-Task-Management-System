const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'task_management_db',
  });
  console.log('Connected to DB');

  // Resolve user IDs by username to be resilient
  const usernames = ['admin', 'manager', 'john', 'jane', 'mike'];
  const userIds = {};
  for (const u of usernames) {
    const [rows] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [u]);
    if (!rows.length) throw new Error(`User ${u} not found`);
    userIds[u] = rows[0].id;
  }

  const projects = [
    {
      name: 'Marketing Launch Plan',
      description: 'Plan and execute the Q4 marketing launch',
      owner: 'manager',
      member: 'john',
      status: 'active',
      priority: 'high',
      startDelta: 0,
      dueDelta: 45,
      color: '#EF4444',
      budget: 15000.0,
    },
    {
      name: 'Customer Feedback Portal',
      description: 'Build a portal to collect and analyze customer feedback',
      owner: 'john',
      member: 'jane',
      status: 'planning',
      priority: 'medium',
      startDelta: 3,
      dueDelta: 60,
      color: '#10B981',
      budget: 9000.0,
    },
    {
      name: 'Internal Tools Upgrade',
      description: 'Upgrade internal tooling and workflows',
      owner: 'jane',
      member: 'mike',
      status: 'active',
      priority: 'high',
      startDelta: -5,
      dueDelta: 30,
      color: '#3B82F6',
      budget: 12000.0,
    },
    {
      name: 'Mobile App v2',
      description: 'Second version of the mobile application with new features',
      owner: 'mike',
      member: 'admin',
      status: 'on_hold',
      priority: 'medium',
      startDelta: -10,
      dueDelta: 90,
      color: '#F59E0B',
      budget: 25000.0,
    },
    {
      name: 'Data Warehouse Initiative',
      description: 'Design the new data warehouse and ETL pipelines',
      owner: 'admin',
      member: 'manager',
      status: 'planning',
      priority: 'urgent',
      startDelta: 0,
      dueDelta: 120,
      color: '#8B5CF6',
      budget: 40000.0,
    },
  ];

  for (const p of projects) {
    const [res] = await db.query(
      `INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color, budget)
       VALUES (?, ?, ?, ?, ?, CURDATE() + INTERVAL ? DAY, CURDATE() + INTERVAL ? DAY, ?, ?)`,
      [
        p.name,
        p.description,
        userIds[p.owner],
        p.status,
        p.priority,
        p.startDelta,
        p.dueDelta,
        p.color,
        p.budget,
      ]
    );
    const projectId = res.insertId;
    await db.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner') ON DUPLICATE KEY UPDATE role=VALUES(role)`,
      [projectId, userIds[p.owner]]
    );
    await db.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member') ON DUPLICATE KEY UPDATE role=VALUES(role)`,
      [projectId, userIds[p.member]]
    );
    console.log('Seeded project:', p.name);
  }

  await db.end();
  console.log('Done');
}

main().catch((e) => {
  console.error('Seed error:', e.message);
  process.exit(1);
});
