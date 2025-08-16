-- Utility and Reporting Queries for Employee Task Management System
-- Execute selectively in MySQL Workbench or CLI after loading database.sql and database-advanced.sql
USE task_management_db;

-- 1. List all active users
SELECT id, full_name, username, email, role FROM users WHERE status='active' ORDER BY full_name;

-- 2. List all inactive users
SELECT id, full_name, username, email FROM users WHERE status='inactive' ORDER BY full_name;

-- 3. Users created in the last 30 days
SELECT id, full_name, email, created_at FROM users WHERE created_at >= CURRENT_DATE - INTERVAL 30 DAY ORDER BY created_at DESC;

-- 4. Tasks due today (all)
SELECT * FROM tasks WHERE due_date = CURRENT_DATE ORDER BY priority DESC, updated_at DESC;

-- 5. Tasks overdue and not completed
SELECT * FROM tasks WHERE due_date < CURRENT_DATE AND status <> 'completed' ORDER BY due_date ASC;

-- 6. Tasks due in next 7 days (excluding completed)
SELECT * FROM tasks WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 7 DAY AND status <> 'completed' ORDER BY due_date ASC;

-- 7. Task summary view for all tasks
SELECT * FROM vw_task_summary ORDER BY urgency_status, priority DESC, updated_at DESC;

-- 8. Task summary for a given assignee
-- SET @user_id = 3;
SELECT * FROM vw_task_summary WHERE assigned_to_name IS NOT NULL AND assigned_to_name <> '' ORDER BY updated_at DESC;

-- 9. Count tasks by status
SELECT status, COUNT(*) AS count FROM tasks GROUP BY status;

-- 10. Count tasks by priority
SELECT priority, COUNT(*) AS count FROM tasks GROUP BY priority;

-- 11. Count tasks by assignee
SELECT assigned_to, COUNT(*) AS task_count FROM tasks GROUP BY assigned_to ORDER BY task_count DESC;

-- 12. Average actual hours per user
SELECT u.full_name, ROUND(AVG(t.actual_hours),2) AS avg_hours FROM users u JOIN tasks t ON t.assigned_to=u.id GROUP BY u.id ORDER BY avg_hours DESC;

-- 13. Average estimated vs actual hours per user
SELECT u.full_name,
       ROUND(AVG(t.estimated_hours),2) AS avg_estimated,
       ROUND(AVG(t.actual_hours),2) AS avg_actual
FROM users u JOIN tasks t ON t.assigned_to=u.id GROUP BY u.id;

-- 14. Completion rate per user
SELECT u.full_name,
       COUNT(t.id) AS total,
       SUM(t.status='completed') AS completed,
       ROUND(SUM(t.status='completed')*100/NULLIF(COUNT(t.id),0),2) AS completion_rate
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id GROUP BY u.id ORDER BY completion_rate DESC;

-- 15. Users with no tasks
SELECT u.id, u.full_name FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id WHERE t.id IS NULL AND u.status='active';

-- 16. Recently updated tasks (last 24h)
SELECT id, title, status, updated_at FROM tasks WHERE updated_at >= NOW() - INTERVAL 1 DAY ORDER BY updated_at DESC;

-- 17. Tasks created by user (set @creator)
-- SET @creator = 2;
SELECT * FROM tasks WHERE assigned_by = @creator ORDER BY created_at DESC;

-- 18. Tasks assigned to a user (set @assignee)
-- SET @assignee = 3;
SELECT * FROM tasks WHERE assigned_to = @assignee ORDER BY updated_at DESC;

-- 19. Notifications unread per user (set @uid)
-- SET @uid = 3;
SELECT COUNT(*) AS unread FROM notifications WHERE recipient_id=@uid AND is_read=FALSE;

-- 20. Last 20 notifications for a user
-- SET @uid = 3;
SELECT * FROM notifications WHERE recipient_id=@uid ORDER BY created_at DESC LIMIT 20;

-- 21. Top performers by completion rate (min 5 tasks)
SELECT u.full_name,
       COUNT(t.id) total,
       SUM(t.status='completed') completed,
       ROUND(SUM(t.status='completed')*100/NULLIF(COUNT(t.id),0),1) rate
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id
GROUP BY u.id HAVING total >= 5 ORDER BY rate DESC;

-- 22. Overdue tasks per user
SELECT u.full_name, COUNT(t.id) overdue
FROM users u JOIN tasks t ON t.assigned_to=u.id
WHERE t.due_date < CURRENT_DATE AND t.status <> 'completed'
GROUP BY u.id ORDER BY overdue DESC;

-- 23. Workload distribution by priority per user
SELECT u.full_name, t.priority, COUNT(*) cnt
FROM users u JOIN tasks t ON t.assigned_to=u.id
GROUP BY u.id, t.priority ORDER BY u.full_name, FIELD(t.priority,'urgent','high','medium','low');

-- 24. Tasks completed this week
SELECT * FROM tasks WHERE status='completed' AND YEARWEEK(completion_date, 1)=YEARWEEK(CURDATE(), 1) ORDER BY completion_date DESC;

