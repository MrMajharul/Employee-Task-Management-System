-- Employee Task Management System: SQL Examples and Cheatsheet
-- Purpose: Demonstrate commonly asked SQL features against this project's schema (MySQL)
-- Important: Review each section before executing. Many statements are read-only SELECTs.
-- DDL/Trigger/Transaction/Lock samples are provided for learning; run selectively.

USE task_management_db;

-- =============================
-- Aggregations: AVG, COUNT, DISTINCT, MAX, MIN, SUM, GROUP BY, HAVING
-- =============================
-- Tasks per status with totals and completion rate
SELECT 
  status,
  COUNT(*) AS total,
  SUM(status = 'completed') AS completed,
  ROUND(SUM(status = 'completed') * 100 / NULLIF(COUNT(*), 0), 2) AS completion_rate
FROM tasks
GROUP BY status
HAVING total >= 0
ORDER BY FIELD(status,'urgent'), status;

-- Count distinct assignees and max/min/avg/total hours
SELECT 
  COUNT(DISTINCT assigned_to) AS distinct_assignees,
  MAX(estimated_hours) AS max_estimate,
  MIN(estimated_hours) AS min_estimate,
  ROUND(AVG(estimated_hours),2) AS avg_estimate,
  ROUND(SUM(estimated_hours),2) AS total_estimate
FROM tasks;

-- =============================
-- String functions: SUBSTRING/MID/SUBSTR, UPPER/UCASE, LOWER/LCASE, LTRIM/RTRIM, LENGTH/CHAR_LENGTH, LEFT/RIGHT, CONCAT
-- =============================
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
ORDER BY u.full_name;

-- =============================
-- Numeric: ROUND, FLOOR, CEILING
-- =============================
SELECT 
  t.id, t.title,
  ROUND(t.estimated_hours, 1) AS round_est,
  FLOOR(t.estimated_hours) AS floor_est,
  CEILING(t.estimated_hours) AS ceil_est
FROM tasks t
WHERE t.estimated_hours IS NOT NULL
ORDER BY t.estimated_hours DESC;

-- =============================
-- Joins: INNER, LEFT, RIGHT, CROSS, FULL OUTER (emulated)
-- =============================
-- INNER JOIN: tasks with assignee names
SELECT t.id, t.title, u.full_name AS assignee
FROM tasks t
INNER JOIN users u ON u.id = t.assigned_to
ORDER BY t.updated_at DESC
LIMIT 20;

-- LEFT JOIN: include tasks with no assignee
SELECT t.id, t.title, u.full_name AS assignee
FROM tasks t
LEFT JOIN users u ON u.id = t.assigned_to
ORDER BY t.updated_at DESC
LIMIT 20;

-- RIGHT JOIN: users and their latest task (may return users with NULL task if right side is users)
SELECT t.id, t.title, u.full_name
FROM tasks t
RIGHT JOIN users u ON u.id = t.assigned_to
ORDER BY u.full_name
LIMIT 20;

-- CROSS JOIN: Cartesian product (limit it!)
SELECT u.full_name, p.name AS project
FROM users u
CROSS JOIN projects p
LIMIT 20;

-- FULL OUTER JOIN emulation using UNION (rows missing on either side)
SELECT t.id AS task_id, t.title, u.id AS user_id, u.full_name
FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
UNION
SELECT t.id AS task_id, t.title, u.id AS user_id, u.full_name
FROM users u LEFT JOIN tasks t ON u.id = t.assigned_to;

-- =============================
-- WHERE, AND, OR, NOT, BETWEEN/NOT BETWEEN, IN/NOT IN, LIKE
-- =============================
SELECT id, title, priority, due_date
FROM tasks
WHERE 
  status <> 'completed'
  AND (priority IN ('high','urgent') OR (due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 3 DAY))
  AND title LIKE '%Task%'
ORDER BY priority DESC, due_date ASC;

-- NOT BETWEEN and NOT IN example
SELECT id, title, status
FROM tasks
WHERE due_date NOT BETWEEN CURRENT_DATE - INTERVAL 30 DAY AND CURRENT_DATE
  AND status NOT IN ('completed','cancelled')
ORDER BY updated_at DESC;

-- =============================
-- ORDER BY ASC/DESC with multiple columns
-- =============================
SELECT id, title, priority, updated_at
FROM tasks
ORDER BY FIELD(priority,'urgent','high','medium','low'), updated_at DESC;

-- =============================
-- Set operators: UNION, UNION ALL; INTERSECT/MINUS (emulated)
-- =============================
-- Tasks involving a user either as assignee or creator (UNION)
SET @uid = 1;
(
  SELECT id, title, 'assigned_to_me' AS src FROM tasks WHERE assigned_to = @uid
)
UNION
(
  SELECT id, title, 'created_by_me' AS src FROM tasks WHERE assigned_by = @uid
);

