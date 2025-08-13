// Global variables
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Google Sign-In Configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your actual Google Client ID

// API Base URL
const API_BASE_URL = 'http://localhost:3002/api';
// Utility functions
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getStatusBadge(status) {
    const statusMap = {
        'pending': '<span class="status-badge status-pending">Pending</span>',
        'in_progress': '<span class="status-badge status-in_progress">In Progress</span>',
        'completed': '<span class="status-badge status-completed">Completed</span>',
        'cancelled': '<span class="status-badge status-cancelled">Cancelled</span>',
        'on_hold': '<span class="status-badge status-on_hold">On Hold</span>'
    };
    return statusMap[status] || statusMap['pending'];
}

// API functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
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

// Google Sign-In Handler
async function handleGoogleSignIn(response) {
    if (response.credential) {
        try {
            // Decode the JWT token from Google
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            
            // Create user object from Google data
            const googleUser = {
                username: payload.email,
                full_name: payload.name,
                email: payload.email,
                role: 'employee', // Default role for Google users
                picture: payload.picture
            };
            
            // Try to create or get user from database
            try {
                const userData = await apiCall('/google-login', {
                    method: 'POST',
                    body: JSON.stringify(googleUser)
                });
                
                currentUser = userData.user;
                authToken = userData.token;
                
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('user', JSON.stringify(currentUser));
                
                showDashboard();
                loadDashboardData();
                setupEventListeners();
                
                showAlert('Successfully signed in with Google!', 'success');
            } catch (error) {
                // If backend doesn't support Google login yet, use client-side only
                const fallbackUser = {
                    id: payload.sub,
                    username: payload.email,
                    full_name: payload.name,
                    email: payload.email,
                    role: 'employee',
                    picture: payload.picture
                };
                
                currentUser = fallbackUser;
                authToken = response.credential;
                
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('user', JSON.stringify(fallbackUser));
                
                showDashboard();
                loadDashboardData();
                setupEventListeners();
                
                showAlert('Successfully signed in with Google! (Demo mode)', 'success');
            }
        } catch (error) {
            showAlert('Google sign-in failed. Please try again.', 'danger');
            console.error('Google Sign-In Error:', error);
        }
    }
}

// Authentication functions
async function login(username, password) {
    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        showDashboard();
        loadDashboardData();
        setupEventListeners();
        
        return data;
    } catch (error) {
        throw error;
    }
}

async function register(full_name, email, username, password, role) {
    try {
        const data = await apiCall('/register', {
            method: 'POST',
            body: JSON.stringify({ full_name, email, username, password, role })
        });
        
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        showDashboard();
        loadDashboardData();
        setupEventListeners();
        
        return data;
    } catch (error) {
        throw error;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    showLoginForm();
}

// UI functions
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'flex';
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    
    // Clear form errors
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const registerSuccess = document.getElementById('registerSuccess');
    
    if (loginError) loginError.style.display = 'none';
    if (registerError) registerError.style.display = 'none';
    if (registerSuccess) registerSuccess.style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    
    // Clear form errors
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const registerSuccess = document.getElementById('registerSuccess');
    
    if (loginError) loginError.style.display = 'none';
    if (registerError) registerError.style.display = 'none';
    if (registerSuccess) registerSuccess.style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginForm').style.display = 'none';
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    
    // Update user info
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.full_name;
        
        // Show/hide admin features
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(element => {
            element.style.display = currentUser.role === 'admin' ? 'block' : 'none';
        });
    }
}

// Dashboard functions
async function loadDashboardData() {
    try {
        const data = await apiCall('/dashboard');
        updateDashboardStats(data);
    } catch (error) {
        showAlert('Failed to load dashboard data', 'danger');
    }
}