-- 25. Average completion time (hours) per user
SELECT u.full_name,
       ROUND(AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.completion_date)),2) AS avg_completion_hours
FROM users u JOIN tasks t ON t.assigned_to=u.id
WHERE t.status='completed' AND t.completion_date IS NOT NULL
GROUP BY u.id ORDER BY avg_completion_hours;

-- 26. SLA: tasks overdue by priority
SELECT priority, COUNT(*) overdue
FROM tasks WHERE due_date < CURRENT_DATE AND status <> 'completed'
GROUP BY priority ORDER BY FIELD(priority,'urgent','high','medium','low');

-- 27. Tasks started but not completed beyond 14 days
SELECT * FROM tasks WHERE start_date <= CURRENT_DATE - INTERVAL 14 DAY AND status <> 'completed' ORDER BY start_date;

-- 28. Reassigned tasks (history where assignee changed)
SELECT th.* FROM task_history th WHERE th.action='assigned' ORDER BY th.created_at DESC;

-- 29. Status changes history
SELECT th.task_id, th.old_status, th.new_status, th.created_at FROM task_history th WHERE th.action='status_changed' ORDER BY th.created_at DESC;

-- 30. Tasks with large variance (actual > estimated by 50%)
SELECT id, title, estimated_hours, actual_hours
FROM tasks
WHERE actual_hours IS NOT NULL AND estimated_hours IS NOT NULL AND actual_hours > 1.5*estimated_hours
ORDER BY (actual_hours - estimated_hours) DESC;

-- 31. Users with high overdue ratio (>30%)
SELECT u.full_name,
       SUM(t.status <> 'completed' AND t.due_date < CURRENT_DATE) overdue,
       COUNT(t.id) total,
       ROUND(SUM(t.status <> 'completed' AND t.due_date < CURRENT_DATE)*100/NULLIF(COUNT(t.id),0),2) overdue_rate
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id
GROUP BY u.id HAVING overdue_rate > 30 ORDER BY overdue_rate DESC;

-- 32. Daily task creation counts (last 30 days)
SELECT DATE(created_at) d, COUNT(*) cnt FROM tasks WHERE created_at >= CURRENT_DATE - INTERVAL 30 DAY GROUP BY DATE(created_at) ORDER BY d;

-- 33. Daily task completion counts (last 30 days)
SELECT DATE(completion_date) d, COUNT(*) cnt FROM tasks WHERE completion_date >= CURRENT_DATE - INTERVAL 30 DAY GROUP BY DATE(completion_date) ORDER BY d;

-- 34. Tasks without due dates
SELECT * FROM tasks WHERE due_date IS NULL ORDER BY created_at DESC;

-- 35. Tasks without estimates
SELECT * FROM tasks WHERE estimated_hours IS NULL ORDER BY created_at DESC;

-- 36. Stale tasks (no updates in 10 days and not completed)
SELECT * FROM tasks WHERE updated_at < CURRENT_DATE - INTERVAL 10 DAY AND status <> 'completed' ORDER BY updated_at;

-- 37. Admin vs Manager vs Employee counts
SELECT role, COUNT(*) cnt FROM users GROUP BY role;

-- 38. Team capacity: tasks assigned per user in last 14 days
SELECT u.full_name, COUNT(t.id) cnt
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id AND t.created_at >= CURRENT_DATE - INTERVAL 14 DAY
GROUP BY u.id ORDER BY cnt DESC;

-- 39. Productivity: completed per user in last 14 days
SELECT u.full_name, COUNT(t.id) completed
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id AND t.status='completed' AND t.completion_date >= CURRENT_DATE - INTERVAL 14 DAY
GROUP BY u.id ORDER BY completed DESC;

-- 40. On-hold tasks by user
SELECT u.full_name, COUNT(t.id) cnt FROM users u JOIN tasks t ON t.assigned_to=u.id WHERE t.status='on_hold' GROUP BY u.id;

-- 41. In-progress aging: tasks in progress > 7 days
SELECT id, title, start_date FROM tasks WHERE status='in_progress' AND start_date <= CURRENT_DATE - INTERVAL 7 DAY ORDER BY start_date;

-- 42. Pending tasks created more than 7 days ago
SELECT id, title, created_at FROM tasks WHERE status='pending' AND created_at <= CURRENT_DATE - INTERVAL 7 DAY ORDER BY created_at;

-- 43. Upcoming deadlines (next 3 days)
SELECT id, title, due_date FROM tasks WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 3 DAY AND status <> 'completed' ORDER BY due_date;

-- 44. Tasks by creator with status breakdown
SELECT assigner.full_name AS created_by,
       SUM(t.status='pending') pending,
       SUM(t.status='in_progress') in_progress,
       SUM(t.status='completed') completed,
       SUM(t.status='on_hold') on_hold
FROM tasks t
LEFT JOIN users assigner ON t.assigned_by = assigner.id
GROUP BY assigner.id ORDER BY created_by;

