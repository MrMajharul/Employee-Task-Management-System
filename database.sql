CREATE DATABASE IF NOT EXISTS task_management_db;
USE task_management_db;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS task_history;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
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
);

CREATE TABLE projects (
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
);

CREATE TABLE tasks (
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
    
    CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CHECK (estimated_hours >= 0),
    CHECK (actual_hours >= 0)
);

CREATE TABLE task_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT,
    action ENUM('created', 'updated', 'assigned', 'status_changed', 'completed', 'deleted') NOT NULL,
    old_status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold'),
    new_status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold'),
    old_assigned_to INT,
    new_assigned_to INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (old_assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (new_assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

CREATE TABLE notifications (
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
);

CREATE TABLE project_members (
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
);

INSERT INTO users (full_name, email, username, password, role) VALUES
('System Administrator', 'admin@taskmanagement.com', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Project Manager', 'manager@taskmanagement.com', 'manager', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager'),
('John Employee', 'john@taskmanagement.com', 'john', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee'),
('Jane Smith', 'jane@taskmanagement.com', 'jane', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee'),
('Mike Johnson', 'mike@taskmanagement.com', 'mike', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee');

INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, due_date, estimated_hours, start_date) VALUES
('Setup Development Environment', 'Install and configure all necessary development tools and dependencies', 3, 2, 'high', '2025-08-15', 8.0, CURRENT_DATE),
('Design Database Schema', 'Create comprehensive database design with proper relationships', 4, 2, 'medium', '2025-08-20', 12.0, CURRENT_DATE),
('Implement User Authentication', 'Develop secure login and registration system', 3, 2, 'high', '2025-08-25', 16.0, CURRENT_DATE),
('Create Task Management UI', 'Design and implement user interface for task management', 5, 2, 'medium', '2025-08-30', 20.0, CURRENT_DATE),
('Write Documentation', 'Create comprehensive project documentation', 4, 2, 'low', '2025-09-05', 6.0, CURRENT_DATE);

INSERT INTO projects (name, description, created_by, status, priority, start_date, due_date, color) VALUES
('Employee Task Management System', 'Complete web-based task management solution for teams', 2, 'active', 'high', '2025-08-01', '2025-09-30', '#3B82F6'),
('Website Redesign', 'Modernize company website with responsive design', 2, 'planning', 'medium', '2025-09-01', '2025-11-15', '#10B981'),
('Mobile App Development', 'Native mobile application for task management', 2, 'planning', 'high', '2025-10-01', '2026-01-31', '#F59E0B');

INSERT INTO project_members (project_id, user_id, role) VALUES
(1, 2, 'owner'),
(1, 3, 'member'),
(1, 4, 'member'),
(1, 5, 'member'),
(2, 2, 'owner'),
(2, 4, 'member'),
(3, 2, 'owner'),
(3, 3, 'member');

INSERT INTO task_history (task_id, action, new_status, new_assigned_to, description) VALUES
(1, 'created', 'pending', 3, 'Task "Setup Development Environment" created'),
(2, 'created', 'pending', 4, 'Task "Design Database Schema" created'),
(3, 'created', 'pending', 3, 'Task "Implement User Authentication" created'),
(4, 'created', 'pending', 5, 'Task "Create Task Management UI" created'),
(5, 'created', 'pending', 4, 'Task "Write Documentation" created');

INSERT INTO notifications (recipient_id, sender_id, task_id, type, title, message, priority) VALUES
(3, 2, 1, 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: "Setup Development Environment"', 'high'),
(4, 2, 2, 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: "Design Database Schema"', 'medium'),
(3, 2, 3, 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: "Implement User Authentication"', 'high'),
(5, 2, 4, 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: "Create Task Management UI"', 'medium'),
(4, 2, 5, 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: "Write Documentation"', 'low');

CREATE VIEW vw_task_summary AS
SELECT 
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.progress_percentage,
    t.estimated_hours,
    t.actual_hours,
    assigned_user.full_name as assigned_to_name,
    assigned_user.email as assigned_to_email,
    assigner.full_name as assigned_by_name,
    t.created_at,
    t.updated_at,
    CASE 
        WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 'overdue'
        WHEN t.due_date = CURRENT_DATE AND t.status != 'completed' THEN 'due_today'
        ELSE 'normal'
    END as urgency_status
FROM tasks t
LEFT JOIN users assigned_user ON t.assigned_to = assigned_user.id
LEFT JOIN users assigner ON t.assigned_by = assigner.id;

CREATE VIEW vw_user_task_stats AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.email,
    u.role,
    COUNT(t.id) as total_tasks,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks,
    AVG(t.actual_hours) as avg_completion_hours
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
WHERE u.status = 'active'
GROUP BY u.id, u.full_name, u.email, u.role;

CREATE INDEX idx_tasks_status_assigned ON tasks(status, assigned_to);
CREATE INDEX idx_tasks_due_date_status ON tasks(due_date, status);
CREATE INDEX idx_notifications_recipient_read ON notifications(recipient_id, is_read);
CREATE INDEX idx_task_history_task_created ON task_history(task_id, created_at);