function updateDashboardStats(data) {
    // Update stats based on user role
    if (currentUser.role === 'admin') {
        document.getElementById('usersCount').textContent = data.users || 0;
        document.getElementById('tasksCount').textContent = data.tasks || 0;
        document.getElementById('overdueCount').textContent = data.overdue || 0;
        document.getElementById('noDeadlineCount').textContent = data.noDeadline || 0;
        document.getElementById('dueTodayCount').textContent = data.dueToday || 0;
        document.getElementById('pendingCount').textContent = data.pending || 0;
        document.getElementById('inProgressCount').textContent = data.inProgress || 0;
        document.getElementById('completedCount').textContent = data.completed || 0;
    } else {
        // Hide admin-specific stats
        document.getElementById('usersCount').parentElement.parentElement.style.display = 'none';
        document.getElementById('tasksCount').parentElement.parentElement.style.display = 'none';
        document.getElementById('dueTodayCount').parentElement.parentElement.style.display = 'none';
        
        // Update employee stats
        document.getElementById('overdueCount').textContent = data.overdue || 0;
        document.getElementById('noDeadlineCount').textContent = data.noDeadline || 0;
        document.getElementById('pendingCount').textContent = data.pending || 0;
        document.getElementById('inProgressCount').textContent = data.inProgress || 0;
        document.getElementById('completedCount').textContent = data.completed || 0;
    }
}

// Tasks functions
async function loadTasks() {
    try {
        const tasks = await apiCall('/tasks');
        displayTasks(tasks);
    } catch (error) {
        showAlert('Failed to load tasks', 'danger');
    }
}

