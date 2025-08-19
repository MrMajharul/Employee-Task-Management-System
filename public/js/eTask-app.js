// B.js eTask Management System
class TaskFlowApp {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('authToken');
        // Use same-origin API base by default; fall back to localhost during file:// access
        try {
            const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost:3002';
            this.API_BASE_URL = `${origin}/api`;
        } catch (_) {
            this.API_BASE_URL = 'http://localhost:3002/api';
        }
    this.currentView = 'list';
    this.tasks = [];
    this.users = [];
    this.projects = [];
        this.filters = {
            status: 'all',
            assignee: 'all',
            search: ''
        };
        
        this.init();
    }

    // Online Documents: load and render list
    async loadDocuments() {
        try {
            const q = (document.getElementById('docSearch')?.value || '').trim();
            const qs = q ? `?q=${encodeURIComponent(q)}` : '';
            const docs = await this.apiCall(`/documents${qs}`);
            this.documents = Array.isArray(docs) ? docs : [];
            this.renderDocumentsList();
        } catch (err) {
            console.error('Failed to load documents:', err);
            const list = document.getElementById('documentsList');
            if (list) {
                list.innerHTML = '<div class="empty-state">Unable to load documents.</div>';
            }
        }
    }

    renderDocumentsList() {
        const list = document.getElementById('documentsList');
        if (!list) return;

        const docs = this.documents || [];
        if (docs.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div>No documents yet</div>
                    <div class="empty-actions">
                        <button class="action-btn" id="docEmptyCreate">Create document</button>
                    </div>
                </div>`;
            const createBtn = document.getElementById('docEmptyCreate');
            if (createBtn) {
                createBtn.addEventListener('click', async () => {
                    const title = prompt('Document title');
                    if (!title) return;
                    await this.apiCall('/documents', { method: 'POST', body: JSON.stringify({ title, type: 'document' }) });
                    this.loadDocuments();
                });
            }
            return;
        }

        const fmtBytes = (b) => {
            if (!b && b !== 0) return '';
            const units = ['B','KB','MB','GB'];
            let i = 0; let n = b;
            while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
            return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
        };
        const iconFor = (type) => {
            switch (type) {
                case 'board': return '📋';
                case 'document': return '📝';
                case 'spreadsheet': return '📊';
                case 'presentation': return '📽️';
                default: return '📄';
            }
        };

        list.innerHTML = docs.map(d => {
            const fileUrl = d.filename ? `/uploads/documents/${d.filename}` : '';
            const updated = d.updated_at ? new Date(d.updated_at) : (d.created_at ? new Date(d.created_at) : null);
            const updatedText = updated ? updated.toLocaleDateString() : '';
            return `
            <div class="doc-row" data-doc-id="${d.id}">
                <div class="doc-main">
                    <span class="doc-icon" aria-hidden="true">${iconFor(d.type)}</span>
                    <span class="doc-title" title="Double-click to rename">${this.escapeHtml(d.title || 'Untitled')}</span>
                </div>
                <div class="doc-meta">
                    <span class="badge badge-${d.type}">${d.type || 'file'}</span>
                    ${d.shared ? '<span class="badge badge-shared">Shared</span>' : ''}
                    ${d.published ? '<span class="badge badge-published">Published</span>' : ''}
                    ${d.size ? `<span class="doc-size">${fmtBytes(d.size)}</span>` : ''}
                    ${updatedText ? `<span class="doc-updated">${updatedText}</span>` : ''}
                </div>
                <div class="doc-actions">
                    ${fileUrl ? `<a class="btn-link" href="${fileUrl}" target="_blank" rel="noopener">Open</a>` : ''}
                    <button class="btn-link" data-action="toggle-share">${d.shared ? 'Unshare' : 'Share'}</button>
                    <button class="btn-link" data-action="toggle-publish">${d.published ? 'Unpublish' : 'Publish'}</button>
                    <button class="btn-link" data-action="rename">Rename</button>
                    <button class="btn-link text-danger" data-action="delete">Delete</button>
                </div>
            </div>`;
        }).join('');

        // Event delegation for actions (set up once)
        if (!this._docsDelegated) {
            this._docsDelegated = true;
            list.addEventListener('click', async (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const row = btn.closest('[data-doc-id]');
                if (!row) return;
                const id = row.getAttribute('data-doc-id');
                const doc = (this.documents || []).find(x => String(x.id) === String(id));
                if (!doc) return;
                const action = btn.getAttribute('data-action');
                try {
                    if (action === 'rename') {
                        const newTitle = prompt('Rename document', doc.title || '');
                        if (!newTitle || newTitle === doc.title) return;
                        await this.apiCall(`/documents/${doc.id}`, { method: 'PUT', body: JSON.stringify({ title: newTitle }) });
                        doc.title = newTitle;
                        this.renderDocumentsList();
                        this.showNotification('Document renamed', 'success');
                    } else if (action === 'toggle-share') {
                        const newVal = !doc.shared;
                        await this.apiCall(`/documents/${doc.id}`, { method: 'PUT', body: JSON.stringify({ shared: newVal }) });
                        doc.shared = newVal ? 1 : 0;
                        this.renderDocumentsList();
                    } else if (action === 'toggle-publish') {
                        const newVal = !doc.published;
                        await this.apiCall(`/documents/${doc.id}`, { method: 'PUT', body: JSON.stringify({ published: newVal }) });
                        doc.published = newVal ? 1 : 0;
                        this.renderDocumentsList();
                    } else if (action === 'delete') {
                        if (!confirm('Delete this document? This cannot be undone.')) return;
                        await this.apiCall(`/documents/${doc.id}`, { method: 'DELETE' });
                        this.documents = (this.documents || []).filter(x => x.id !== doc.id);
                        this.renderDocumentsList();
                        this.showNotification('Document deleted', 'success');
                    }
                } catch (err) {
                    this.showNotification(err.message || 'Action failed', 'error');
                }
            });

            // Rename via double-click on title
            list.addEventListener('dblclick', async (e) => {
                const titleEl = e.target.closest('.doc-title');
                if (!titleEl) return;
                const row = titleEl.closest('[data-doc-id]');
                if (!row) return;
                const id = row.getAttribute('data-doc-id');
                const doc = (this.documents || []).find(x => String(x.id) === String(id));
                if (!doc) return;
                const newTitle = prompt('Rename document', doc.title || '');
                if (!newTitle || newTitle === doc.title) return;
                try {
                    await this.apiCall(`/documents/${doc.id}`, { method: 'PUT', body: JSON.stringify({ title: newTitle }) });
                    doc.title = newTitle;
                    this.renderDocumentsList();
                } catch (err) {
                    this.showNotification(err.message || 'Rename failed', 'error');
                }
            });
        }
    }

    // Documents interface setup - comprehensive wiring for all document functionality
    setupDocumentsInterface() {
        // Search functionality
        const docSearch = document.getElementById('docSearch');
        if (docSearch && !docSearch._bound) {
            docSearch._bound = true;
            docSearch.addEventListener('input', () => this.loadDocuments());
        }

        // New document button
        const docNewButton = document.getElementById('docNewButton');
        if (docNewButton && !docNewButton._bound) {
            docNewButton._bound = true;
            docNewButton.addEventListener('click', async () => {
                const title = prompt('Document title');
                if (!title) return;
                try {
                    await this.apiCall('/documents', { method: 'POST', body: JSON.stringify({ title, type: 'document' }) });
                    this.loadDocuments();
                    this.showNotification('Document created successfully!', 'success');
                } catch (err) {
                    this.showNotification(err.message || 'Failed to create document', 'error');
                }
            });
        }

        // Document template buttons
        document.querySelectorAll('.doc-template').forEach(btn => {
            if (btn._bound) return;
            btn._bound = true;
            btn.addEventListener('click', async (e) => {
                const type = e.currentTarget.dataset.type;
                if (!type) return;
                const title = prompt(`New ${type} title`);
                if (!title) return;
                try {
                    await this.apiCall('/documents', { method: 'POST', body: JSON.stringify({ title, type }) });
                    this.loadDocuments();
                    this.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} created successfully!`, 'success');
                } catch (err) {
                    this.showNotification(err.message || `Failed to create ${type}`, 'error');
                }
            });
        });

        // File upload from computer
        const docUploadInput = document.getElementById('docUploadInput');
        if (docUploadInput && !docUploadInput._bound) {
            docUploadInput._bound = true;
            docUploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Validate file size (10MB limit)
                const maxSize = 10 * 1024 * 1024;
                if (file.size > maxSize) {
                    this.showNotification('File size must be less than 10MB', 'error');
                    e.target.value = '';
                    return;
                }

                try {
                    const form = new FormData();
                    form.append('file', file);
                    form.append('title', file.name);
                    
                    const res = await fetch(`${this.API_BASE_URL}/documents/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        body: form
                    });
                    
                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
                        throw new Error(errorData.error || 'Upload failed');
                    }

                    this.showNotification('Document uploaded successfully!', 'success');
                    this.loadDocuments();
                } catch (err) {
                    this.showNotification(err.message || 'Upload failed', 'error');
                }
                e.target.value = '';
            });
        }

        // View toggle buttons (List, Grid, Tile)
        this.setupDocumentViewToggles();

        // Filter buttons (Active, Shared, Published)
        this.setupDocumentFilters();
    }

    setupDocumentViewToggles() {
        const viewButtons = ['docViewList', 'docViewGrid', 'docViewTile'];
        viewButtons.forEach(buttonId => {
            const btn = document.getElementById(buttonId);
            if (btn && !btn._bound) {
                btn._bound = true;
                btn.addEventListener('click', () => {
                    // Update active state
                    viewButtons.forEach(id => {
                        document.getElementById(id)?.classList.remove('active');
                    });
                    btn.classList.add('active');
                    
                    // Apply view style to documents list
                    const docsList = document.getElementById('documentsList');
                    if (docsList) {
                        docsList.className = 'documents-list';
                        if (buttonId === 'docViewGrid') {
                            docsList.classList.add('grid-view');
                        } else if (buttonId === 'docViewTile') {
                            docsList.classList.add('tile-view');
                        }
                        // List view is default, no additional class needed
                    }
                });
            }
        });
    }

    setupDocumentFilters() {
        const filterButtons = ['docFilterActive', 'docFilterShared', 'docFilterPublished'];
        filterButtons.forEach(buttonId => {
            const btn = document.getElementById(buttonId);
            if (btn && !btn._bound) {
                btn._bound = true;
                btn.addEventListener('click', async () => {
                    // Update active state
                    filterButtons.forEach(id => {
                        document.getElementById(id)?.classList.remove('active');
                    });
                    btn.classList.add('active');
                    
                    // Apply filter and reload documents
                    let filter = '';
                    if (buttonId === 'docFilterShared') filter = 'shared';
                    else if (buttonId === 'docFilterPublished') filter = 'published';
                    
                    try {
                        const q = document.getElementById('docSearch')?.value || '';
                        const qs = new URLSearchParams();
                        if (q) qs.append('q', q);
                        if (filter) qs.append('filter', filter);
                        
                        const queryString = qs.toString() ? `?${qs.toString()}` : '';
                        const docs = await this.apiCall(`/documents${queryString}`);
                        this.documents = Array.isArray(docs) ? docs : [];
                        this.renderDocumentsList();
                    } catch (err) {
                        this.showNotification('Failed to filter documents', 'error');
                    }
                });
            }
        });
    }
    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async init() {
        this.setupEventListeners();
        
        // Start real-time clock
        this.initClock();
        
        // Check if user is logged in and verify token
        if (this.authToken && localStorage.getItem('user')) {
            this.currentUser = JSON.parse(localStorage.getItem('user'));
            // Immediately reflect user info in UI so header doesn't show "Loading..."
            this.updateUserInfo();
            // Verify token is still valid
            if (await this.verifyAuthentication()) {
                this.showDashboard();
                await this.loadInitialData();
                
                // Failsafe: retry loading tasks if none were loaded initially
                if ((!this.tasks || this.tasks.length === 0)) {
                    console.log('No tasks loaded initially, retrying...');
                    setTimeout(() => this.refreshTasks(), 1000);
                }
            } else {
                this.logout();
            }
        } else {
            this.showLoginForm();
        }
    }

    initClock() {
        const updateClock = () => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            
            const timeString = `${hours}:${minutes}`;
            const clockElement = document.querySelector('.header-time');
            if (clockElement) {
                clockElement.innerHTML = `${timeString} <small>WORKING</small>`;
            }
        };
        
        // Update immediately and then every second
        updateClock();
        setInterval(updateClock, 1000);
    }

    async verifyAuthentication() {
        try {
            // Try to access a protected endpoint to verify token
            await this.apiCall('/dashboard');
            return true;
        } catch (error) {
            console.error('Authentication verification failed:', error);
            return false;
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
        // Project form
        const projectForm = document.getElementById('projectForm');
        if (projectForm) {
            projectForm.addEventListener('submit', (e) => this.handleProjectSubmit(e));
        }

        // Modal close buttons and data attribute handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || 
                e.target.dataset.dismiss === 'modal' ||
                e.target.classList.contains('btn-cancel')) {
                this.closeModal();
            }
            
            // Handle data-action attributes
            const actionElement = e.target.closest('[data-action]');
            if (actionElement) {
                const action = actionElement.getAttribute('data-action');
                switch (action) {
                    case 'new-task':
                        this.openNewTaskModal();
                        break;
                    case 'assign-task':
                        this.openNewTaskModal();
                        break;
                    case 'new-project':
                        this.openNewProjectModal();
                        break;
                    case 'refresh-tasks':
                        this.refreshTasks();
                        break;
                    case 'mark-all-read':
                        this.markAllRead();
                        break;
                }
            }
            
            // Handle data-view attributes (filter tabs)
            const viewElement = e.target.closest('[data-view]');
            if (viewElement) {
                const view = viewElement.getAttribute('data-view');
                this.switchView(view);
            }
            
            // Handle data-filter attributes
            const filterElement = e.target.closest('[data-filter]');
            if (filterElement) {
                const filter = filterElement.getAttribute('data-filter');
                this.filterBy(filter);
            }
            
            // Close sidebar when clicking outside
            if (!e.target.closest('.app-sidebar') && !e.target.closest('#sidebarToggle')) {
                const appSidebar = document.getElementById('appSidebar');
                const sidebarOverlay = document.getElementById('sidebarOverlay');
                if (appSidebar && appSidebar.classList.contains('active')) {
                    appSidebar.classList.remove('active');
                    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                    // Update aria-expanded state
                    const toggleBtn = document.getElementById('sidebarToggle');
                    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Search functionality
        const searchInput = document.getElementById('taskSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase().trim();
                this.filterAndDisplayTasks();
            });
        }

        // Global search
        const globalSearch = document.querySelector('.global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase().trim();
                this.filterAndDisplayTasks();
                
                // Visual feedback
                if (e.target.value.trim()) {
                    e.target.parentElement.classList.add('searching');
                } else {
                    e.target.parentElement.classList.remove('searching');
                }
            });
        }

        // Sidebar toggle (left app sidebar)
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const appSidebar = document.getElementById('appSidebar');
                if (appSidebar) {
                    const willActivate = !appSidebar.classList.contains('active');
                    appSidebar.classList.toggle('active');
                    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
                    // Update aria-expanded
                    sidebarToggle.setAttribute('aria-expanded', willActivate ? 'true' : 'false');
                }
            });
            // Keyboard accessibility
            sidebarToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sidebarToggle.click();
                }
            });
        }

        // Close app sidebar
        const closeAppSidebar = document.getElementById('closeAppSidebar');
        if (closeAppSidebar) {
            closeAppSidebar.addEventListener('click', () => {
                const appSidebar = document.getElementById('appSidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (appSidebar) appSidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
            });
        }

        // Close sidebar when overlay is clicked
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                const appSidebar = document.getElementById('appSidebar');
                if (appSidebar) appSidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
            });
        }

        // ESC key closes the sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const appSidebar = document.getElementById('appSidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (appSidebar && appSidebar.classList.contains('active')) {
                    appSidebar.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
                }
            }
        });

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

        // Documents UI wiring
        this.setupDocumentsInterface();                // Enhanced invite functionality
        const inviteBtn = document.querySelector('.invite-btn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => this.openInviteModal());
        }

        // Invite form real-time updates
        const inviteFirstName = document.getElementById('inviteFirstName');
        const inviteLastName = document.getElementById('inviteLastName');
        const inviteRole = document.getElementById('inviteRole');
        
        if (inviteFirstName && inviteLastName) {
            const updateInvitePreview = () => {
                const firstName = inviteFirstName.value || 'New';
                const lastName = inviteLastName.value || 'Team Member';
                const role = inviteRole ? (inviteRole.selectedOptions[0]?.text || 'Employee') : 'Employee';
                
                const namePreview = document.getElementById('inviteNamePreview');
                const rolePreview = document.getElementById('inviteRolePreview');
                const avatarPreview = document.getElementById('inviteAvatarPreview');
                
                if (namePreview) namePreview.textContent = `${firstName} ${lastName}`;
                if (rolePreview) rolePreview.textContent = role;
                
                // Update avatar with initials
                if (avatarPreview && firstName && lastName) {
                    const initials = firstName.charAt(0) + lastName.charAt(0);
                    avatarPreview.innerHTML = initials.toUpperCase();
                }
            };
            
            inviteFirstName.addEventListener('input', updateInvitePreview);
            inviteLastName.addEventListener('input', updateInvitePreview);
            if (inviteRole) inviteRole.addEventListener('change', updateInvitePreview);
        }

        // Skills management for profile
        this.initializeSkillsInput();

        // Profile photo upload
        const photoUpload = document.getElementById('photoUpload');
        if (photoUpload) {
            photoUpload.addEventListener('change', (e) => this.handlePhotoUpload(e));
        }

        // Photo remove button
        const photoRemoveBtn = document.querySelector('.btn-photo-remove');
        if (photoRemoveBtn) {
            photoRemoveBtn.addEventListener('click', () => this.removeProfilePhoto());
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
        // Grab fields
        const titleEl = document.getElementById('taskTitle');
        const descEl = document.getElementById('taskDescription');
        const assigneeEl = document.getElementById('taskAssignedTo');
        const dueEl = document.getElementById('taskDueDate');
        const statusEl = document.getElementById('taskStatus');
        const priorityEl = document.getElementById('taskPriority');
        const saveBtn = e.submitter || document.querySelector('#taskForm .btn-save');

        const title = (titleEl?.value || '').trim();
        const description = (descEl?.value || '').trim();
        let assigned_to = assigneeEl?.value || '';
        const due_date = dueEl?.value || null;
        const status = statusEl?.value || 'pending';
        const priority = priorityEl?.value || 'medium';

        // Client-side validation and sensible defaults
        if (!title) {
            this.showNotification('Please enter a task title.', 'error');
            titleEl?.focus();
            return;
        }
        // Default to current user if no assignee selected to prevent server 400
        if (!assigned_to) {
            if (!this.currentUser?.id) {
                this.showNotification('You must be logged in to create tasks.', 'error');
                return;
            }
            assigned_to = this.currentUser.id;
        }

        const taskData = { title, description, assigned_to, due_date, status, priority };

        const taskId = document.getElementById('taskForm').dataset.taskId;

        // Prevent double submit and show loading state
        const originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = taskId ? 'Saving…' : 'Creating…';
        }

        try {
            if (taskId) {
                await this.apiCall(`/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify(taskData)
                });
                this.showNotification('Task updated successfully!', 'success');
                // Refresh checklist and files if modal remains open
                this.loadTaskChecklists(taskId);
                this.loadTaskFiles(taskId);
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
            // Surface server validation errors clearly
            this.showNotification(error.message || 'Failed to save task', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText || 'Save Task';
            }
        }
    }

    // Task Files & Checklist
    async loadTaskFiles(taskId) {
        const list = document.getElementById('taskFilesList');
        const hint = document.getElementById('taskFilesHint');
        if (!list) return;
        if (!taskId) {
            if (hint) hint.style.display = 'block';
            list.innerHTML = '';
            return;
        }
        if (hint) hint.style.display = 'none';
        try {
            const files = await this.apiCall(`/tasks/${taskId}/files`);
            list.innerHTML = files.map(f => `
                <div class="file-item" data-file-id="${f.id}">
                    <div>
                        <a href="${f.url}" target="_blank" rel="noopener">${this.escapeHtml(f.original_name)}</a>
                        <div class="file-meta">${(f.size/1024).toFixed(1)} KB · ${new Date(f.created_at).toLocaleString()}</div>
                    </div>
                    <button class="btn-link text-danger" data-action="delete-file">Delete</button>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<div class="section-hint">Unable to load files.</div>';
        }
    }

    async uploadTaskFiles(taskId, files) {
        if (!taskId || !files || files.length === 0) return;
        const form = new FormData();
        for (const f of files) form.append('files', f);
        const res = await fetch(`${this.API_BASE_URL}/tasks/${taskId}/files`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.authToken}` },
            body: form
        });
        if (!res.ok) throw new Error('Upload failed');
        this.showNotification('Files uploaded', 'success');
        await this.loadTaskFiles(taskId);
    }

    async loadTaskChecklists(taskId) {
        const list = document.getElementById('taskChecklistList');
        const hint = document.getElementById('taskChecklistHint');
        const form = document.getElementById('checklistAddForm');
        const input = document.getElementById('checklistNewTitle');
        if (!list) return;
        if (!taskId) {
            if (hint) hint.style.display = 'block';
            list.innerHTML = '';
            if (form) form.style.display = 'none';
            return;
        }
        if (hint) hint.style.display = 'none';
        if (form) form.style.display = 'flex';
        try {
            const items = await this.apiCall(`/tasks/${taskId}/checklists`);
            list.innerHTML = items.map(it => `
                <div class="check-item" data-check-id="${it.id}">
                    <div class="left">
                        <input type="checkbox" ${it.is_completed ? 'checked' : ''} data-action="toggle-check">
                        <span class="title">${this.escapeHtml(it.title)}</span>
                    </div>
                    <div class="actions">
                        <button class="btn-link" data-action="rename-check">Rename</button>
                        <button class="btn-link text-danger" data-action="delete-check">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<div class="section-hint">Unable to load checklist.</div>';
        }

        // Bind add form
        if (form && !form._bound) {
            form._bound = true;
            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const title = input?.value?.trim();
                if (!title) return;
                try {
                    await this.apiCall(`/tasks/${taskId}/checklists`, { method: 'POST', body: JSON.stringify({ title }) });
                    input.value = '';
                    this.loadTaskChecklists(taskId);
                } catch (err) {
                    this.showNotification(err.message || 'Failed to add item', 'error');
                }
            });
        }

        // Event delegation for checklist actions
        if (list && !list._delegated) {
            list._delegated = true;
            list.addEventListener('click', async (e) => {
                const row = e.target.closest('[data-check-id]');
                if (!row) return;
                const id = row.getAttribute('data-check-id');
                const action = e.target.getAttribute('data-action');
                try {
                    if (action === 'delete-check') {
                        await this.apiCall(`/checklists/${id}`, { method: 'DELETE' });
                        this.loadTaskChecklists(taskId);
                    } else if (action === 'rename-check') {
                        const current = row.querySelector('.title')?.textContent || '';
                        const title = prompt('Rename checklist item', current);
                        if (!title || title === current) return;
                        await this.apiCall(`/checklists/${id}`, { method: 'PUT', body: JSON.stringify({ title }) });
                        this.loadTaskChecklists(taskId);
                    }
                } catch (err) {
                    this.showNotification(err.message || 'Action failed', 'error');
                }
            });

            list.addEventListener('change', async (e) => {
                if (e.target.getAttribute('data-action') !== 'toggle-check') return;
                const row = e.target.closest('[data-check-id]');
                if (!row) return;
                const id = row.getAttribute('data-check-id');
                try {
                    await this.apiCall(`/checklists/${id}`, { method: 'PUT', body: JSON.stringify({ is_completed: e.target.checked }) });
                } catch (err) {
                    this.showNotification(err.message || 'Update failed', 'error');
                    e.target.checked = !e.target.checked;
                }
            });
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
                // Handle authentication errors
                if (response.status === 401 || response.status === 403) {
                    console.warn('Authentication failed, redirecting to login');
                    this.logout();
                    throw new Error('Authentication required');
                }
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
            console.log('Starting to load initial data...');
            
            // Load dashboard data first, which includes user-specific stats
            await this.loadDashboardData();
            
            // Load tasks and users in parallel
            await Promise.all([
                this.loadTasks(),
                this.loadUsers()
            ]);
            // Preload documents list (lazy render until view is shown)
            await this.loadDocuments?.();
            
            // Update user info after everything is loaded
            this.updateUserInfo();
            
            console.log('Initial data loading completed');
        } catch (error) {
            console.error('Error loading initial data:', error);
            // If we get authentication errors, logout the user
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Authentication')) {
                this.logout();
            } else {
                // For non-auth errors, still try to show the dashboard
                this.showNotification('Some data failed to load. Please refresh the page.', 'warning');
            }
        }
    }

    async loadDashboardData() {
        try {
            const dashboardData = await this.apiCall('/dashboard');
            this.updateDashboardStats(dashboardData);
            this.displayRecentTasks(dashboardData.recentTasks || []);
            this.updateNotificationCount(dashboardData.unreadNotifications || 0);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }

    updateDashboardStats(data) {
        // Update task counters
        const taskCounter = document.getElementById('taskCounter');
        if (taskCounter) {
            taskCounter.textContent = data.total_tasks || 0;
        }

        // Update notification count
        const notificationCount = document.querySelector('.notification-count');
        if (notificationCount) {
            notificationCount.textContent = data.unreadNotifications || 0;
            notificationCount.style.display = data.unreadNotifications > 0 ? 'block' : 'none';
        }

        // Update user name in header
        const userName = document.getElementById('userName');
        if (userName && this.currentUser) {
            userName.textContent = this.currentUser.full_name || this.currentUser.username;
        }

        // Update user avatar
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar && this.currentUser) {
            const name = this.currentUser.full_name || this.currentUser.username;
            userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff`;
        }
    }

    displayRecentTasks(tasks) {
        // This will display recent tasks in the dashboard
        // You can customize this based on your dashboard layout
        console.log('Recent tasks:', tasks);
    }

    updateNotificationCount(count) {
        const notificationCount = document.querySelector('.notification-count');
        if (notificationCount) {
            notificationCount.textContent = count;
            notificationCount.style.display = count > 0 ? 'block' : 'none';
        }
    }

    async loadTasks() {
        try {
            console.log('Loading tasks from API...');
            const response = await this.apiCall('/tasks');
            console.log('Tasks API response:', response);
            
            // Handle different response formats
            this.tasks = Array.isArray(response) ? response : (response.tasks || []);
            console.log('Loaded tasks:', this.tasks.length, 'tasks');
            
            // Ensure DOM is ready before displaying
            if (document.getElementById('taskList')) {
                this.filterAndDisplayTasks();
                this.updateTaskCounters();
            } else {
                console.warn('TaskList element not found, will retry when DOM is ready');
                // Retry after a short delay
                setTimeout(() => {
                    if (document.getElementById('taskList')) {
                        this.filterAndDisplayTasks();
                        this.updateTaskCounters();
                    }
                }, 500);
            }
            
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('Failed to load tasks: ' + error.message, 'error');
            
            // Show empty state with proper message
            const taskList = document.getElementById('taskList');
            if (taskList) {
                taskList.innerHTML = `
                    <div class="no-tasks-message" style="padding: 40px; text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f56c6c; margin-bottom: 16px;"></i>
                        <h3>Unable to load tasks</h3>
                        <p>Please check your connection and try again.</p>
                        <button class="btn-primary" onclick="location.reload()">
                            <i class="fas fa-refresh"></i> Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    }
    
    // Method to force refresh tasks
    async refreshTasks() {
        console.log('Refreshing tasks...');
        await this.loadTasks();
    }

    async loadUsers() {
        try {
            console.log('Loading users from API...');
            const response = await this.apiCall('/users');
            console.log('Users API response:', response);
            this.users = response.users || response || [];
            console.log('Parsed users array:', this.users);
            this.populateUserDropdowns();
            this.displayTeamAvatars();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    filterAndDisplayTasks() {
        let filteredTasks = [...this.tasks];
        
        console.log('filterAndDisplayTasks: Filtering tasks. Total:', filteredTasks.length, 'Search term:', this.filters.search);
        
        // Apply search filter
        if (this.filters.search && this.filters.search.trim() !== '') {
            const search = this.filters.search.toLowerCase();
            filteredTasks = filteredTasks.filter(task => {
                const title = (task.title || '').toLowerCase();
                const description = (task.description || '').toLowerCase();
                const assignedName = (task.assigned_to_name || '').toLowerCase();
                
                return title.includes(search) || 
                       description.includes(search) || 
                       assignedName.includes(search);
            });
            console.log('After search filter:', filteredTasks.length);
        }
        
        // Apply status filter
        if (this.filters.status !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.status === this.filters.status);
        }
        
        // Apply assignee filter
        if (this.filters.assignee !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.assigned_to == this.filters.assignee);
        }
        
        console.log('Final filtered tasks for display:', filteredTasks.length);
        
        // Display based on current view
        if (this.currentView === 'list') {
            this.displayTaskList(filteredTasks);
        } else if (this.currentView === 'kanban') {
            this.displayKanbanBoard(filteredTasks);
        }
        
        // Update search results indicator
        this.updateSearchResultsIndicator(filteredTasks.length, this.tasks.length);
    }
    
    updateSearchResultsIndicator(filteredCount, totalCount) {
        const indicator = document.querySelector('.search-results-indicator');
        if (this.filters.search && this.filters.search.trim() !== '') {
            if (!indicator) {
                const searchContainer = document.querySelector('.search-section');
                if (searchContainer) {
                    const indicatorEl = document.createElement('div');
                    indicatorEl.className = 'search-results-indicator';
                    searchContainer.appendChild(indicatorEl);
                }
            }
            const indicatorEl = document.querySelector('.search-results-indicator');
            if (indicatorEl) {
                indicatorEl.innerHTML = `
                    <i class="fas fa-search"></i>
                    Found ${filteredCount} of ${totalCount} tasks
                    <button class="clear-search" onclick="window.app.clearSearch()">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                indicatorEl.style.display = 'flex';
            }
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    clearSearch() {
        this.filters.search = '';
        
        // Clear search inputs
        const searchInput = document.getElementById('taskSearch');
        const globalSearch = document.querySelector('.global-search');
        
        if (searchInput) searchInput.value = '';
        if (globalSearch) {
            globalSearch.value = '';
            globalSearch.parentElement.classList.remove('searching');
        }
        
        this.filterAndDisplayTasks();
    }

    displayTaskList(tasks) {
        console.log('displayTaskList called with:', tasks ? tasks.length : 0, 'tasks');
        const taskList = document.getElementById('taskList');
        if (!taskList) {
            console.warn('taskList element not found in DOM');
            return;
        }
        
        console.log('TaskList element found, clearing and populating...');
        taskList.innerHTML = '';
        
        if (!tasks || tasks.length === 0) {
            console.log('No tasks to display, showing empty state');
            taskList.innerHTML = `
                <div class="no-tasks-message" style="padding: 40px; text-align: center; background: white; border-radius: 8px;">
                    <i class="fas fa-tasks" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></i>
                    <h3>No tasks found</h3>
                    <p>Create your first task to get started!</p>
                    <button class="btn-primary" onclick="openNewTaskModal()">
                        <i class="fas fa-plus"></i> Create Task
                    </button>
                </div>
            `;
            return;
        }
        
        console.log('Displaying', tasks.length, 'tasks');
        tasks.forEach((task, index) => {
            console.log(`Creating task element ${index + 1}:`, task.title);
            const taskElement = this.createTaskListItem(task);
            taskList.appendChild(taskElement);
        });
        
        console.log('Task list population completed, taskList children:', taskList.children.length);
        // Delegate description expand/collapse once per page
        if (!this._descDelegated) {
            this._descDelegated = true;
            const container = document.getElementById('taskList');
            if (container) {
                container.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-action="toggle-desc"]');
                    if (!btn) return;
                    const item = btn.closest('.task-item');
                    if (!item) return;
                    const desc = item.querySelector('.task-description');
                    if (!desc) return;
                    const expanded = desc.classList.toggle('expanded');
                    btn.textContent = expanded ? 'Show less' : 'Show more';
                    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                });
            }
        }
    }

    createTaskListItem(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        taskDiv.dataset.taskId = task.id;
        
        // Resolve creator and assignee display
        const creatorName = task.assigned_by_name || 'Unknown';
        let assignedUser = null;
        if (task.assigned_to_name) {
            assignedUser = { full_name: task.assigned_to_name, email: task.assigned_to_email || '' };
        } else if (task.assigned_to) {
            assignedUser = this.users.find(u => u.id == task.assigned_to);
        }
        
        const priorityClass = `priority-${task.priority || 'medium'}`;
        const statusClass = `status-${task.status || 'pending'}`;
        
        // Determine urgency styling
        const urgencyClass = task.urgency_status === 'overdue' ? 'task-overdue' : '';
        
        taskDiv.innerHTML = `
            <div class="task-content ${urgencyClass}">
                <div class="task-header">
                    <h4 class="task-title">${task.title || 'Untitled Task'}</h4>
                    <div class="task-actions">
                        <span class="task-status ${statusClass}">${this.formatStatus(task.status)}</span>
                        <span class="task-priority ${priorityClass}">
                            <i class="fas fa-flag"></i> ${(task.priority || 'medium').toUpperCase()}
                        </span>
                        <button class="edit-task" onclick="window.app.editTask(${task.id})" title="Edit task">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-task" onclick="window.app.deleteTask(${task.id})" title="Delete task">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="task-description" data-expanded="false">${this.escapeHtml(task.description || 'No description provided')}</div>
                ${task.description && task.description.length > 160 ? '<button class="show-more" data-action="toggle-desc" aria-expanded="false">Show more</button>' : ''}
                <div class="task-meta">
                    <div class="task-assignee">
                        ${assignedUser ? `
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(assignedUser.full_name)}&background=667eea&color=fff" 
                                 alt="${assignedUser.full_name}" class="assignee-avatar">
                            <span><strong>Assignee:</strong> ${assignedUser.full_name}</span>
                        ` : '<span class="unassigned"><strong>Assignee:</strong> Unassigned</span>'}
                    </div>
                    <div class="task-created-by">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(creatorName)}&background=667eea&color=fff" 
                        alt="${creatorName}" class="assignee-avatar"/>
                    <span><strong>Created by:</strong> ${creatorName}</span>
                    </div>
                    <div class="task-due-date ${this.getDueDateClass(task.due_date)}">
                        <i class="fas fa-calendar-alt"></i> ${this.formatDate(task.due_date)}
                    </div>
                    ${task.urgency_status === 'overdue' ? '<span class="overdue-badge"><i class="fas fa-exclamation-triangle"></i> Overdue</span>' : ''}
                </div>
            </div>
        `;
        
        // Add click handler for viewing task details (except on action buttons)
        taskDiv.addEventListener('click', (e) => {
            // Don't trigger detail view if clicking on action buttons
            if (e.target.closest('.task-actions') || e.target.closest('[data-action]')) {
                return;
            }
            this.showTaskDetail(task.id);
        });
        
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
        
        // Add click handler for viewing task details
        taskDiv.addEventListener('click', () => this.showTaskDetail(task.id));
        
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
        if (!assignedToSelect) {
            console.warn('taskAssignedTo select element not found');
            return;
        }
        
        console.log('Populating user dropdown with users:', this.users);
        
        assignedToSelect.innerHTML = '<option value="">Select user...</option>';
        
        if (!this.users || this.users.length === 0) {
            console.warn('No users available to populate dropdown');
            return;
        }
        
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.full_name} (${user.username})`;
            assignedToSelect.appendChild(option);
        });
        
        console.log('User dropdown populated with', this.users.length, 'users');
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

    // Employees view
    renderEmployeesList() {
        const container = document.getElementById('employeesList');
        if (!container) return;

        const term = (document.getElementById('employeeSearch')?.value || '').toLowerCase().trim();
        const users = (this.users || []).filter(u => {
            if (!term) return true;
            const hay = `${u.full_name || ''} ${u.username || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase();
            return hay.includes(term);
        });

        if (!users.length) {
            container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1; text-align:center; padding:24px;">No employees found</div>';
            return;
        }

        container.innerHTML = users.map(u => {
            const name = this.escapeHtml(u.full_name || u.username || 'User');
            const role = this.escapeHtml(u.role || 'employee');
            const email = this.escapeHtml(u.email || '');
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff`;
            return `
                <div class="employee-card" style="background:#fff; border:1px solid #e9ecef; border-radius:12px; padding:16px; display:flex; gap:12px; align-items:center; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
                    <img src="${avatar}" alt="${name}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" />
                    <div style="flex:1;">
                        <div style="font-weight:600; color:#333;">${name}</div>
                        <div style="font-size:12px; color:#666; text-transform:capitalize;">${role}</div>
                        ${email ? `<div style="font-size:12px; color:#888;">${email}</div>` : ''}
                    </div>
                </div>`;
        }).join('');

        // Bind search once
        const search = document.getElementById('employeeSearch');
        if (search && !search._bound) {
            search._bound = true;
            search.addEventListener('input', () => this.renderEmployeesList());
        }
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
        const name = this.currentUser ? (this.currentUser.full_name || this.currentUser.username || 'User') : 'User';
        const userNameElements = document.querySelectorAll('#userName');
        userNameElements.forEach(element => {
            element.textContent = name;
        });
        // Also update avatar if present
        const avatar = document.querySelector('.user-avatar');
        if (avatar) {
            avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff`;
        }
    }

    async showTaskDetail(taskId) {
        try {
            const task = await this.apiCall(`/tasks/${taskId}`);
            
            // Populate task detail modal
            document.getElementById('taskDetailTitle').textContent = task.title || 'Untitled Task';
            document.getElementById('taskDetailDescription').textContent = task.description || 'No description provided';
            
            // Update status badge
            const statusBadge = document.getElementById('taskDetailStatus');
            statusBadge.textContent = task.status;
            statusBadge.className = `task-status-badge ${task.status}`;
            
            // Update priority badge
            const priorityBadge = document.getElementById('taskDetailPriority');
            priorityBadge.textContent = task.priority;
            priorityBadge.className = `task-priority-badge ${task.priority}`;
            
            // Update sidebar status
            const statusLarge = document.getElementById('taskStatusLarge');
            statusLarge.innerHTML = `
                <span class="status-text">${task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', ' ')}</span>
                <span class="status-time">since ${this.formatDateTime(task.created_at)}</span>
            `;
            
            // Update task info
            document.getElementById('taskDeadlineInfo').textContent = task.due_date ? this.formatDateTime(task.due_date) : 'No deadline';
            document.getElementById('taskCreatedInfo').textContent = this.formatDateTime(task.created_at);
            
            // Update people info
            const assignedUser = this.users.find(u => u.id == task.assigned_to);
            const createdUser = this.users.find(u => u.id == task.created_by) || { full_name: 'Unknown User', email: 'unknown' };
            
            if (assignedUser) {
                document.getElementById('taskAssigneeAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(assignedUser.full_name)}&background=667eea&color=fff`;
                document.getElementById('taskAssigneeName').textContent = assignedUser.full_name;
            } else {
                document.getElementById('taskAssigneeAvatar').src = 'https://ui-avatars.com/api/?name=Unassigned&background=ccc&color=fff';
                document.getElementById('taskAssigneeName').textContent = 'Unassigned';
            }
            
            document.getElementById('taskCreatorAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(createdUser.full_name)}&background=667eea&color=fff`;
            document.getElementById('taskCreatorName').textContent = createdUser.full_name;
            
            // Store task ID for actions
            document.getElementById('taskDetailModal').dataset.taskId = taskId;
            
            // Show/hide action buttons based on status
            const startBtn = document.getElementById('taskStartBtn');
            const finishBtn = document.getElementById('taskFinishBtn');
            
            startBtn.style.display = task.status === 'pending' ? 'block' : 'none';
            finishBtn.style.display = task.status === 'in_progress' ? 'block' : 'none';

            // Bind Start/Finish handlers (bind once)
            if (startBtn && !startBtn._bound) {
                startBtn._bound = true;
                startBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = Number(document.getElementById('taskDetailModal').dataset.taskId);
                    if (id) this.updateTaskStatus(id, 'in_progress');
                });
            }
            if (finishBtn && !finishBtn._bound) {
                finishBtn._bound = true;
                finishBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = Number(document.getElementById('taskDetailModal').dataset.taskId);
                    if (id) this.updateTaskStatus(id, 'completed');
                });
            }

            // Like button (toggle UI only for now)
            const likeBtn = document.querySelector('.like-btn');
            if (likeBtn && !likeBtn._bound) {
                likeBtn._bound = true;
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    likeBtn.classList.toggle('active');
                    this.showNotification(likeBtn.classList.contains('active') ? 'Liked' : 'Unliked', 'info');
                });
            }

            // Video call button (placeholder action)
            const videoBtn = document.querySelector('.video-call-btn');
            if (videoBtn && !videoBtn._bound) {
                videoBtn._bound = true;
                videoBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showNotification('Video call feature is not configured yet.', 'warning');
                });
            }

            // More... dropdown toggle
            const moreBtn = document.querySelector('.task-header-actions .more-btn');
            if (moreBtn && !moreBtn._bound) {
                moreBtn._bound = true;
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dd = moreBtn.closest('.dropdown');
                    if (dd) dd.classList.toggle('open');
                });
                // Close dropdown when clicking outside
                document.addEventListener('click', (evt) => {
                    const dd = moreBtn.closest('.dropdown');
                    if (!dd) return;
                    if (!dd.contains(evt.target)) dd.classList.remove('open');
                }, { once: true });
            }

            // Comments input: allow quick add (frontend only)
            const commentField = document.querySelector('#commentsTab .comment-field');
            if (commentField && !commentField._bound) {
                commentField._bound = true;
                commentField.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && commentField.value.trim()) {
                        e.preventDefault();
                        const list = document.getElementById('commentsList');
                        const text = this.escapeHtml(commentField.value.trim());
                        const now = new Date().toLocaleString();
                        const item = document.createElement('div');
                        item.className = 'comment-item';
                        item.innerHTML = `<div class="comment-text">${text}</div><div class="comment-meta">You • ${now}</div>`;
                        list?.prepend(item);
                        const cnt = document.getElementById('commentsCount');
                        if (cnt) cnt.textContent = String(Number(cnt.textContent || '0') + 1);
                        commentField.value = '';
                    }
                });
            }
            
            // Setup tab switching
            this.setupTaskDetailTabs();
            
            // Load comments and history
            await this.loadTaskComments(taskId);
            await this.loadTaskHistory(taskId);
            
            this.showModal('taskDetailModal');
        } catch (error) {
            console.error('Error loading task details:', error);
            this.showNotification('Failed to load task details', 'error');
        }
    }

    setupTaskDetailTabs() {
        const tabs = document.querySelectorAll('.task-tab');
        const panes = document.querySelectorAll('.tab-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                
                tab.classList.add('active');
                const targetPane = document.getElementById(tab.dataset.tab + 'Tab');
                if (targetPane) targetPane.classList.add('active');
            });
        });
    }

    async loadTaskComments(taskId) {
        try {
            // For now, show a placeholder - you can implement actual comments API
            const commentsList = document.getElementById('commentsList');
            commentsList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No comments yet</div>';
            document.getElementById('commentsCount').textContent = '0';
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    async loadTaskHistory(taskId) {
        try {
            // Show creation history and any status changes
            const history = document.getElementById('taskHistory');
            const task = this.tasks.find(t => t.id == taskId);
            const createdUser = this.users.find(u => u.id == task?.created_by) || { full_name: 'Unknown User' };
            
            history.innerHTML = `
                <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <strong>${createdUser.full_name}</strong> created this task
                    <div style="color: #999; font-size: 12px;">${this.formatDateTime(task?.created_at)}</div>
                </div>
            `;
            document.getElementById('historyCount').textContent = '1';
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    formatDateTime(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
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
            // After modal opens, load files and checklist
            setTimeout(() => {
                this.loadTaskFiles(taskId);
                this.loadTaskChecklists(taskId);
                const uploadBtn = document.getElementById('taskFilesBtn');
                const input = document.getElementById('taskFilesInput');
                if (uploadBtn && input && !uploadBtn._bound) {
                    uploadBtn._bound = true;
                    uploadBtn.addEventListener('click', () => input.click());
                    input.addEventListener('change', async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) await this.uploadTaskFiles(taskId, files);
                        e.target.value = '';
                    });
                    // Enable section when task exists
                    const filesHint = document.getElementById('taskFilesHint');
                    if (filesHint) filesHint.style.display = 'none';
                }
            }, 50);
            
        } catch (error) {
            console.error('Error loading task:', error);
            this.showNotification('Failed to load task details', 'error');
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            console.log('Updating task status:', taskId, 'to', newStatus);
            console.log('Auth token exists:', !!this.authToken);
            
            const url = `${this.API_BASE_URL}/tasks/${taskId}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            console.log('Status update response:', response.status, data);

            if (!response.ok) {
                if (response.status === 403) {
                    this.showNotification('You do not have permission to update this task', 'error');
                    return;
                } else if (response.status === 401) {
                    this.showNotification('Authentication required. Please log in again.', 'error');
                    this.logout();
                    return;
                } else {
                    throw new Error(data.error || `Server error: ${response.status}`);
                }
            }
            
            this.showNotification(`Task status updated to ${newStatus.replace('_', ' ')}!`, 'success');
            
            // Refresh task detail view
            await this.showTaskDetail(taskId);
            
            // Reload tasks to update the main view
            await this.loadTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showNotification(`Failed to update task status: ${error.message}`, 'error');
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
        
        // Initialize default view - ensure DOM is ready first
        setTimeout(() => {
            this.showMainView('tasks');
            // Force task loading after DOM is ready
            if (this.tasks && this.tasks.length > 0) {
                console.log('Re-displaying tasks after dashboard show:', this.tasks.length);
                this.filterAndDisplayTasks();
            }
        }, 100);
        
        // Set up periodic dashboard refresh
        this.setupDashboardRefresh();
    }

    setupDashboardRefresh() {
        // Refresh dashboard data every 30 seconds
        if (this.dashboardRefreshInterval) {
            clearInterval(this.dashboardRefreshInterval);
        }
        
        this.dashboardRefreshInterval = setInterval(async () => {
            try {
                await this.loadDashboardData();
            } catch (error) {
                console.error('Failed to refresh dashboard:', error);
                // If authentication fails, the apiCall method will handle logout
            }
        }, 30000); // 30 seconds
    }

    showMainView(viewName) {
        console.log('Switching to view:', viewName);
        
        // Hide all views
        document.querySelectorAll('.main-view').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });
        
        // Show selected view
        const view = document.getElementById(`${viewName}View`);
        if (view) {
            view.classList.add('active');
            view.style.display = 'block';
        }
        
        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[onclick="showMainView('${viewName}')"]`) || document.querySelector(`[data-view="${viewName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // If switching to tasks view, ensure tasks are displayed
        if (viewName === 'tasks' && this.tasks && this.tasks.length > 0) {
            console.log('Refreshing task display for tasks view');
            setTimeout(() => this.filterAndDisplayTasks(), 100);
        }

        // If switching to projects view, load & render projects
        if (viewName === 'projects') {
            if (!this.projects || this.projects.length === 0) {
                this.loadProjects().finally(() => this.renderProjectsList());
            } else {
                this.renderProjectsList();
            }
        }

        // Update page title
        const titles = {
            'tasks': 'My Tasks',
            'projects': 'Projects',
            'scrum': 'Scrum Board', 
            'assigned': 'Tasks Set by Me',
            'efficiency': 'Efficiency Analytics',
            'supervising': 'Team Supervision',
            'messenger': 'Messenger',
            'documents': 'Online Documents',
            'employees': 'Employees'
        };

        document.title = `eTask - ${titles[viewName] || 'Task Management'}`;
        if (viewName === 'documents') {
            this.loadDocuments?.();
            // Setup document interface if not already done
            setTimeout(() => this.setupDocumentsInterface?.(), 100);
        } else if (viewName === 'employees') {
            // Ensure users are available and render list
            if (!this.users || this.users.length === 0) {
                this.loadUsers().finally(() => this.renderEmployeesList?.());
            } else {
                this.renderEmployeesList?.();
            }
        }
    }

    switchView(viewType) {
        this.currentView = viewType;
        
        // Update filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Try both data-view and onclick selectors for backward compatibility
        const activeTab = document.querySelector(`[data-view="${viewType}"]`) || 
                         document.querySelector(`[onclick="switchView('${viewType}')"]`);
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
        
        // Render view-specific content
        if (viewType === 'list' || viewType === 'kanban') {
            this.filterAndDisplayTasks();
        } else if (viewType === 'deadline') {
            this.renderDeadlineView();
        } else if (viewType === 'calendar') {
            this.renderCalendar();
        } else if (viewType === 'gantt') {
            this.renderGanttView();
        }
    }

    // ===== Projects: load, render, create =====
    async loadProjects() {
        try {
            const data = await this.apiCall('/projects');
            this.projects = Array.isArray(data) ? data : [];
            const counter = document.getElementById('projectCounter');
            if (counter) counter.textContent = this.projects.length || 0;
            return this.projects;
        } catch (err) {
            console.error('Failed to load projects:', err);
            this.projects = [];
            const grid = document.getElementById('projectsGrid');
            if (grid) grid.innerHTML = '<div class="empty-state">Unable to load projects.</div>';
        }
    }

    renderProjectsList() {
        const grid = document.getElementById('projectsGrid');
        if (!grid) return;
        const items = this.projects || [];
        if (items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div>No projects yet</div>
                    <div class="empty-actions">
                        <button class="action-btn new-task-btn" data-action="new-project"><i class="fas fa-plus"></i> Create your first project</button>
                    </div>
                </div>`;
            return;
        }
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '';
        grid.innerHTML = items.map(p => `
            <div class="project-card" data-project-id="${p.id}">
                <div class="project-card-header">
                    <span class="project-color" style="background:${p.color || '#3B82F6'}"></span>
                    <h4 class="project-name">${this.escapeHtml(p.name)}</h4>
                    <span class="status badge">${p.status || 'planning'}</span>
                </div>
                <div class="project-card-body">
                    <p class="project-desc">${this.escapeHtml(p.description || '')}</p>
                    <div class="project-meta">
                        <span title="Tasks"><i class="fas fa-tasks"></i> ${p.task_count || 0}</span>
                        <span title="Members"><i class="fas fa-users"></i> ${p.member_count || 1}</span>
                        <span title="Due">${fmtDate(p.due_date)}</span>
                    </div>
                    <div class="progress"><div class="bar" style="width:${Math.max(0, Math.min(100, Math.round(p.avg_progress || p.progress_percentage || 0)))}%"></div></div>
                </div>
            </div>
        `).join('');
    }

    openNewProjectModal() {
        const form = document.getElementById('projectForm');
        if (form) form.reset();
        const color = document.getElementById('projectColor');
        if (color) color.value = '#3B82F6';
        this.showModal('projectModal');
    }

    async handleProjectSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const name = form.querySelector('#projectName')?.value?.trim();
        if (!name) {
            this.showNotification('Project name is required', 'warning');
            return;
        }
        const payload = {
            name,
            description: form.querySelector('#projectDescription')?.value || null,
            priority: form.querySelector('#projectPriority')?.value || 'medium',
            start_date: form.querySelector('#projectStart')?.value || null,
            due_date: form.querySelector('#projectDue')?.value || null,
            color: form.querySelector('#projectColor')?.value || '#3B82F6',
            budget: form.querySelector('#projectBudget')?.value || null,
        };
        try {
            await this.apiCall('/projects', { method: 'POST', body: JSON.stringify(payload) });
            this.hideModal('projectModal');
            this.showNotification('Project created successfully', 'success');
            await this.loadProjects();
            this.renderProjectsList();
        } catch (err) {
            this.showNotification('Failed to create project', 'error');
        }
    }
    // Deadline view: Group tasks by due date buckets
    renderDeadlineView() {
        const container = document.getElementById('deadlineList');
        if (!container) return;
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const buckets = {
            overdue: [],
            today: [],
            tomorrow: [],
            thisWeek: [],
            later: []
        };

        (this.tasks || []).forEach(task => {
            if (!task.due_date) {
                buckets.later.push(task);
                return;
            }
            const due = new Date(task.due_date);
            const diffDays = Math.floor((due - startOfToday) / (1000*60*60*24));
            if (due < startOfToday && task.status !== 'completed') buckets.overdue.push(task);
            else if (due >= startOfToday && due <= endOfToday) buckets.today.push(task);
            else if (diffDays === 1) buckets.tomorrow.push(task);
            else if (diffDays >= 2 && diffDays <= 7) buckets.thisWeek.push(task);
            else buckets.later.push(task);
        });

        const renderGroup = (title, items, icon) => `
            <div class="deadline-group">
                <div class="deadline-group-header">
                    <i class="fas ${icon}"></i> ${title} 
                    <span class="count">${items.length}</span>
                </div>
                <div class="deadline-group-body">
                    ${items.length ? items.map(t => `
                        <div class="deadline-item ${t.status === 'completed' ? 'done' : ''}" onclick="window.app.showTaskDetail(${t.id})">
                            <div>
                                <div class="title">${this.escapeHtml(t.title)}</div>
                                <div class="meta">
                                    <span class="date">${this.formatDate(t.due_date)}</span>
                                    <span class="priority badge-${t.priority || 'medium'}">${(t.priority || 'medium').toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') : '<div class="empty">No tasks in this category</div>'}
                </div>
            </div>`;

        container.innerHTML = [
            renderGroup('Overdue', buckets.overdue, 'fa-exclamation-triangle'),
            renderGroup('Today', buckets.today, 'fa-calendar-day'),
            renderGroup('Tomorrow', buckets.tomorrow, 'fa-sun'),
            renderGroup('This Week', buckets.thisWeek, 'fa-calendar-week'),
            renderGroup('Later', buckets.later, 'fa-calendar')
        ].join('');
    }

    // Calendar view: Simple month grid with due-date dots
    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const title = document.getElementById('calendarTitle');
        if (!grid || !title) return;

        // Persist current month state
        if (!this._calRef) {
            const now = new Date();
            this._calRef = { year: now.getFullYear(), month: now.getMonth() };
            // Bind controls once
            const prev = document.getElementById('calPrev');
            const next = document.getElementById('calNext');
            if (prev && !prev._bound) {
                prev._bound = true;
                prev.addEventListener('click', () => {
                    this._calRef.month -= 1;
                    if (this._calRef.month < 0) { this._calRef.month = 11; this._calRef.year -= 1; }
                    this.renderCalendar();
                });
            }
            if (next && !next._bound) {
                next._bound = true;
                next.addEventListener('click', () => {
                    this._calRef.month += 1;
                    if (this._calRef.month > 11) { this._calRef.month = 0; this._calRef.year += 1; }
                    this.renderCalendar();
                });
            }
        }

        const { year, month } = this._calRef;
        const first = new Date(year, month, 1);
        const startDay = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        title.textContent = `${first.toLocaleString('default', { month: 'long' })} ${year}`;

        // Build a map day -> tasks
        const byDay = new Map();
        (this.tasks || []).forEach(t => {
            if (!t.due_date) return;
            const d = new Date(t.due_date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const key = d.getDate();
                if (!byDay.has(key)) byDay.set(key, []);
                byDay.get(key).push(t);
            }
        });

        const cells = [];
        // Leading blanks
        for (let i = 0; i < startDay; i++) {
            cells.push('<div class="cal-cell blank"></div>');
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const items = byDay.get(day) || [];
            const dots = items.slice(0, 3).map(t => 
                `<span class="dot dot-${t.priority || 'medium'}" title="${this.escapeHtml(t.title)}"></span>`
            ).join('');
            const more = items.length > 3 ? `<span class="more">+${items.length - 3}</span>` : '';
            
            cells.push(`
                <div class="cal-cell" onclick="window.app.showDayTasks(${year}, ${month}, ${day})">
                    <div class="date">${day}</div>
                    <div class="dots">${dots}${more}</div>
                </div>
            `);
        }
        
        grid.innerHTML = cells.join('');
    }
    
    // Helper method to show tasks for a specific day
    showDayTasks(year, month, day) {
        const dayTasks = (this.tasks || []).filter(t => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });
        
        if (dayTasks.length > 0) {
            const date = new Date(year, month, day);
            const dateStr = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            let message = `Tasks due on ${dateStr}:\n\n`;
            dayTasks.forEach(task => {
                message += `• ${task.title} (${task.priority || 'medium'} priority)\n`;
            });
            
            alert(message);
        } else {
            const date = new Date(year, month, day);
            const dateStr = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            this.showNotification(`No tasks due on ${dateStr}`, 'info');
        }
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
        this.showModal('inviteModal');
        
        // Setup invite form submission
        const inviteForm = document.getElementById('inviteForm');
        if (inviteForm) {
            inviteForm.addEventListener('submit', (e) => this.handleInviteSubmit(e));
        }
    }

    async handleInviteSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('inviteEmail').value;
        const role = document.getElementById('inviteRole').value;
        const message = document.getElementById('inviteMessage').value;

        try {
            // For now, create a user account with temporary password
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

            this.showNotification('Invitation sent successfully!', 'success');
            this.closeModal();
            document.getElementById('inviteForm').reset();
            await this.loadUsers(); // Refresh user list
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    showSettingsModal() {
        this.showModal('settingsModal');
        this.loadUserProfile();
        this.setupSettingsEventListeners();
    }

    async loadUserProfile() {
        try {
            if (this.currentUser) {
                document.getElementById('profileFullName').value = this.currentUser.full_name || '';
                document.getElementById('profileUsername').value = this.currentUser.username || '';
                document.getElementById('profileEmail').value = this.currentUser.email || '';
                document.getElementById('profilePhone').value = this.currentUser.phone || '';
                document.getElementById('profileRole').value = this.currentUser.role || '';
                document.getElementById('profileDepartment').value = this.currentUser.department || '';
                document.getElementById('profileBio').value = this.currentUser.bio || '';
                
                // Update profile photo if available
                if (this.currentUser.profile_photo) {
                    document.getElementById('currentProfilePhoto').src = this.currentUser.profile_photo;
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    setupSettingsEventListeners() {
        // Settings navigation
        document.querySelectorAll('.settings-nav-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchSettingsTab(tab);
            });
        });

        // Profile form submission
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Password form submission
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }

        // Profile photo upload
        const photoUpload = document.getElementById('photoUpload');
        if (photoUpload) {
            photoUpload.addEventListener('change', (e) => this.handlePhotoUpload(e));
        }

        // Photo upload button
        const currentPhoto = document.querySelector('.current-photo');
        if (currentPhoto) {
            currentPhoto.addEventListener('click', () => {
                document.getElementById('photoUpload').click();
            });
        }

        // Remove photo button
        const removePhotoBtn = document.querySelector('.btn-photo-remove');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => this.removeProfilePhoto());
        }

        // 2FA enable button
        const enable2faBtn = document.getElementById('enable2fa');
        if (enable2faBtn) {
            enable2faBtn.addEventListener('click', () => this.enable2FA());
        }

        // Logout all sessions
        const logoutAllBtn = document.getElementById('logoutAllSessions');
        if (logoutAllBtn) {
            logoutAllBtn.addEventListener('click', () => this.logoutAllSessions());
        }

        // Export data
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportUserData());
        }

        // Delete account
        const deleteBtn = document.getElementById('deleteAccount');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteAccount());
        }
    }

    switchSettingsTab(tabName) {
        // Update navigation
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update panels
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}Settings`).classList.add('active');
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const profileData = {
            full_name: document.getElementById('profileFullName').value,
            username: document.getElementById('profileUsername').value,
            email: document.getElementById('profileEmail').value,
            phone: document.getElementById('profilePhone').value,
            role: document.getElementById('profileRole').value,
            department: document.getElementById('profileDepartment').value,
            bio: document.getElementById('profileBio').value
        };

        try {
            const response = await this.apiCall('/user/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });

            this.currentUser = { ...this.currentUser, ...profileData };
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            // Update UI
            document.getElementById('userName').textContent = profileData.full_name;
            
            this.showNotification('Profile updated successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            this.showNotification('Password must be at least 8 characters long', 'error');
            return;
        }

        try {
            await this.apiCall('/user/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            document.getElementById('passwordForm').reset();
            this.showNotification('Password changed successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select a valid image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Image size must be less than 5MB', 'error');
            return;
        }

        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (event) => {
            const photoPreview = document.getElementById('currentProfilePhoto');
            const userAvatar = document.querySelector('.user-avatar');
            if (photoPreview) {
                photoPreview.src = event.target.result;
            }
            if (userAvatar) {
                userAvatar.src = event.target.result;
            }
        };
        reader.readAsDataURL(file);

        // Try to upload to server
        const formData = new FormData();
        formData.append('profilePhoto', file);

        try {
            this.showNotification('Uploading photo...', 'info');
            
            const response = await fetch(`${this.API_BASE_URL}/user/profile-photo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                
                // Update UI with server response
                if (data.photoUrl) {
                    document.getElementById('currentProfilePhoto').src = data.photoUrl;
                    const userAvatar = document.querySelector('.user-avatar');
                    if (userAvatar) userAvatar.src = data.photoUrl;
                    
                    this.currentUser.profile_photo = data.photoUrl;
                    localStorage.setItem('user', JSON.stringify(this.currentUser));
                }
                
                this.showNotification('Profile photo updated successfully!', 'success');
            } else {
                // If server upload fails, keep the local preview
                console.warn('Server upload failed, keeping local preview');
                this.showNotification('Photo updated locally (server upload failed)', 'warning');
            }
        } catch (error) {
            console.error('Photo upload error:', error);
            // Keep the local preview even if server upload fails
            this.showNotification('Photo updated locally (server not available)', 'warning');
        }
    }

    async removeProfilePhoto() {
        try {
            await this.apiCall('/user/profile-photo', {
                method: 'DELETE'
            });

            // Reset to default avatar
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.full_name)}&background=667eea&color=fff`;
            document.getElementById('currentProfilePhoto').src = defaultAvatar;
            document.querySelector('.user-avatar').src = defaultAvatar;
            
            this.currentUser.profile_photo = null;
            localStorage.setItem('user', JSON.stringify(this.currentUser));

            this.showNotification('Profile photo removed successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    enable2FA() {
        this.showNotification('2FA setup will be available in the next update', 'info');
    }

    async logoutAllSessions() {
        if (!confirm('Are you sure you want to logout all sessions? This will require you to login again.')) {
            return;
        }

        try {
            await this.apiCall('/user/logout-all-sessions', {
                method: 'POST'
            });

            this.showNotification('All sessions logged out successfully!', 'success');
            setTimeout(() => this.logout(), 2000);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async exportUserData() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/user/export-data`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to export data');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eTask-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showNotification('Data exported successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async deleteAccount() {
        const confirmation = prompt('Type "DELETE" to confirm account deletion:');
        
        if (confirmation !== 'DELETE') {
            this.showNotification('Account deletion cancelled', 'info');
            return;
        }

        try {
            await this.apiCall('/user/delete-account', {
                method: 'DELETE'
            });

            this.showNotification('Account deleted successfully', 'success');
            setTimeout(() => {
                localStorage.clear();
                window.location.reload();
            }, 2000);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
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
        try {
            this.authToken = null;
            this.currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');

            // Clear dashboard refresh interval
            if (this.dashboardRefreshInterval) {
                clearInterval(this.dashboardRefreshInterval);
                this.dashboardRefreshInterval = null;
            }

            // Close any open modals (best-effort)
            document.querySelectorAll('.modal').forEach(modal => modal.remove());
        } finally {
            // Redirect to login page to ensure a clean state
            window.location.href = 'login.html';
        }
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

    // Initialize skills input functionality
    initializeSkillsInput() {
        const skillsInput = document.getElementById('profileSkillsInput');
        const skillsContainer = document.getElementById('profileSkillsTags');
        
        if (skillsInput && skillsContainer) {
            skillsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const skill = skillsInput.value.trim();
                    if (skill) {
                        this.addSkillTag(skill, skillsContainer);
                        skillsInput.value = '';
                    }
                }
            });
            
            // Handle removing existing skill tags
            skillsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('fa-times')) {
                    e.target.closest('.skill-tag').remove();
                }
            });
        }
    }
    
    // Add skill tag
    addSkillTag(skill, container) {
        const skillTag = document.createElement('span');
        skillTag.className = 'skill-tag';
        skillTag.innerHTML = `${skill} <i class="fas fa-times"></i>`;
        container.appendChild(skillTag);
    }
    
    // Open invite modal
    openInviteModal() {
        this.showModal('inviteModal');
    }
}

// Global functions for onclick handlers
function showMainView(viewName) {
    if (window.app) {
        window.app.showMainView(viewName);
    }
}

function switchView(viewType) {
    if (window.app) {
        window.app.switchView(viewType);
    }
}

function openNewTaskModal() {
    document.getElementById('taskModalTitle').textContent = 'Add New Task';
    document.getElementById('taskForm').reset();
    delete document.getElementById('taskForm').dataset.taskId;
    
    // Ensure users are loaded in dropdown
    if (window.app && window.app.users && window.app.users.length > 0) {
        window.app.populateUserDropdowns();
    } else if (window.app) {
        window.app.loadUsers();
    }
    
    if (window.app) {
        window.app.showModal('taskModal');
    }
}

function filterBy(filterType) {
    if (window.app) {
        if (filterType === 'overdue') {
            window.app.filters.status = 'all';
            // Filter will be applied in filterAndDisplayTasks based on due date
        }
        window.app.filterAndDisplayTasks();
    }
}

function markAllRead() {
    if (window.app) {
        window.app.showNotification('All tasks marked as read', 'success');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TaskFlowApp();
});

// Add debugging functions for testing modal functionality
window.debugModals = () => {
    console.log('=== MODAL DEBUG ===');
    const taskModal = document.getElementById('taskModal');
    const settingsModal = document.getElementById('settingsModal');
    
    console.log('Task Modal:', taskModal);
    if (taskModal) {
        const modalActions = taskModal.querySelector('.modal-actions');
        const saveBtn = taskModal.querySelector('.btn-save');
        console.log('Task Modal Actions:', modalActions);
        console.log('Save Button:', saveBtn);
        if (modalActions) {
            console.log('Modal actions display:', getComputedStyle(modalActions).display);
            console.log('Modal actions visibility:', getComputedStyle(modalActions).visibility);
        }
    }
    
    console.log('Settings Modal:', settingsModal);
    if (settingsModal) {
        const photoUpload = settingsModal.querySelector('#photoUpload');
        const photoPreview = settingsModal.querySelector('#currentProfilePhoto');
        console.log('Photo Upload Input:', photoUpload);
        console.log('Photo Preview:', photoPreview);
    }
};

// Fallback handlers for inline actions in Task Detail modal
function copyTask() {
    const id = Number(document.getElementById('taskDetailModal')?.dataset.taskId);
    if (!id || !window.app) return;
    const task = (window.app.tasks || []).find(t => Number(t.id) === id);
    if (!task) return;
    const payload = {
        title: `${task.title} (Copy)`,
        description: task.description,
        assigned_to: task.assigned_to || window.app.currentUser?.id,
        due_date: task.due_date,
        priority: task.priority || 'medium',
        estimated_hours: task.estimated_hours || null
    };
    window.app.apiCall('/tasks', { method: 'POST', body: JSON.stringify(payload) })
        .then(() => window.app.refreshTasks())
        .then(() => window.app.showNotification('Task copied', 'success'))
        .catch(err => window.app.showNotification(err.message || 'Copy failed', 'error'));
}

function createSubtask() {
    window.app?.showNotification('Subtasks are not implemented yet.', 'warning');
}

function addToDailyPlan() {
    window.app?.showNotification('Daily plan integration is not configured.', 'warning');
}

function delegateTask() {
    window.app?.showNotification('Delegation modal coming soon.', 'info');
}

function deferTask() {
    window.app?.showNotification('Defer options not available yet.', 'info');
}

function deleteTaskFromDetail() {
    const id = Number(document.getElementById('taskDetailModal')?.dataset.taskId);
    if (id && window.app) window.app.deleteTask(id);
}

function editTaskFromDetail() {
    const id = Number(document.getElementById('taskDetailModal')?.dataset.taskId);
    if (id && window.app) window.app.editTask(id);
}

function showAddChecklistForm() {
    // Focus the checklist input if present
    const input = document.getElementById('checklistNewTitle');
    const form = document.getElementById('checklistAddForm');
    if (form) form.style.display = 'inline-flex';
    if (input) input.focus();
}

window.debugSidebar = () => {
    console.log('=== SIDEBAR DEBUG ===');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const appSidebar = document.getElementById('appSidebar');
    const closeAppSidebar = document.getElementById('closeAppSidebar');
    
    console.log('Sidebar Toggle Button:', sidebarToggle);
    console.log('App Sidebar:', appSidebar);
    console.log('Close App Sidebar Button:', closeAppSidebar);
    
    if (appSidebar) {
        const computedStyle = getComputedStyle(appSidebar);
        console.log('Sidebar active class:', appSidebar.classList.contains('active'));
        console.log('Sidebar left position:', computedStyle.left);
        console.log('Sidebar z-index:', computedStyle.zIndex);
        console.log('Sidebar display:', computedStyle.display);
    }
};

window.testTaskModal = () => {
    console.log('Testing task modal...');
    if (window.app) {
        window.app.showModal('taskModal');
    }
};

window.testPhotoUpload = () => {
    console.log('Testing photo upload...');
    if (window.app) {
        window.app.showModal('settingsModal');
    }
};
