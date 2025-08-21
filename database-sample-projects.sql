-- Seed 5 projects and assign separate people as owners and members
USE task_management_db;

-- Project 1: Owner = manager (id=2), Member = john (id=3)
INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color, budget)
VALUES ('Marketing Launch Plan', 'Plan and execute the Q4 marketing launch', 2, 'active', 'high', CURRENT_DATE, CURRENT_DATE + INTERVAL 45 DAY, '#EF4444', 15000.00);
SET @pid := LAST_INSERT_ID();
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 2, 'owner');
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 3, 'member');

-- Project 2: Owner = john (id=3), Member = jane (id=4)
INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color, budget)
VALUES ('Customer Feedback Portal', 'Build a portal to collect and analyze customer feedback', 3, 'planning', 'medium', CURRENT_DATE + INTERVAL 3 DAY, CURRENT_DATE + INTERVAL 60 DAY, '#10B981', 9000.00);
SET @pid := LAST_INSERT_ID();
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 3, 'owner');
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 4, 'member');

-- Project 3: Owner = jane (id=4), Member = mike (id=5)
INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color, budget)
VALUES ('Internal Tools Upgrade', 'Upgrade internal tooling and workflows', 4, 'active', 'high', CURRENT_DATE - INTERVAL 5 DAY, CURRENT_DATE + INTERVAL 30 DAY, '#3B82F6', 12000.00);
SET @pid := LAST_INSERT_ID();
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 4, 'owner');
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 5, 'member');

-- Project 4: Owner = mike (id=5), Member = admin (id=1)
INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color, budget)
VALUES ('Mobile App v2', 'Second version of the mobile application with new features', 5, 'on_hold', 'medium', CURRENT_DATE - INTERVAL 10 DAY, CURRENT_DATE + INTERVAL 90 DAY, '#F59E0B', 25000.00);
SET @pid := LAST_INSERT_ID();
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 5, 'owner');
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 1, 'member');

-- Project 5: Owner = admin (id=1), Member = manager (id=2)
INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color, budget)
VALUES ('Data Warehouse Initiative', 'Design the new data warehouse and ETL pipelines', 1, 'planning', 'urgent', CURRENT_DATE, CURRENT_DATE + INTERVAL 120 DAY, '#8B5CF6', 40000.00);
SET @pid := LAST_INSERT_ID();
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 1, 'owner');
INSERT INTO project_members (project_id, user_id, role) VALUES (@pid, 2, 'member');