function displayTasks(tasks) {
    const tbody = document.getElementById('tasksTableBody');
    tbody.innerHTML = '';
    
    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.title}</td>
            <td>${task.description || '-'}</td>
            <td>${task.assigned_to_name || 'Unassigned'}</td>
            <td>${getStatusBadge(task.status)}</td>
            <td>${formatDate(task.due_date)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit" onclick="editTask(${task.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteTask(${task.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function addTask(taskData) {
    try {
        await apiCall('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
        
        showAlert('Task created successfully');
        loadTasks();
        loadDashboardData();
        closeModal('taskModal');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function updateTask(id, taskData) {
    try {
        await apiCall(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
        
        showAlert('Task updated successfully');
        loadTasks();
        loadDashboardData();
        closeModal('taskModal');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        await apiCall(`/tasks/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('Task deleted successfully');
        loadTasks();
        loadDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function editTask(id) {
    // Load task data and populate form
    loadTaskData(id).then(() => {
        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        document.getElementById('taskForm').dataset.taskId = id;
        showModal('taskModal');
    }).catch(error => {
        showAlert('Failed to load task data', 'danger');
        console.error('Error loading task data:', error);
    });
}

// Load task data for editing
async function loadTaskData(taskId) {
    try {
        const task = await apiCall(`/tasks/${taskId}`);
        
        // Populate form fields
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';
        document.getElementById('taskStatus').value = task.status || 'pending';
        
        // Wait for users to be loaded in dropdown, then set the assigned user
        await populateAssignedToDropdown();
        document.getElementById('taskAssignedTo').value = task.assigned_to || '';
        
    } catch (error) {
        throw new Error('Failed to load task data: ' + error.message);
    }
}

// Users functions
async function loadUsers() {
    try {
        const users = await apiCall('/users');
        displayUsers(users);
    } catch (error) {
        showAlert('Failed to load users', 'danger');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.full_name}</td>
            <td>${user.username}</td>
            <td><span class="status-badge status-${user.role}">${user.role}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit" onclick="editUser(${user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function addUser(userData) {
    try {
        await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        showAlert('User created successfully');
        loadUsers();
        loadDashboardData();
        closeModal('userModal');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function updateUser(id, userData) {
    try {
        await apiCall(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
        
        showAlert('User updated successfully');
        loadUsers();
        closeModal('userModal');
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        await apiCall(`/users/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('User deleted successfully');
        loadUsers();
        loadDashboardData();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function editUser(id) {
    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('userForm').dataset.userId = id;
    showModal('userModal');
}

// Profile functions
async function updateProfile(profileData) {
    try {
        await apiCall('/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        
        showAlert('Profile updated successfully');
        
        // Update current user data
        if (profileData.full_name) {
            currentUser.full_name = profileData.full_name;
            document.getElementById('userName').textContent = profileData.full_name;
        }
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    
    // Populate dropdowns when opening task modal
    if (modalId === 'taskModal') {
        populateAssignedToDropdown();
    }
}

// Populate the "Assigned To" dropdown with users
async function populateAssignedToDropdown() {
    try {
        const users = await apiCall('/users');
        const select = document.getElementById('taskAssignedTo');
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a user...';
        select.appendChild(defaultOption);
        
        // Add user options
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.full_name} (${user.username})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load users for dropdown:', error);
        showAlert('Failed to load users for assignment', 'danger');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    
    // Reset form
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        delete form.dataset.taskId;
        delete form.dataset.userId;
    }
}

// Navigation functions
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelector(`[data-page="${pageId.replace('Page', '')}"]`).classList.add('active');
    
    // Load page data
    switch (pageId) {
        case 'dashboardPage':
            loadDashboardData();
            break;
        case 'tasksPage':
            loadTasks();
            break;
        case 'usersPage':
            if (currentUser.role === 'admin') {
                loadUsers();
            }
            break;
    }
}

// Event listeners setup
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('.nav-link').dataset.page;
            showPage(page + 'Page');
        });
    });
    
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        const header = document.querySelector('.dashboard-header');
        
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        header.classList.toggle('expanded');
    });
    
    // User dropdown
    document.getElementById('userDropdownBtn').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.toggle('show');
    });
    
    // Notification dropdown
    document.getElementById('notificationBtn').addEventListener('click', () => {
        document.getElementById('notificationDropdown').classList.toggle('show');
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Profile link
    document.getElementById('profileLink').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('profilePage');
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-dropdown')) {
            document.getElementById('userDropdown').classList.remove('show');
        }
        if (!e.target.closest('.notification-dropdown')) {
            document.getElementById('notificationDropdown').classList.remove('show');
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            closeModal(modal.id);
        });
    });
    
    // Cancel buttons with data-dismiss="modal"
    document.querySelectorAll('[data-dismiss="modal"]').forEach(cancelBtn => {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = cancelBtn.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Task form
    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            assigned_to: document.getElementById('taskAssignedTo').value,
            due_date: document.getElementById('taskDueDate').value,
            status: document.getElementById('taskStatus').value
        };
        
        const taskId = e.target.dataset.taskId;
        
        if (taskId) {
            await updateTask(taskId, taskData);
        } else {
            await addTask(taskData);
        }
    });
    
    // User form
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            full_name: document.getElementById('userFullName').value,
            username: document.getElementById('userUsername').value,
            password: document.getElementById('userPassword').value,
            role: document.getElementById('userRole').value
        };
        
        const userId = e.target.dataset.userId;
        
        if (userId) {
            await updateUser(userId, userData);
        } else {
            await addUser(userData);
        }
    });
    
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const profileData = {
            full_name: document.getElementById('profileFullName').value,
            password: document.getElementById('profilePassword').value || undefined
        };
        
        await updateProfile(profileData);
    });
    
    // Add task button
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        document.getElementById('taskModalTitle').textContent = 'Add Task';
        delete document.getElementById('taskForm').dataset.taskId;
        
        // Clear form for new task
        document.getElementById('taskForm').reset();
        
        showModal('taskModal');
    });
    
    // Add user button
    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('userModalTitle').textContent = 'Add User';
        delete document.getElementById('userForm').dataset.userId;
        showModal('userModal');
    });
}

// Initialize app
function initApp() {
    // Set up initial event listeners (form switching, etc.)
    setupInitialEventListeners();
    
    // Check if user is already logged in
    if (authToken && localStorage.getItem('user')) {
        currentUser = JSON.parse(localStorage.getItem('user'));
        showDashboard();
        loadDashboardData();
        setupEventListeners();
    } else {
        showLoginForm();
        setupLoginEventListeners();
    }
}

// Set up event listeners that should always be available
function setupInitialEventListeners() {
    // Form switching links
    const showRegisterLink = document.getElementById('showRegisterForm');
    const showLoginLink = document.getElementById('showLoginForm');
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }
}