-- 45. Most recently assigned tasks (last 10)
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;

-- 46. Notification volume per day (last 14 days)
SELECT DATE(created_at) d, COUNT(*) cnt FROM notifications WHERE created_at >= CURRENT_DATE - INTERVAL 14 DAY GROUP BY DATE(created_at) ORDER BY d;

-- 47. Unread high-priority notifications per user
SELECT u.full_name, COUNT(n.id) cnt
FROM users u JOIN notifications n ON n.recipient_id=u.id
WHERE n.is_read=FALSE AND n.priority='high'
GROUP BY u.id ORDER BY cnt DESC;

-- 48. Tasks that changed assignee (from history)
SELECT task_id, old_assigned_to, new_assigned_to, created_at FROM task_history WHERE old_assigned_to IS NOT NULL AND new_assigned_to IS NOT NULL ORDER BY created_at DESC;

-- 49. Tasks with missing assignee
SELECT * FROM tasks WHERE assigned_to IS NULL ORDER BY created_at DESC;

-- 50. Users who assigned the most tasks
SELECT assigner.full_name, COUNT(t.id) cnt
FROM tasks t LEFT JOIN users assigner ON t.assigned_by=assigner.id
GROUP BY assigner.id ORDER BY cnt DESC;

-- 51. User task stats view ordered by completion rate
SELECT * FROM (
  SELECT *,
         CASE WHEN total_tasks=0 THEN 0 ELSE ROUND(completed_tasks*100/total_tasks,2) END AS completion_rate
  FROM vw_user_task_stats
) s ORDER BY completion_rate DESC, total_tasks DESC;

-- 52. Tasks nearing deadline (within 24h)
SELECT id, title, due_date FROM tasks WHERE due_date = CURRENT_DATE + INTERVAL 1 DAY AND status <> 'completed' ORDER BY priority DESC;

-- 53. Time-to-start: tasks created but not started in 3 days
SELECT id, title, created_at FROM tasks WHERE start_date IS NULL AND created_at <= CURRENT_DATE - INTERVAL 3 DAY ORDER BY created_at;

-- 54. Long-running completed tasks (> 40 hours actual)
SELECT id, title, actual_hours FROM tasks WHERE status='completed' AND actual_hours > 40 ORDER BY actual_hours DESC;

-- 55. Task churn: tasks with >= 3 status changes
SELECT task_id, COUNT(*) changes
FROM task_history WHERE action='status_changed'
GROUP BY task_id HAVING changes >= 3 ORDER BY changes DESC;

-- 56. Duplicate titles (potential duplicates)
SELECT title, COUNT(*) cnt FROM tasks GROUP BY title HAVING cnt > 1 ORDER BY cnt DESC;

-- 57. Top 10 longest pending tasks by age
SELECT id, title, DATEDIFF(CURRENT_DATE, created_at) AS age_days FROM tasks WHERE status='pending' ORDER BY age_days DESC LIMIT 10;

-- 58. Recently read notifications
SELECT id, recipient_id, read_at FROM notifications WHERE is_read=TRUE ORDER BY read_at DESC LIMIT 20;

-- 59. Notifications by priority breakdown
SELECT priority, COUNT(*) cnt FROM notifications GROUP BY priority ORDER BY FIELD(priority,'high','medium','low');

-- 60. Orphan task_history rows (if any)
SELECT th.* FROM task_history th LEFT JOIN tasks t ON th.task_id=t.id WHERE t.id IS NULL;

-- 61. Users with no recent login (last_login null or older than 60 days)
SELECT id, full_name, last_login FROM users WHERE last_login IS NULL OR last_login <= CURRENT_DATE - INTERVAL 60 DAY;

-- 62. Users with many login attempts (>5)
SELECT id, full_name, login_attempts FROM users WHERE login_attempts > 5 ORDER BY login_attempts DESC;

-- 63. Task reassignment pairs (who assigns to whom most)
SELECT a.full_name AS assigner, b.full_name AS assignee, COUNT(*) cnt
FROM tasks t
LEFT JOIN users a ON t.assigned_by=a.id
LEFT JOIN users b ON t.assigned_to=b.id
GROUP BY a.id, b.id ORDER BY cnt DESC;

-- 64. Employee vs manager workload (avg tasks per active user by role)
SELECT role, ROUND(COUNT(t.id)/NULLIF(SUM(status='active'),0),2) AS avg_tasks
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id
GROUP BY role;

-- 65. Capacity planning: tasks per user by priority and due window
SELECT u.full_name,
       SUM(t.priority='urgent' AND t.due_date <= CURRENT_DATE + INTERVAL 3 DAY) urgent_3d,
       SUM(t.priority='high' AND t.due_date <= CURRENT_DATE + INTERVAL 7 DAY) high_7d,
       SUM(t.priority='medium' AND t.due_date <= CURRENT_DATE + INTERVAL 14 DAY) med_14d
FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id
GROUP BY u.id ORDER BY urgent_3d DESC, high_7d DESC;
