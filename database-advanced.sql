-- Advanced SQL Features for Employee Task Management System
-- Execute this file manually in MySQL Workbench or MySQL CLI
-- This file contains triggers, stored procedures, and events

USE task_management_db;

-- =====================================================
-- STORED PROCEDURES WITH TRANSACTIONS
-- =====================================================

-- Drop existing procedures if they exist
DROP PROCEDURE IF EXISTS sp_create_user;
DROP PROCEDURE IF EXISTS sp_assign_task;
DROP PROCEDURE IF EXISTS sp_update_task_status;
DROP PROCEDURE IF EXISTS sp_get_user_dashboard;

-- Procedure: Create user with transaction
DELIMITER $$
CREATE PROCEDURE sp_create_user(
    IN p_full_name VARCHAR(100),
    IN p_email VARCHAR(100),
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(255),
    IN p_role ENUM('admin', 'manager', 'employee')
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already exists';
    END IF;
    
    -- Check if username already exists
    IF EXISTS (SELECT 1 FROM users WHERE username = p_username) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists';
    END IF;
    
    -- Insert new user
    INSERT INTO users (full_name, email, username, password, role)
    VALUES (p_full_name, p_email, p_username, p_password, p_role);
    
    COMMIT;
    
    SELECT LAST_INSERT_ID() as user_id, 'User created successfully' as message;
END$$

-- Procedure: Assign task with transaction
CREATE PROCEDURE sp_assign_task(
    IN p_title VARCHAR(200),
    IN p_description TEXT,
    IN p_assigned_to INT,
    IN p_assigned_by INT,
    IN p_priority ENUM('low', 'medium', 'high', 'urgent'),
    IN p_due_date DATE,
    IN p_estimated_hours DECIMAL(5,2)
)
BEGIN
    DECLARE task_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Validate assigned_to user exists and is active
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_assigned_to AND status = 'active') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assigned user does not exist or is inactive';
    END IF;
    
    -- Validate assigned_by user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_assigned_by) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assigning user does not exist';
    END IF;
    
    -- Insert task
    INSERT INTO tasks (
        title, description, assigned_to, assigned_by, 
        priority, due_date, estimated_hours, start_date
    ) VALUES (
        p_title, p_description, p_assigned_to, p_assigned_by,
        p_priority, p_due_date, p_estimated_hours, CURRENT_DATE
    );
    
    SET task_id = LAST_INSERT_ID();
    
    COMMIT;
    
    SELECT task_id, 'Task assigned successfully' as message;
END$$

-- Procedure: Update task status with validation
CREATE PROCEDURE sp_update_task_status(
    IN p_task_id INT,
    IN p_user_id INT,
    IN p_new_status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold'),
    IN p_actual_hours DECIMAL(5,2)
)
BEGIN
    DECLARE old_status VARCHAR(20);
    DECLARE assigned_to_id INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get current task details
    SELECT status, assigned_to INTO old_status, assigned_to_id
    FROM tasks WHERE id = p_task_id;
    
    IF old_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Task not found';
    END IF;
    
    -- Check if user has permission to update this task
    IF assigned_to_id != p_user_id AND 
       NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND role IN ('admin', 'manager')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient permissions to update this task';
    END IF;
    
    -- Update task
    UPDATE tasks 
    SET status = p_new_status,
        actual_hours = COALESCE(p_actual_hours, actual_hours)
    WHERE id = p_task_id;
    
    COMMIT;
    
    SELECT 'Task status updated successfully' as message;
END$$

-- Procedure: Get user dashboard data
CREATE PROCEDURE sp_get_user_dashboard(
    IN p_user_id INT
)
BEGIN
    DECLARE user_role VARCHAR(20);
    
    -- Get user role
    SELECT role INTO user_role FROM users WHERE id = p_user_id;
    
    IF user_role IN ('admin', 'manager') THEN
        -- Admin/Manager dashboard
        SELECT 
            'admin_stats' as data_type,
            (SELECT COUNT(*) FROM users WHERE role = 'employee' AND status = 'active') as active_employees,
            (SELECT COUNT(*) FROM tasks) as total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'pending') as pending_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as in_progress_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
            (SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed') as overdue_tasks,
            (SELECT COUNT(*) FROM tasks WHERE due_date = CURRENT_DATE AND status != 'completed') as due_today;
    ELSE
        -- Employee dashboard
        SELECT 
            'employee_stats' as data_type,
            (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_user_id) as my_total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_user_id AND status = 'pending') as my_pending_tasks,
            (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_user_id AND status = 'in_progress') as my_in_progress_tasks,
            (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_user_id AND status = 'completed') as my_completed_tasks,
            (SELECT COUNT(*) FROM tasks WHERE assigned_to = p_user_id AND due_date < CURRENT_DATE AND status != 'completed') as my_overdue_tasks,
            (SELECT COUNT(*) FROM notifications WHERE recipient_id = p_user_id AND is_read = FALSE) as unread_notifications;
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_task_completion;
DROP TRIGGER IF EXISTS tr_task_history_insert;
DROP TRIGGER IF EXISTS tr_task_history_update;
DROP TRIGGER IF EXISTS tr_task_assignment_notification;
DROP TRIGGER IF EXISTS tr_task_status_notification;
DROP TRIGGER IF EXISTS tr_notification_read_update;

