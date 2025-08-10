// Bitrix24-style Task Management System
class TaskFlowApp {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('authToken');
        this.API_BASE_URL = 'http://localhost:3002/api';
        this.currentView = 'list';
        this.tasks = [];
        this.users = [];
        this.filters = {
            status: 'all',
            assignee: 'all',
            search: ''
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Check if user is logged in
        if (this.authToken && localStorage.getItem('user')) {
            this.currentUser = JSON.parse(localStorage.getItem('user'));
            this.showDashboard();
            await this.loadInitialData();
        } else {
            this.showLoginForm();
        }
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginFormElement');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerFormElement');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Form switching
        const showRegisterLink = document.getElementById('showRegisterForm');
        const showLoginLink = document.getElementById('showLoginForm');
        
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterForm();
            });
        }
        
        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }

        // Task form
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        }

        // Modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || 
                e.target.dataset.dismiss === 'modal' ||
                e.target.classList.contains('btn-cancel')) {
                this.closeModal();
            }
        });

        // Search functionality
        const searchInput = document.getElementById('taskSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.filterAndDisplayTasks();
            });
        }

        // Global search
        const globalSearch = document.querySelector('.global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.filterAndDisplayTasks();
            });
        }

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const teamSidebar = document.getElementById('teamSidebar');
                if (teamSidebar) {
                    teamSidebar.classList.toggle('active');
                }
            });
        }

        // Team sidebar close
        const closeSidebar = document.querySelector('.close-sidebar');
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                const teamSidebar = document.getElementById('teamSidebar');
                if (teamSidebar) {
                    teamSidebar.classList.remove('active');
                }
            });
        }

        // Notification button
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.loadNotifications();
            });
        }

        // Upgrade button
        const upgradeBtn = document.querySelector('.upgrade-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                this.showNotification('Upgrade feature coming soon!', 'info');
            });
        }

        // Invite button
        const inviteBtn = document.querySelector('.invite-btn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => {
                this.showInviteModal();
            });
        }

        // Settings button
        const settingsBtn = document.querySelector('.settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettingsModal();
            });
        }

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.textContent.includes('List')) {
                    this.switchView('list');
                } else if (e.target.textContent.includes('Planner')) {
                    this.switchView('kanban');
                } else if (e.target.textContent.includes('Overdue')) {
                    this.filterBy('overdue');
                } else if (e.target.textContent.includes('Mark all as read')) {
                    this.markAllRead();
                }
            });
        });

        // Knowledge base button
        const knowledgeBtn = document.querySelector('.knowledge-base');
        if (knowledgeBtn) {
            knowledgeBtn.addEventListener('click', () => {
                this.showNotification('Knowledge base feature coming soon!', 'info');
            });
        }

        // Automation rules button
        const automationBtn = document.querySelector('.automation-rules');
        if (automationBtn) {
            automationBtn.addEventListener('click', () => {
                this.showNotification('Automation rules feature coming soon!', 'info');
            });
        }

        // Drag and drop for kanban
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('kanban-task')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('kanban-task')) {
                e.target.classList.remove('dragging');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const columnContent = e.target.closest('.column-content');
            if (columnContent) {
                const column = columnContent.closest('.kanban-column');
                const newStatus = column.dataset.status;
                const taskId = e.dataTransfer.getData('text/plain');
                
                if (taskId && newStatus) {
                    this.updateTaskStatus(taskId, newStatus);
                }
            }
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await this.apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            this.authToken = response.token;
            this.currentUser = response.user;
            
            localStorage.setItem('authToken', this.authToken);
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.showDashboard();
            await this.loadInitialData();
            this.showNotification('Welcome back!', 'success');
            
        } catch (error) {
            this.showError('loginError', error.message);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = {
            full_name: document.getElementById('registerFullName').value,
            email: document.getElementById('registerEmail').value,
            username: document.getElementById('registerUsername').value,
            password: document.getElementById('registerPassword').value,
            role: document.getElementById('registerRole').value
        };
        
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (formData.password !== confirmPassword) {
            this.showError('registerError', 'Passwords do not match');
            return;
        }
        
        try {
            const response = await this.apiCall('/register', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            this.authToken = response.token;
            this.currentUser = response.user;
            
            localStorage.setItem('authToken', this.authToken);
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.showDashboard();
            await this.loadInitialData();
            this.showNotification('Account created successfully!', 'success');
            
        } catch (error) {
            this.showError('registerError', error.message);
        }
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            assigned_to: document.getElementById('taskAssignedTo').value || null,
            due_date: document.getElementById('taskDueDate').value || null,
            status: document.getElementById('taskStatus').value || 'pending',
            priority: document.getElementById('taskPriority').value || 'medium'
        };
        
        const taskId = document.getElementById('taskForm').dataset.taskId;
        
        try {
            if (taskId) {
                await this.apiCall(`/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify(taskData)
                });
                this.showNotification('Task updated successfully!', 'success');
            } else {
                await this.apiCall('/tasks', {
                    method: 'POST',
                    body: JSON.stringify(taskData)
                });
                this.showNotification('Task created successfully!', 'success');
            }
            
            this.closeModal();
            await this.loadTasks();
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async apiCall(endpoint, options = {}) {
        const url = `${this.API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadTasks(),
                this.loadUsers(),
                this.updateUserInfo()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadTasks() {
        try {
            const response = await this.apiCall('/tasks');
            this.tasks = response.tasks || response || [];
            this.filterAndDisplayTasks();
            this.updateTaskCounters();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('Failed to load tasks', 'error');
        }
    }

    async loadUsers() {
        try {
            const response = await this.apiCall('/users');
            this.users = response.users || response || [];
            this.populateUserDropdowns();
            this.displayTeamAvatars();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            await this.apiCall(`/tasks/${taskId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            
            // Update local task data
            const task = this.tasks.find(t => t.id == taskId);
            if (task) {
                task.status = newStatus;
            }
            
            this.filterAndDisplayTasks();
            this.updateTaskCounters();
            this.showNotification('Task status updated!', 'success');
            
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showNotification('Failed to update task status', 'error');
        }
    }

    filterAndDisplayTasks() {
        let filteredTasks = [...this.tasks];
        
        // Apply search filter
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filteredTasks = filteredTasks.filter(task => 
                task.title.toLowerCase().includes(search) ||
                (task.description && task.description.toLowerCase().includes(search))
            );
        }
        
        // Apply status filter
        if (this.filters.status !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.status === this.filters.status);
        }
        
        // Apply assignee filter
        if (this.filters.assignee !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.assigned_to == this.filters.assignee);
        }
        
        // Display based on current view
        if (this.currentView === 'list') {
            this.displayTaskList(filteredTasks);
        } else if (this.currentView === 'kanban') {
            this.displayKanbanBoard(filteredTasks);
        }
    }

    displayTaskList(tasks) {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;
        
        taskList.innerHTML = '';
        
        if (tasks.length === 0) {
            taskList.innerHTML = '<div class="loading">No tasks found</div>';
            return;
        }
        
        tasks.forEach(task => {
            const taskElement = this.createTaskListItem(task);
            taskList.appendChild(taskElement);
        });
    }

    createTaskListItem(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        taskDiv.dataset.taskId = task.id;
        
        const assignedUser = this.users.find(u => u.id == task.assigned_to);
        const priorityClass = `priority-${task.priority || 'medium'}`;
        const statusClass = `status-${task.status || 'pending'}`;
        
        taskDiv.innerHTML = `
            <div class="task-content">
                <div class="task-header">
                    <h4 class="task-title">${task.title}</h4>
                    <div class="task-actions">
                        <span class="task-status ${statusClass}">${this.formatStatus(task.status)}</span>
                        <button class="edit-task" onclick="app.editTask(${task.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-task" onclick="app.deleteTask(${task.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="task-description">${task.description || 'No description'}</div>
                <div class="task-meta">
                    <div class="task-assignee">
                        ${assignedUser ? `
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(assignedUser.full_name)}&background=667eea&color=fff" 
                                 alt="${assignedUser.full_name}" class="assignee-avatar">
                            <span>${assignedUser.full_name}</span>
                        ` : '<span>Unassigned</span>'}
                    </div>
                    <div class="task-due-date ${this.getDueDateClass(task.due_date)}">
                        ${this.formatDate(task.due_date)}
                    </div>
                    <div class="task-priority ${priorityClass}">
                        <i class="fas fa-flag"></i> ${task.priority || 'medium'}
                    </div>
                </div>
            </div>
        `;
        
        return taskDiv;
    }

    displayKanbanBoard(tasks) {
        const columns = {
            'overdue': document.querySelector('[data-status="overdue"] .column-content'),
            'pending': document.querySelector('[data-status="pending"] .column-content'),
            'in_progress': document.querySelector('[data-status="in_progress"] .column-content'),
            'review': document.querySelector('[data-status="review"] .column-content'),
            'completed': document.querySelector('[data-status="completed"] .column-content')
        };
        
        // Clear all columns
        Object.values(columns).forEach(column => {
            if (column) column.innerHTML = '';
        });
        
        // Separate overdue tasks
        const now = new Date();
        tasks.forEach(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== 'completed';
            const status = isOverdue ? 'overdue' : task.status;
            
            const column = columns[status] || columns['pending'];
            if (column) {
                const taskCard = this.createKanbanCard(task);
                column.appendChild(taskCard);
            }
        });
        
        this.updateColumnCounts();
    }

    createKanbanCard(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'kanban-task';
        taskDiv.draggable = true;
        taskDiv.dataset.taskId = task.id;
        
        const assignedUser = this.users.find(u => u.id == task.assigned_to);
        const priorityClass = `priority-${task.priority || 'medium'}`;
        
        taskDiv.innerHTML = `
            <div class="task-priority-indicator ${priorityClass}"></div>
            <div class="task-title">${task.title}</div>
            <div class="task-description">${task.description || 'No description'}</div>
            <div class="task-meta">
                <div class="task-assignee">
                    ${assignedUser ? `
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(assignedUser.full_name)}&background=667eea&color=fff" 
                             alt="${assignedUser.full_name}" class="assignee-avatar">
                    ` : '<div class="assignee-avatar" style="background: #ccc;">?</div>'}
                </div>
                <div class="task-due-date ${this.getDueDateClass(task.due_date)}">
                    ${this.formatDate(task.due_date)}
                </div>
            </div>
        `;
        
        // Add click handler for editing
        taskDiv.addEventListener('click', () => this.editTask(task.id));
        
        return taskDiv;
    }

    updateColumnCounts() {
        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(column => {
            const tasks = column.querySelectorAll('.kanban-task');
            const countElement = column.querySelector('.task-count');
            if (countElement) {
                countElement.textContent = tasks.length;
            }
        });
    }

    updateTaskCounters() {
        const totalTasks = this.tasks.length;
        const inProgressTasks = this.tasks.filter(t => t.status === 'in_progress').length;
        const overdueTasks = this.tasks.filter(t => {
            return t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
        }).length;
        
        const taskCounter = document.getElementById('taskCounter');
        const inProgressCount = document.getElementById('inProgressCount');
        const overdueCount = document.getElementById('overdueCount');
        
        if (taskCounter) taskCounter.textContent = totalTasks;
        if (inProgressCount) inProgressCount.textContent = inProgressTasks;
        if (overdueCount) overdueCount.textContent = overdueTasks;
    }

    populateUserDropdowns() {
        const assignedToSelect = document.getElementById('taskAssignedTo');
        if (!assignedToSelect) return;
        
        assignedToSelect.innerHTML = '<option value="">Select user...</option>';
        
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.full_name} (${user.username})`;
            assignedToSelect.appendChild(option);
        });
    }

    displayTeamAvatars() {
        const teamAvatars = document.getElementById('teamAvatars');
        if (!teamAvatars) return;
        
        teamAvatars.innerHTML = '';
        
        this.users.slice(0, 8).forEach(user => {
            const avatar = document.createElement('img');
            avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=667eea&color=fff`;
            avatar.alt = user.full_name;
            avatar.className = 'team-avatar';
            avatar.title = user.full_name;
            avatar.addEventListener('click', () => this.showTeamSidebar());
            teamAvatars.appendChild(avatar);
        });
        
        // Also populate team sidebar
        this.populateTeamSidebar();
    }

    populateTeamSidebar() {
        const teamList = document.getElementById('teamList');
        if (!teamList) return;
        
        teamList.innerHTML = '';
        
        this.users.forEach(user => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            memberDiv.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=667eea&color=fff" 
                     alt="${user.full_name}" class="team-member-avatar">
                <div class="team-member-info">
                    <div class="team-member-name">${user.full_name}</div>
                    <div class="team-member-role">${user.role}</div>
                </div>
                <div class="team-member-status"></div>
            `;
            
            // Add click handler to filter tasks by this user
            memberDiv.addEventListener('click', () => {
                this.filters.assignee = user.id;
                this.filterAndDisplayTasks();
                this.showNotification(`Filtering tasks for ${user.full_name}`, 'info');
                
                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    document.getElementById('teamSidebar').classList.remove('active');
                }
            });
            
            teamList.appendChild(memberDiv);
        });
        
        // Add "Show All" option
        const showAllDiv = document.createElement('div');
        showAllDiv.className = 'team-member';
        showAllDiv.innerHTML = `
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--light-gray); display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-users" style="color: var(--text-secondary);"></i>
            </div>
            <div class="team-member-info">
                <div class="team-member-name">All Team Members</div>
                <div class="team-member-role">Show all tasks</div>
            </div>
        `;
        
        showAllDiv.addEventListener('click', () => {
            this.filters.assignee = 'all';
            this.filterAndDisplayTasks();
            this.showNotification('Showing all tasks', 'info');
            
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                document.getElementById('teamSidebar').classList.remove('active');
            }
        });
        
        teamList.appendChild(showAllDiv);
    }

    showTeamSidebar() {
        const teamSidebar = document.getElementById('teamSidebar');
        if (teamSidebar) {
            teamSidebar.classList.add('active');
        }
    }

    updateUserInfo() {
        const userNameElements = document.querySelectorAll('#userName');
        userNameElements.forEach(element => {
            if (this.currentUser) {
                element.textContent = this.currentUser.full_name;
            }
        });
    }

    async editTask(taskId) {
        try {
            const task = await this.apiCall(`/tasks/${taskId}`);
            
            // Populate form
            document.getElementById('taskTitle').value = task.title || '';
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskAssignedTo').value = task.assigned_to || '';
            document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';
            document.getElementById('taskStatus').value = task.status || 'pending';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            
            // Set modal title and task ID
            document.getElementById('taskModalTitle').textContent = 'Edit Task';
            document.getElementById('taskForm').dataset.taskId = taskId;
            
            this.showModal('taskModal');
            
        } catch (error) {
            console.error('Error loading task:', error);
            this.showNotification('Failed to load task details', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            await this.apiCall(`/tasks/${taskId}`, { method: 'DELETE' });
            this.showNotification('Task deleted successfully!', 'success');
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showNotification('Failed to delete task', 'error');
        }
    }

    // UI Helper Methods
    showLoginForm() {
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('dashboard').style.display = 'none';
        this.clearErrors();
    }

    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
        this.clearErrors();
    }

    showDashboard() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        this.showMainView('tasks');
    }

    showMainView(viewName) {
        // Hide all views
        document.querySelectorAll('.main-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const view = document.getElementById(`${viewName}View`);
        if (view) {
            view.classList.add('active');
        }
        
        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[onclick="showMainView('${viewName}')"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }

    switchView(viewType) {
        this.currentView = viewType;
        
        // Update filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[onclick="switchView('${viewType}')"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Show/hide content views
        document.querySelectorAll('.content-view').forEach(view => {
            view.classList.remove('active');
        });
        
        const contentView = document.getElementById(`${viewType}View`);
        if (contentView) {
            contentView.classList.add('active');
        }
        
        this.filterAndDisplayTasks();
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
        
        // Reset forms
        document.querySelectorAll('.modal form').forEach(form => {
            form.reset();
            delete form.dataset.taskId;
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; margin-left: 10px; cursor: pointer;">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearErrors() {
        document.querySelectorAll('.error-message').forEach(error => {
            error.style.display = 'none';
        });
    }

    // Utility Methods
    formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'in_progress': 'In Progress',
            'review': 'Under Review',
            'completed': 'Completed',
            'on_hold': 'On Hold'
        };
        return statusMap[status] || 'Pending';
    }

    formatDate(dateString) {
        if (!dateString) return 'No due date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }

    getDueDateClass(dueDate) {
        if (!dueDate) return '';
        
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'overdue';
        if (diffDays === 0) return 'due-today';
        return '';
    }

    // Additional functionality methods
    async loadNotifications() {
        try {
            const response = await this.apiCall('/notifications');
            this.displayNotifications(response);
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showNotification('No new notifications', 'info');
        }
    }

    displayNotifications(notifications) {
        // Create a notification dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'notification-dropdown';
        dropdown.innerHTML = `
            <div class="notification-header">
                <h4>Notifications</h4>
                <button class="close-dropdown">&times;</button>
            </div>
            <div class="notification-list">
                ${notifications.length > 0 ? 
                    notifications.map(n => `
                        <div class="notification-item">
                            <div class="notification-content">
                                <strong>${n.title || 'Notification'}</strong>
                                <p>${n.message || n.description}</p>
                                <small>${this.formatDate(n.created_at || n.date)}</small>
                            </div>
                        </div>
                    `).join('') : 
                    '<div class="no-notifications">No new notifications</div>'
                }
            </div>
        `;
        
        // Remove existing dropdown
        const existing = document.querySelector('.notification-dropdown');
        if (existing) existing.remove();
        
        // Add to page
        document.body.appendChild(dropdown);
        
        // Position near notification button
        const notificationBtn = document.getElementById('notificationBtn');
        const rect = notificationBtn.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = (rect.bottom + 10) + 'px';
        dropdown.style.right = '20px';
        dropdown.style.zIndex = '1000';
        dropdown.style.background = 'white';
        dropdown.style.borderRadius = '8px';
        dropdown.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        dropdown.style.width = '300px';
        dropdown.style.maxHeight = '400px';
        dropdown.style.overflow = 'auto';
        
        // Close dropdown functionality
        dropdown.querySelector('.close-dropdown').addEventListener('click', () => {
            dropdown.remove();
        });
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            if (dropdown.parentElement) dropdown.remove();
        }, 10000);
    }

    showInviteModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Invite Team Members</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div class="form-group">
                        <label for="inviteEmail">Email Address</label>
                        <input type="email" id="inviteEmail" placeholder="Enter email address" required>
                    </div>
                    <div class="form-group">
                        <label for="inviteRole">Role</label>
                        <select id="inviteRole">
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="inviteMessage">Personal Message (Optional)</label>
                        <textarea id="inviteMessage" rows="3" placeholder="Add a personal message..."></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-cancel">Cancel</button>
                        <button type="button" class="btn-save" onclick="app.sendInvitation()">Send Invitation</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal functionality
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            modal.remove();
        });
    }

    async sendInvitation() {
        const email = document.getElementById('inviteEmail').value;
        const role = document.getElementById('inviteRole').value;
        const message = document.getElementById('inviteMessage').value;
        
        if (!email) {
            this.showNotification('Please enter an email address', 'error');
            return;
        }
        
        try {
            // For now, just create a user account
            const userData = {
                full_name: email.split('@')[0],
                email: email,
                username: email,
                password: 'TempPassword123!', // They should change this
                role: role
            };
            
            await this.apiCall('/users', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            
            this.showNotification(`Invitation sent to ${email}!`, 'success');
            document.querySelector('.modal.show').remove();
            await this.loadUsers(); // Refresh user list
            
        } catch (error) {
            console.error('Error sending invitation:', error);
            this.showNotification('Failed to send invitation: ' + error.message, 'error');
        }
    }

    showSettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Settings</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div class="settings-section">
                        <h4>Profile Settings</h4>
                        <div class="form-group">
                            <label for="settingsFullName">Full Name</label>
                            <input type="text" id="settingsFullName" value="${this.currentUser?.full_name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="settingsEmail">Email</label>
                            <input type="email" id="settingsEmail" value="${this.currentUser?.email || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="settingsPassword">New Password (leave blank to keep current)</label>
                            <input type="password" id="settingsPassword" placeholder="Enter new password">
                        </div>
                    </div>
                    
                    <div class="settings-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                        <h4>Preferences</h4>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="emailNotifications" checked> 
                                Email Notifications
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="taskReminders" checked> 
                                Task Deadline Reminders
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="defaultView">Default View</label>
                            <select id="defaultView">
                                <option value="list">List View</option>
                                <option value="kanban">Kanban Board</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="modal-actions" style="margin-top: 30px;">
                        <button type="button" class="btn-cancel">Cancel</button>
                        <button type="button" class="btn-save" onclick="app.saveSettings()">Save Settings</button>
                        <button type="button" style="background: #e74c3c; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin-left: 10px;" onclick="app.logout()">Logout</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal functionality
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            modal.remove();
        });
    }

    async saveSettings() {
        const fullName = document.getElementById('settingsFullName').value;
        const email = document.getElementById('settingsEmail').value;
        const password = document.getElementById('settingsPassword').value;
        
        if (!fullName || !email) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const updateData = {
                full_name: fullName,
                email: email
            };
            
            if (password) {
                updateData.password = password;
            }
            
            await this.apiCall('/profile', {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            // Update current user data
            this.currentUser.full_name = fullName;
            this.currentUser.email = email;
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.updateUserInfo();
            this.showNotification('Settings saved successfully!', 'success');
            document.querySelector('.modal.show').remove();
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Failed to save settings: ' + error.message, 'error');
        }
    }

    logout() {
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Close any open modals
        document.querySelectorAll('.modal').forEach(modal => modal.remove());
        
        this.showLoginForm();
        this.showNotification('Logged out successfully', 'success');
    }

    markAllRead() {
        this.showNotification('All tasks marked as read', 'success');
    }

    filterBy(filterType) {
        if (filterType === 'overdue') {
            // Show only overdue tasks
            const overdueTasks = this.tasks.filter(task => {
                return task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            });
            
            if (this.currentView === 'list') {
                this.displayTaskList(overdueTasks);
            } else {
                this.displayKanbanBoard(overdueTasks);
            }
            
            this.showNotification(`Found ${overdueTasks.length} overdue tasks`, 'info');
        }
    }

    async loadAnalytics() {
        try {
            const response = await this.apiCall('/analytics');
            this.displayAnalytics(response.analytics);
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showNotification('Analytics feature coming soon!', 'info');
        }
    }

    displayAnalytics(analytics) {
        // This would show analytics in a modal or dedicated view
        this.showNotification('Analytics dashboard coming soon!', 'info');
    }
}

// Global functions for onclick handlers
function showMainView(viewName) {
    app.showMainView(viewName);
}

function switchView(viewType) {
    app.switchView(viewType);
}

function openNewTaskModal() {
    document.getElementById('taskModalTitle').textContent = 'Add New Task';
    document.getElementById('taskForm').reset();
    delete document.getElementById('taskForm').dataset.taskId;
    app.showModal('taskModal');
}

function filterBy(filterType) {
    if (filterType === 'overdue') {
        app.filters.status = 'all';
        // Filter will be applied in filterAndDisplayTasks based on due date
    }
    app.filterAndDisplayTasks();
}

function markAllRead() {
    app.showNotification('All tasks marked as read', 'success');
}

// Initialize the app
const app = new TaskFlowApp();