// Set up login and registration form event listeners
function setupLoginEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                await login(username, password);
            } catch (error) {
                const errorDiv = document.getElementById('loginError');
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    }
    
    // Registration form
    const registerForm = document.getElementById('registerFormElement');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const full_name = document.getElementById('registerFullName').value;
            const email = document.getElementById('registerEmail').value;
            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const role = document.getElementById('registerRole').value;
            
            // Clear previous errors
            const errorDiv = document.getElementById('registerError');
            const successDiv = document.getElementById('registerSuccess');
            errorDiv.style.display = 'none';
            successDiv.style.display = 'none';
            
            // Validate password confirmation
            if (password !== confirmPassword) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
                return;
            }
            
            try {
                await register(full_name, email, username, password, role);
                successDiv.textContent = 'Account created successfully! Welcome!';
                successDiv.style.display = 'block';
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);

// Modern Task Management Features
function initializeKanbanBoard() {
    const kanbanColumns = document.querySelectorAll('.kanban-column');
    const taskCards = document.querySelectorAll('.kanban-task');

    // Make task cards draggable
    taskCards.forEach(card => {
        card.draggable = true;
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });

    // Make columns droppable
    kanbanColumns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
    });

    loadKanbanTasks();
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedElement !== this) {
        const columnContent = this.querySelector('.column-content');
        if (columnContent && draggedElement) {
            const taskId = draggedElement.dataset.taskId;
            const newStatus = this.dataset.status;
            
            // Update task status in database
            updateTaskStatus(taskId, newStatus);
            
            // Move the element visually
            columnContent.appendChild(draggedElement);
            
            // Update task count
            updateColumnCounts();
        }
    }
}

function updateTaskStatus(taskId, status) {
    fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ status: status })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.error);
        }
        showNotification('Task status updated successfully', 'success');
        updateAnalyticsData();
    })
    .catch(error => {
        console.error('Error updating task status:', error);
        showNotification('Error updating task status', 'error');
    });
}

function loadKanbanTasks() {
    fetch('/api/tasks', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            renderKanbanTasks(data.tasks);
        }
    })
    .catch(error => {
        console.error('Error loading tasks:', error);
    });
}

function renderKanbanTasks(tasks) {
    const columns = {
        'pending': document.querySelector('[data-status="pending"] .column-content'),
        'in_progress': document.querySelector('[data-status="in_progress"] .column-content'),
        'completed': document.querySelector('[data-status="completed"] .column-content'),
        'on_hold': document.querySelector('[data-status="on_hold"] .column-content')
    };

    // Clear existing tasks
    Object.values(columns).forEach(column => {
        if (column) column.innerHTML = '';
    });

    tasks.forEach(task => {
        const taskElement = createKanbanTaskElement(task);
        const column = columns[task.status] || columns['pending'];
        if (column) {
            column.appendChild(taskElement);
        }
    });

    updateColumnCounts();
    
    // Re-initialize drag and drop for new elements
    const newTaskCards = document.querySelectorAll('.kanban-task');
    newTaskCards.forEach(card => {
        card.draggable = true;
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
}

function createKanbanTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'kanban-task';
    taskDiv.dataset.taskId = task.id;
    
    const priorityClass = `priority-${task.priority || 'low'}`;
    const dueDateClass = getDueDateClass(task.due_date);
    
    taskDiv.innerHTML = `
        <div class="task-priority ${priorityClass}"></div>
        <div class="task-title">${task.title}</div>
        <div class="task-description">${task.description || 'No description'}</div>
        <div class="task-meta">
            <div class="task-assignee">
                <div class="assignee-avatar">${getInitials(task.assigned_to || 'Unassigned')}</div>
                <span>${task.assigned_to || 'Unassigned'}</span>
            </div>
            <div class="task-due-date ${dueDateClass}">
                ${formatDate(task.due_date)}
            </div>
        </div>
    `;
    
    return taskDiv;
}

function getDueDateClass(dueDate) {
    if (!dueDate) return '';
    
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due-today';
    return '';
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateString) {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateColumnCounts() {
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(column => {
        const taskCount = column.querySelectorAll('.kanban-task').length;
        const countElement = column.querySelector('.task-count');
        if (countElement) {
            countElement.textContent = taskCount;
        }
    });
}

// Analytics Functionality
function initializeAnalytics() {
    if (document.querySelector('.analytics-dashboard')) {
        loadAnalyticsData();
    }
}

function loadAnalyticsData() {
    fetch('/api/analytics', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateAnalyticsCards(data.analytics);
            renderCharts(data.analytics);
        }
    })
    .catch(error => {
        console.error('Error loading analytics:', error);
    });
}