-- Trigger: Update completion_date when task status changes to completed
DELIMITER $$
CREATE TRIGGER tr_task_completion 
    BEFORE UPDATE ON tasks
    FOR EACH ROW
BEGIN
    -- Set completion date when status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SET NEW.completion_date = CURRENT_TIMESTAMP;
        SET NEW.progress_percentage = 100;
    END IF;
    
    -- Clear completion date if status changes from completed to something else
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        SET NEW.completion_date = NULL;
    END IF;
    
    -- Auto-update progress based on status
    IF NEW.status = 'pending' AND NEW.progress_percentage = 0 THEN
        SET NEW.progress_percentage = 0;
    ELSEIF NEW.status = 'in_progress' AND NEW.progress_percentage = 0 THEN
        SET NEW.progress_percentage = 25;
    ELSEIF NEW.status = 'completed' THEN
        SET NEW.progress_percentage = 100;
    END IF;
END$$

-- Trigger: Log task creation to history table
CREATE TRIGGER tr_task_history_insert
    AFTER INSERT ON tasks
    FOR EACH ROW
BEGIN
    INSERT INTO task_history (
        task_id, action, new_status, new_assigned_to, description
    ) VALUES (
        NEW.id, 'created', NEW.status, NEW.assigned_to, 
        CONCAT('Task "', NEW.title, '" created')
    );
END$$

-- Trigger: Log task updates to history table
CREATE TRIGGER tr_task_history_update
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    DECLARE action_type VARCHAR(20) DEFAULT 'updated';
    DECLARE description_text TEXT;
    
    -- Determine the type of update
    IF OLD.status != NEW.status THEN
        SET action_type = 'status_changed';
        SET description_text = CONCAT('Status changed from "', OLD.status, '" to "', NEW.status, '"');
    ELSEIF OLD.assigned_to != NEW.assigned_to THEN
        SET action_type = 'assigned';
        SET description_text = 'Task reassigned';
    ELSE
        SET description_text = 'Task details updated';
    END IF;
    
    INSERT INTO task_history (
        task_id, action, old_status, new_status, 
        old_assigned_to, new_assigned_to, description
    ) VALUES (
        NEW.id, action_type, OLD.status, NEW.status,
        OLD.assigned_to, NEW.assigned_to, description_text
    );
END$$

-- Trigger: Create notification when task is assigned
CREATE TRIGGER tr_task_assignment_notification
    AFTER INSERT ON tasks
    FOR EACH ROW
BEGIN
    IF NEW.assigned_to IS NOT NULL THEN
        INSERT INTO notifications (
            recipient_id, sender_id, task_id, type, title, message, priority
        ) VALUES (
            NEW.assigned_to, 
            NEW.assigned_by,
            NEW.id,
            'task_assigned',
            'New Task Assigned',
            CONCAT('You have been assigned a new task: "', NEW.title, '"'),
            CASE 
                WHEN NEW.priority = 'urgent' THEN 'high'
                WHEN NEW.priority = 'high' THEN 'high'
                WHEN NEW.priority = 'medium' THEN 'medium'
                ELSE 'low'
            END
        );
    END IF;
END$$

-- Trigger: Create notification when task status changes
CREATE TRIGGER tr_task_status_notification
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        -- Notify the assignee
        IF NEW.assigned_to IS NOT NULL THEN
            INSERT INTO notifications (
                recipient_id, task_id, type, title, message, priority
            ) VALUES (
                NEW.assigned_to,
                NEW.id,
                'status_update',
                'Task Status Updated',
                CONCAT('Task "', NEW.title, '" status changed to "', NEW.status, '"'),
                'medium'
            );
        END IF;
        
        -- Notify the assigner if task is completed
        IF NEW.status = 'completed' AND NEW.assigned_by IS NOT NULL AND NEW.assigned_by != NEW.assigned_to THEN
            INSERT INTO notifications (
                recipient_id, sender_id, task_id, type, title, message, priority
            ) VALUES (
                NEW.assigned_by,
                NEW.assigned_to,
                NEW.id,
                'task_completed',
                'Task Completed',
                CONCAT('Task "', NEW.title, '" has been completed'),
                'high'
            );
        END IF;
    END IF;
END$$

-- Trigger: Mark notification as read when read_at is set
CREATE TRIGGER tr_notification_read_update
    BEFORE UPDATE ON notifications
    FOR EACH ROW
BEGIN
    IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
        SET NEW.is_read = TRUE;
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- EVENTS FOR AUTOMATED TASKS
-- =====================================================

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Drop existing event if it exists
DROP EVENT IF EXISTS ev_daily_overdue_notifications;

-- Event: Daily notification for overdue tasks
DELIMITER $$
CREATE EVENT ev_daily_overdue_notifications
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    INSERT INTO notifications (recipient_id, type, title, message, priority)
    SELECT 
        t.assigned_to,
        'task_overdue',
        'Overdue Task Reminder',
        CONCAT('Task "', t.title, '" is overdue. Due date: ', t.due_date),
        'high'
    FROM tasks t
    WHERE t.due_date < CURRENT_DATE 
    AND t.status NOT IN ('completed', 'cancelled')
    AND t.assigned_to IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.task_id = t.id 
        AND n.type = 'task_overdue' 
        AND DATE(n.created_at) = CURRENT_DATE
    );
END$$
DELIMITER ;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

SELECT 'Advanced SQL features installed successfully!' as message,
       'Triggers, stored procedures, and events are now active' as note,
       'Your database now has automated workflows' as status;