-- UNION ALL keeps duplicates
(
  SELECT assigned_to AS user_id FROM tasks
)
UNION ALL
(
  SELECT assigned_by AS user_id FROM tasks
);

-- INTERSECT emulation: rows appearing in both sets
SELECT t1.id, t1.title
FROM tasks t1
WHERE t1.assigned_to = @uid
  AND EXISTS (
    SELECT 1 FROM tasks t2 WHERE t2.assigned_by = @uid AND t2.id = t1.id
  );

-- MINUS/EXCEPT emulation: rows in A not in B
SELECT t1.id, t1.title
FROM tasks t1
WHERE t1.assigned_to = @uid
  AND NOT EXISTS (
    SELECT 1 FROM tasks t2 WHERE t2.assigned_by = @uid AND t2.id = t1.id
  );

-- =============================
-- DDL: Add/Drop column, position (FIRST/AFTER)
-- =============================
-- Example (commented): add a computed/note column to tasks
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes VARCHAR(255) NULL AFTER description;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0 FIRST;
-- Example drop column (be careful!)
-- ALTER TABLE tasks DROP COLUMN IF EXISTS notes;

-- =============================
-- Constraints: Primary Key, Composite Key, Unique, Foreign Key syntax (demo tables)
-- =============================
DROP TABLE IF EXISTS demo_team_members;
DROP TABLE IF EXISTS demo_teams;

CREATE TABLE demo_teams (
  team_id INT AUTO_INCREMENT,
  team_name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_team_name (team_name),
  PRIMARY KEY (team_id)
);

CREATE TABLE demo_team_members (
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner','member') NOT NULL DEFAULT 'member',
  PRIMARY KEY (team_id, user_id),            -- Composite PK
  CONSTRAINT fk_demo_team FOREIGN KEY (team_id)
    REFERENCES demo_teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_demo_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Cleanup demo (optional)
-- DROP TABLE IF EXISTS demo_team_members;
-- DROP TABLE IF EXISTS demo_teams;

-- =============================
-- Transactions: COMMIT/ROLLBACK, LOCK/UNLOCK, row locking
-- =============================
-- Transaction demo (run together):
-- START TRANSACTION;
-- INSERT INTO tasks (title, assigned_to, assigned_by, priority, status)
-- VALUES ('Transaction Demo', 3, 2, 'low', 'pending');
-- ROLLBACK; -- or COMMIT;

-- Explicit table locks (use sparingly):
-- LOCK TABLES tasks WRITE;
-- UPDATE tasks SET priority='high' WHERE id = 1;
-- UNLOCK TABLES;

-- Row-level lock example (innoDB):
-- START TRANSACTION;
-- SELECT * FROM tasks WHERE id = 1 FOR UPDATE;
-- UPDATE tasks SET priority='urgent' WHERE id = 1;
-- COMMIT;

-- =============================
-- Triggers syntax: BEFORE INSERT, AFTER DELETE, drop trigger (demo tables)
-- =============================
DROP TABLE IF EXISTS demo_items;
DROP TABLE IF EXISTS demo_audit;
CREATE TABLE demo_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE demo_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  item_id INT,
  info VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DELIMITER $$
DROP TRIGGER IF EXISTS trg_demo_items_before_insert $$
CREATE TRIGGER trg_demo_items_before_insert
BEFORE INSERT ON demo_items
FOR EACH ROW
BEGIN
  -- Ensure a default prefix on name
  IF NEW.name IS NULL OR NEW.name = '' THEN
    SET NEW.name = CONCAT('item_', UNIX_TIMESTAMP());
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_demo_items_after_delete $$
CREATE TRIGGER trg_demo_items_after_delete
AFTER DELETE ON demo_items
FOR EACH ROW
BEGIN
  INSERT INTO demo_audit (action, item_id, info)
  VALUES ('deleted', OLD.id, CONCAT('Deleted item: ', OLD.name));
END $$
DELIMITER ;

-- Drop trigger syntax example
-- DROP TRIGGER IF EXISTS trg_demo_items_before_insert;
-- DROP TRIGGER IF EXISTS trg_demo_items_after_delete;

-- Cleanup demo (optional):
-- DROP TABLE IF EXISTS demo_audit;
-- DROP TABLE IF EXISTS demo_items;

-- =============================
-- Misc: INTEGER type (INT), WHERE clause string comparisons, comparison operators
-- =============================
-- Using comparison operators
SELECT id, title, estimated_hours
FROM tasks
WHERE estimated_hours IS NOT NULL
  AND (estimated_hours > 5 AND estimated_hours <= 20)
  AND id <> 0;

-- String WHERE clause
SELECT id, full_name
FROM users
WHERE role = 'employee' AND full_name >= 'J' AND full_name <= 'Zzzz';

-- End of file