function updateAnalyticsCards(analytics) {
    // Update total tasks
    const totalTasksElement = document.querySelector('#total-tasks .metric-large');
    if (totalTasksElement) {
        totalTasksElement.textContent = analytics.totalTasks || 0;
    }

    // Update completed tasks
    const completedTasksElement = document.querySelector('#completed-tasks .metric-large');
    if (completedTasksElement) {
        completedTasksElement.textContent = analytics.completedTasks || 0;
    }

    // Update active projects
    const activeProjectsElement = document.querySelector('#active-projects .metric-large');
    if (activeProjectsElement) {
        activeProjectsElement.textContent = analytics.activeProjects || 0;
    }

    // Update team efficiency
    const teamEfficiencyElement = document.querySelector('#team-efficiency .metric-large');
    if (teamEfficiencyElement) {
        teamEfficiencyElement.textContent = `${analytics.teamEfficiency || 0}%`;
    }
}

function renderCharts(analytics) {
    // This would integrate with Chart.js or similar library
    // For now, we'll create simple visual representations
    createTaskStatusChart(analytics.tasksByStatus);
    createProductivityChart(analytics.productivityData);
}

function createTaskStatusChart(statusData) {
    const chartContainer = document.querySelector('#task-status-chart');
    if (!chartContainer) return;

    // Simple bar chart representation
    chartContainer.innerHTML = `
        <div class="simple-chart">
            <div class="chart-bar" style="height: ${(statusData.pending / statusData.total * 100) || 0}%; background: #feca57;">
                <span>Pending: ${statusData.pending || 0}</span>
            </div>
            <div class="chart-bar" style="height: ${(statusData.in_progress / statusData.total * 100) || 0}%; background: #667eea;">
                <span>In Progress: ${statusData.in_progress || 0}</span>
            </div>
            <div class="chart-bar" style="height: ${(statusData.completed / statusData.total * 100) || 0}%; background: #27ae60;">
                <span>Completed: ${statusData.completed || 0}</span>
            </div>
            <div class="chart-bar" style="height: ${(statusData.on_hold / statusData.total * 100) || 0}%; background: #e74c3c;">
                <span>On Hold: ${statusData.on_hold || 0}</span>
            </div>
        </div>
    `;
}

function createProductivityChart(productivityData) {
    const chartContainer = document.querySelector('#productivity-chart');
    if (!chartContainer) return;

    // Simple line chart representation
    chartContainer.innerHTML = '<div class="productivity-trend">Productivity trend chart would go here</div>';
}

function updateAnalyticsData() {
    // Refresh analytics when tasks are updated
    if (document.querySelector('.analytics-dashboard')) {
        loadAnalyticsData();
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Manual close
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
}

// Navigation between views
function showView(viewName) {
    const views = ['task-manager', 'kanban-board', 'analytics-dashboard'];
    
    views.forEach(view => {
        const element = document.getElementById(view);
        if (element) {
            element.style.display = view === viewName ? 'block' : 'none';
        }
    });
    
    // Update active navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(viewName)) {
            link.classList.add('active');
        }
    });
    
    // Load specific view data
    if (viewName === 'kanban-board') {
        initializeKanbanBoard();
        loadKanbanTasks();
    } else if (viewName === 'analytics-dashboard') {
        initializeAnalytics();
        loadAnalyticsData();
    }
}
