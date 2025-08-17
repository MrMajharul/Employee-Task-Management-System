// Messenger functionality for eTask
class MessengerApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = 'general';
        this.activeUsers = new Map();
        this.messages = new Map();
        this.isConnected = false;
        this.typingTimer = null;
        
        this.initializeUser();
    }

    initializeUser() {
        const userData = localStorage.getItem('user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    initializeMessenger() {
        if (!this.socket) {
            this.connectToSocket();
        }
        this.setupEventListeners();
        this.showWelcomeMessage();
    }

    connectToSocket() {
        // Load Socket.IO client
        if (typeof io === 'undefined') {
            const script = document.createElement('script');
            script.src = '/socket.io/socket.io.js';
            script.onload = () => {
                this.establishConnection();
            };
            document.head.appendChild(script);
        } else {
            this.establishConnection();
        }
    }

    establishConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to messenger server');
            this.isConnected = true;
            
            // Join with user data
            if (this.currentUser) {
                this.socket.emit('join', {
                    userId: this.currentUser.id,
                    username: this.currentUser.username,
                    fullName: this.currentUser.full_name
                });
                
                // Join general room by default
                this.socket.emit('join_room', 'general');
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from messenger server');
            this.isConnected = false;
        });

        this.socket.on('new_message', (message) => {
            this.displayMessage(message);
        });

        this.socket.on('new_private_message', (message) => {
            this.displayPrivateMessage(message);
        });

        this.socket.on('users_updated', (users) => {
            this.updateOnlineUsers(users);
        });

        this.socket.on('user_typing', (data) => {
            this.showTypingIndicator(data);
        });

        this.socket.on('message_sent', (message) => {
            this.displayMessage(message, true);
        });
    }

    setupEventListeners() {
        // Message input handlers
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                } else {
                    this.handleTyping();
                }
            });

            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Chat search
        const chatSearch = document.getElementById('chatSearch');
        if (chatSearch) {
            chatSearch.addEventListener('input', (e) => {
                this.filterChats(e.target.value);
            });
        }
    }

    showWelcomeMessage() {
        const chatWelcome = document.getElementById('chatWelcome');
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatWelcome && chatMessages) {
            chatWelcome.style.display = 'flex';
            chatMessages.innerHTML = `
                <div class="date-separator">
                    <span>today</span>
                </div>
            `;
        }
    }

    selectChat(roomId) {
        // Update active chat in sidebar
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const selectedChat = document.querySelector(`[data-room="${roomId}"]`);
        if (selectedChat) {
            selectedChat.classList.add('active');
        }

        // Update current room
        this.currentRoom = roomId;
        
        // Join the room
        if (this.socket && this.isConnected) {
            this.socket.emit('join_room', roomId);
        }

        // Update chat header
        this.updateChatHeader(roomId);
        
        // Hide welcome message and show chat
        const chatWelcome = document.getElementById('chatWelcome');
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatWelcome) chatWelcome.style.display = 'none';
        if (chatMessages) {
            chatMessages.style.display = 'block';
            this.loadRoomMessages(roomId);
        }
    }

    updateChatHeader(roomId) {
        const chatName = document.getElementById('currentChatName');
        const chatMembers = document.getElementById('currentChatMembers');
        
        const roomNames = {
            'general': 'General chat',
            'support': 'eTask Support',
            'company-news': 'Company News',
            'notes': 'Notes'
        };

        if (chatName) {
            chatName.textContent = roomNames[roomId] || roomId;
        }
        
        if (chatMembers) {
            const memberCount = this.activeUsers.size || 1;
            chatMembers.textContent = `Members: ${memberCount}`;
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !this.socket || !this.isConnected) return;

        const messageData = {
            text: message,
            roomId: this.currentRoom,
            timestamp: new Date()
        };

        this.socket.emit('send_message', messageData);
        messageInput.value = '';
        
        // Clear typing indicator
        this.socket.emit('typing', {
            roomId: this.currentRoom,
            isTyping: false
        });
    }

    displayMessage(message, isOwnMessage = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        // Hide welcome message if it's showing
        const chatWelcome = document.getElementById('chatWelcome');
        if (chatWelcome) chatWelcome.style.display = 'none';

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const senderInitials = message.sender.fullName 
            ? message.sender.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
            : message.sender.username.substring(0, 2).toUpperCase();

        messageElement.innerHTML = `
            <div class="message-avatar" style="background: ${this.getAvatarColor(message.sender.id)}">
                ${senderInitials}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${message.sender.fullName || message.sender.username}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message.text)}</div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    displayPrivateMessage(message) {
        // For now, display in the main chat with a private indicator
        this.displayMessage({
            ...message,
            text: `[Private] ${message.text}`
        });
    }

    updateOnlineUsers(users) {
        this.activeUsers.clear();
        users.forEach(user => {
            this.activeUsers.set(user.userId, user);
        });

        const onlineUsersSection = document.getElementById('onlineUsers');
        if (!onlineUsersSection) return;

        const usersList = users.filter(user => user.userId !== this.currentUser?.id);
        
        if (usersList.length === 0) {
            onlineUsersSection.innerHTML = '<h4>Online Users</h4><p style="font-size: 12px; color: var(--text-secondary); padding: 0 0 12px 0;">No other users online</p>';
            return;
        }

        let usersHtml = '<h4>Online Users</h4>';
        usersList.forEach(user => {
            const initials = user.fullName 
                ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
                : user.username.substring(0, 2).toUpperCase();

            usersHtml += `
                <div class="chat-item" onclick="window.messenger.startPrivateChat('${user.userId}', '${user.fullName || user.username}')" data-user-id="${user.userId}">
                    <div class="chat-avatar">
                        <div class="user-avatar" style="background: ${this.getAvatarColor(user.userId)}">
                            ${initials}
                        </div>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${user.fullName || user.username}</div>
                        <div class="chat-preview">Online</div>
                    </div>
                </div>
            `;
        });

        onlineUsersSection.innerHTML = usersHtml;
        
        // Update member count
        const chatMembers = document.getElementById('currentChatMembers');
        if (chatMembers) {
            chatMembers.textContent = `Members: ${users.length}`;
        }
    }

    handleTyping() {
        if (!this.socket || !this.isConnected) return;

        this.socket.emit('typing', {
            roomId: this.currentRoom,
            isTyping: true
        });

        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.socket.emit('typing', {
                roomId: this.currentRoom,
                isTyping: false
            });
        }, 1000);
    }

    showTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (!typingIndicator) return;

        if (data.isTyping) {
            typingIndicator.innerHTML = `
                ${data.username} is typing
                <span class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
            `;
        } else {
            typingIndicator.innerHTML = '';
        }
    }

    startPrivateChat(userId, userName) {
        // This would typically open a private chat window or switch to a private room
        console.log('Starting private chat with:', userName);
        // For now, just show a notification
        if (window.app) {
            window.app.showNotification(`Private chat with ${userName} - Coming soon!`, 'info');
        }
    }

    filterChats(searchTerm) {
        const chatItems = document.querySelectorAll('.chat-item');
        const term = searchTerm.toLowerCase();

        chatItems.forEach(item => {
            const chatName = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
            const chatPreview = item.querySelector('.chat-preview')?.textContent.toLowerCase() || '';
            
            if (chatName.includes(term) || chatPreview.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    loadRoomMessages(roomId) {
        // For now, just clear and show a placeholder
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="date-separator">
                    <span>today</span>
                </div>
            `;
        }
    }

    switchChatTab(tabType) {
        // Update tab appearance
        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');

        // Filter chat list based on tab type
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const isGroup = item.hasAttribute('data-room');
            const isUser = item.hasAttribute('data-user-id');
            
            switch(tabType) {
                case 'all':
                    item.style.display = 'flex';
                    break;
                case 'groups':
                    item.style.display = isGroup ? 'flex' : 'none';
                    break;
                case 'direct':
                    item.style.display = isUser ? 'flex' : 'none';
                    break;
            }
        });
    }

    getAvatarColor(userId) {
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#fa709a', '#fee140',
            '#a8edea', '#fed6e3', '#ffecd2', '#fcb69f'
        ];
        
        const hash = userId.toString().split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        return colors[Math.abs(hash) % colors.length];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for HTML onclick handlers
window.selectChat = (roomId) => {
    if (window.messenger) {
        window.messenger.selectChat(roomId);
    }
};

window.sendMessage = () => {
    if (window.messenger) {
        window.messenger.sendMessage();
    }
};

window.switchChatTab = (tabType) => {
    if (window.messenger) {
        window.messenger.switchChatTab(tabType);
    }
};

window.startNewChat = () => {
    if (window.app) {
        window.app.showNotification('Start new chat - Coming soon!', 'info');
    }
};

window.toggleChatInfo = () => {
    if (window.app) {
        window.app.showNotification('Chat info - Coming soon!', 'info');
    }
};

window.copyChat = () => {
    if (window.app) {
        window.app.showNotification('Chat link copied to clipboard!', 'success');
    }
};

window.minimizeChat = () => {
    if (window.app) {
        window.app.showNotification('Minimize chat - Coming soon!', 'info');
    }
};

window.attachFile = () => {
    if (window.app) {
        window.app.showNotification('File attachment - Coming soon!', 'info');
    }
};

window.toggleEmojiPicker = () => {
    if (window.app) {
        window.app.showNotification('Emoji picker - Coming soon!', 'info');
    }
};

// Initialize messenger when the module loads
document.addEventListener('DOMContentLoaded', () => {
    window.messenger = new MessengerApp();
});
