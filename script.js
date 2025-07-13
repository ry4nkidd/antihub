
class AntiBloxChat {
    constructor() {
        this.currentUser = '';
        this.currentRole = 'Member';
        this.currentChannel = 'general';
        this.hasAdminCode = false;
        this.isAuthenticated = false;
        this.messages = {
            general: [],
            uploads: [],
            nsfw: [],
            gaming: [],
            announcements: []
        };
        this.onlineUsers = new Map();
        this.userColors = {};
        this.bannedUsers = new Set(JSON.parse(localStorage.getItem('antiblox_banned_users') || '[]'));
        this.userAccounts = new Map(JSON.parse(localStorage.getItem('antiblox_accounts') || '[]'));
        
        this.channelDescriptions = {
            general: 'General discussion and community chat',
            uploads: 'Share your files, images, and media content',
            nsfw: 'Adult content channel - 18+ only',
            gaming: 'Discuss games, strategies, and find teammates',
            announcements: 'Important server announcements and updates'
        };

        this.initializeElements();
        this.bindEvents();
        this.showLandingPage();
        this.loadSettings();
    }

    initializeElements() {
        // Landing page elements
        this.landingPage = document.getElementById('landing-page');
        this.showLoginBtn = document.getElementById('show-login');
        this.showRegisterBtn = document.getElementById('show-register');
        
        // Auth modal elements
        this.loginModal = document.getElementById('login-modal');
        this.registerModal = document.getElementById('register-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        
        // Auth inputs
        this.loginUsername = document.getElementById('login-username');
        this.loginPassword = document.getElementById('login-password');
        this.loginAdminCode = document.getElementById('login-admin-code');
        this.registerUsername = document.getElementById('register-username');
        this.registerEmail = document.getElementById('register-email');
        this.registerPassword = document.getElementById('register-password');
        this.registerConfirmPassword = document.getElementById('register-confirm-password');
        this.registerAdminCode = document.getElementById('register-admin-code');
        
        // Chat app elements
        this.chatApp = document.getElementById('chat-app');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.messagesContainer = document.getElementById('messages');
        this.currentServerElement = document.getElementById('current-server');
        this.channelDescription = document.getElementById('channel-description');
        this.currentUsernameElement = document.getElementById('current-username');
        this.currentRoleElement = document.getElementById('current-role');
        this.onlineUsersElement = document.getElementById('online-users');
        this.userCountElement = document.getElementById('user-count');
        this.logoutBtn = document.getElementById('logout-btn');
        
        // UI elements
        this.emojiButtons = document.querySelectorAll('.emoji-btn');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.serverButtons = document.querySelectorAll('.server');
        this.memberListBtn = document.getElementById('member-list-btn');
        this.banUserBtn = document.getElementById('ban-user-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        
        // Modals
        this.memberModal = document.getElementById('member-modal');
        this.banModal = document.getElementById('ban-modal');
        this.settingsModal = document.getElementById('settings-modal');
        this.memberListContent = document.getElementById('member-list-content');
        
        // Typing indicator
        this.typingIndicator = document.getElementById('typing-indicator');
        this.typingTimeout = null;
    }

    bindEvents() {
        // Landing page events
        this.showLoginBtn?.addEventListener('click', () => this.showLoginModal());
        this.showRegisterBtn?.addEventListener('click', () => this.showRegisterModal());
        
        // Auth form events
        this.loginForm?.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm?.addEventListener('submit', (e) => this.handleRegister(e));
        
        // Modal switching
        document.getElementById('switch-to-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideLoginModal();
            this.showRegisterModal();
        });
        
        document.getElementById('switch-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideRegisterModal();
            this.showLoginModal();
        });
        
        // Close modal events
        document.getElementById('close-login')?.addEventListener('click', () => this.hideLoginModal());
        document.getElementById('close-register')?.addEventListener('click', () => this.hideRegisterModal());
        document.getElementById('close-members')?.addEventListener('click', () => this.hideMemberModal());
        document.getElementById('cancel-ban')?.addEventListener('click', () => this.hideBanModal());
        document.getElementById('close-settings')?.addEventListener('click', () => this.hideSettingsModal());
        
        // Chat events
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        this.messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            } else {
                this.handleTyping();
            }
        });
        
        this.logoutBtn?.addEventListener('click', () => this.logout());
        
        // Emoji buttons
        this.emojiButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.messageInput.value += btn.dataset.emoji;
                this.messageInput.focus();
            });
        });
        
        // Channel switching
        this.serverButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                const channel = btn.dataset.server;
                this.switchChannel(channel);
            });
        });
        
        // UI actions
        this.memberListBtn?.addEventListener('click', () => this.showMemberModal());
        this.banUserBtn?.addEventListener('click', () => this.showBanModal());
        this.settingsBtn?.addEventListener('click', () => this.showSettingsModal());
        this.clearChatBtn?.addEventListener('click', () => this.clearChat());
        
        document.getElementById('confirm-ban')?.addEventListener('click', () => this.banUser());
        
        // Click outside to close modals
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });
        
        // Settings events
        document.getElementById('theme-select')?.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });
        
        document.getElementById('sound-notifications')?.addEventListener('change', (e) => {
            this.toggleSoundNotifications(e.target.checked);
        });
        
        document.getElementById('desktop-notifications')?.addEventListener('change', (e) => {
            this.toggleDesktopNotifications(e.target.checked);
        });
    }

    // Authentication Methods
    showLandingPage() {
        this.landingPage.style.display = 'flex';
        this.chatApp.style.display = 'none';
    }

    showLoginModal() {
        this.loginModal.style.display = 'flex';
        this.loginModal.classList.add('show');
        this.loginUsername?.focus();
    }

    hideLoginModal() {
        this.loginModal.style.display = 'none';
        this.loginModal.classList.remove('show');
    }

    showRegisterModal() {
        this.registerModal.style.display = 'flex';
        this.registerModal.classList.add('show');
        this.registerUsername?.focus();
    }

    hideRegisterModal() {
        this.registerModal.style.display = 'none';
        this.registerModal.classList.remove('show');
    }

    hideAllModals() {
        this.hideLoginModal();
        this.hideRegisterModal();
        this.hideMemberModal();
        this.hideBanModal();
        this.hideSettingsModal();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = this.loginUsername.value.trim();
        const password = this.loginPassword.value.trim();
        const adminCode = this.loginAdminCode.value.trim();
        
        if (!username || !password) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Check if user exists and password matches
        const userKey = username.toLowerCase();
        const userData = this.userAccounts.get(userKey);
        
        if (!userData || userData.password !== password) {
            this.showNotification('Invalid username or password', 'error');
            return;
        }
        
        // Check if user is banned
        if (this.bannedUsers.has(userKey)) {
            this.showNotification('Your account has been banned', 'error');
            return;
        }
        
        await this.authenticateUser(username, userData.email, adminCode);
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = this.registerUsername.value.trim();
        const email = this.registerEmail.value.trim();
        const password = this.registerPassword.value.trim();
        const confirmPassword = this.registerConfirmPassword.value.trim();
        const adminCode = this.registerAdminCode.value.trim();
        
        if (!username || !email || !password || !confirmPassword) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        const userKey = username.toLowerCase();
        
        // Check if username already exists
        if (this.userAccounts.has(userKey)) {
            this.showNotification('Username already exists', 'error');
            return;
        }
        
        // Create new account
        const userData = {
            username: username,
            email: email,
            password: password,
            registeredAt: new Date().toISOString()
        };
        
        this.userAccounts.set(userKey, userData);
        this.saveAccounts();
        
        this.showNotification('Account created successfully!', 'success');
        
        await this.authenticateUser(username, email, adminCode);
    }

    async authenticateUser(username, email, adminCode) {
        let role = 'Member';
        this.hasAdminCode = false;
        
        // Check admin codes
        if (adminCode === 'freenode..m4sk') {
            role = 'Admin';
            this.hasAdminCode = true;
        } else if (adminCode === 'modpass123') {
            role = 'Moderator';
            this.hasAdminCode = true;
        } else if (adminCode === 'vipcode456') {
            role = 'VIP';
        }
        
        this.currentUser = username;
        this.currentRole = role;
        this.isAuthenticated = true;
        
        this.hideAllModals();
        this.showChatApp();
        
        this.userColors[username] = this.generateUserColor();
        this.onlineUsers.set(username, {
            role: role,
            email: email,
            color: this.userColors[username],
            lastSeen: Date.now(),
            hasAdminCode: this.hasAdminCode
        });
        
        this.updateUserInterface();
        this.addSystemMessage(`${username} joined as ${role}! 🎮`);
        this.updateOnlineUsers();
        this.messageInput?.focus();
        
        this.showNotification(`Welcome back, ${username}!`, 'success');
        
        // Auto-sync every 30 seconds
        setInterval(() => {
            this.syncData();
        }, 30000);
    }

    showChatApp() {
        this.landingPage.style.display = 'none';
        this.chatApp.style.display = 'flex';
    }

    logout() {
        this.isAuthenticated = false;
        this.currentUser = '';
        this.currentRole = 'Member';
        this.hasAdminCode = false;
        this.onlineUsers.clear();
        
        this.chatApp.style.display = 'none';
        this.showLandingPage();
        
        this.showNotification('Logged out successfully', 'info');
    }

    updateUserInterface() {
        if (this.currentUsernameElement) {
            this.currentUsernameElement.textContent = this.currentUser;
        }
        if (this.currentRoleElement) {
            this.currentRoleElement.textContent = this.currentRole;
        }
        
        const avatar = document.getElementById('sidebar-avatar');
        if (avatar && this.currentUser) {
            avatar.innerHTML = this.currentUser.charAt(0).toUpperCase();
            avatar.style.background = this.userColors[this.currentUser] || '#7289da';
        }
        
        this.updateMessageInputState();
    }

    updateMessageInputState() {
        if (!this.messageInput) return;
        
        if (this.currentChannel === 'uploads' && !this.hasAdminCode) {
            this.messageInput.placeholder = 'Only users with admin codes can type here...';
            this.messageInput.disabled = true;
            this.messageInput.style.opacity = '0.6';
            
            if (this.sendBtn) {
                this.sendBtn.disabled = true;
                this.sendBtn.style.opacity = '0.6';
            }
        } else {
            this.messageInput.placeholder = 'Type your message...';
            this.messageInput.disabled = false;
            this.messageInput.style.opacity = '1';
            
            if (this.sendBtn) {
                this.sendBtn.disabled = false;
                this.sendBtn.style.opacity = '1';
            }
        }
    }

    // Chat functionality
    switchChannel(channel) {
        this.currentChannel = channel;
        
        const channelIcon = {
            general: 'fas fa-comments',
            uploads: 'fas fa-upload',
            nsfw: 'fas fa-exclamation-triangle',
            gaming: 'fas fa-gamepad',
            announcements: 'fas fa-bullhorn'
        };
        
        if (this.currentServerElement) {
            this.currentServerElement.innerHTML = `
                <i class="${channelIcon[channel] || 'fas fa-hashtag'}"></i>
                ${channel}
            `;
        }
        
        if (this.channelDescription) {
            this.channelDescription.textContent = this.channelDescriptions[channel] || '';
        }
        
        // Update active channel
        this.serverButtons?.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.server === channel) {
                btn.classList.add('active');
            }
        });
        
        // Update message input placeholder based on channel permissions
        this.updateMessageInputState();
        
        this.renderMessages();
    }

    async sendMessage() {
        let text = this.messageInput?.value.trim();
        if (!text || !this.isAuthenticated) return;
        
        // Check if user is banned
        if (this.bannedUsers.has(this.currentUser.toLowerCase())) {
            this.showNotification('You have been banned from this server', 'error');
            return;
        }
        
        // Check if user can type in uploads channel
        if (this.currentChannel === 'uploads' && !this.hasAdminCode) {
            this.showNotification('Only users with admin codes can type in uploads channel', 'error');
            return;
        }
        
        // Auto-delete admin codes from messages
        const adminCodes = ['freenode..m4sk', 'modpass123', 'vipcode456'];
        adminCodes.forEach(code => {
            if (text.includes(code)) {
                text = text.replace(new RegExp(code, 'gi'), '[ADMIN CODE REMOVED]');
            }
        });
        
        const message = {
            id: Date.now(),
            username: this.currentUser,
            role: this.currentRole,
            text: text,
            timestamp: new Date().toISOString(),
            channel: this.currentChannel
        };
        
        this.messages[this.currentChannel].push(message);
        this.addMessageToDOM(message);
        this.messageInput.value = '';
        this.scrollToBottom();
        
        // Play notification sound
        this.playNotificationSound();
        
        // Hide typing indicator
        this.hideTypingIndicator();
    }

    addMessageToDOM(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const userColor = this.userColors[message.username] || '#7289da';
        const roleColor = this.getRoleColor(message.role);
        const roleIcon = this.getRoleIcon(message.role);
        const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageElement.innerHTML = `
            <div class="message-avatar" style="background: ${userColor}">
                ${message.username.charAt(0).toUpperCase()}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username" style="color: ${userColor}">${message.username}</span>
                    <span class="message-role" style="color: ${roleColor}">${roleIcon} ${message.role}</span>
                    <span class="message-timestamp">${time}</span>
                </div>
                <div class="message-text">${this.formatMessage(message.text)}</div>
            </div>
        `;
        
        this.messagesContainer?.appendChild(messageElement);
    }

    formatMessage(text) {
        // Convert URLs to links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent-color);">$1</a>');
        
        // Convert @mentions to highlights
        text = text.replace(/@(\w+)/g, '<span style="background: var(--accent-color); color: white; padding: 0.125rem 0.375rem; border-radius: 0.25rem;">@$1</span>');
        
        return text;
    }

    addSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        messageElement.innerHTML = `<i class="fas fa-info-circle"></i> ${text}`;
        this.messagesContainer?.appendChild(messageElement);
        this.scrollToBottom();
    }

    renderMessages() {
        if (!this.messagesContainer) return;
        
        this.messagesContainer.innerHTML = '';
        const currentMessages = this.messages[this.currentChannel] || [];
        
        if (currentMessages.length === 0) {
            this.showWelcomeMessage();
        } else {
            currentMessages.forEach(message => {
                this.addMessageToDOM(message);
            });
        }
        
        this.scrollToBottom();
    }

    showWelcomeMessage() {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'welcome-message';
        
        const channelInfo = {
            general: {
                icon: 'fas fa-rocket',
                title: 'Welcome to General Chat!',
                description: 'Connect with the Roblox community. Share experiences, trade items, and make new friends!'
            },
            uploads: {
                icon: 'fas fa-upload',
                title: 'Welcome to Uploads!',
                description: 'Share your files, images, and media content with the community.'
            },
            nsfw: {
                icon: 'fas fa-exclamation-triangle',
                title: 'Welcome to NSFW Channel!',
                description: '18+ content only. Please be respectful and follow community guidelines.'
            },
            gaming: {
                icon: 'fas fa-gamepad',
                title: 'Welcome to Gaming Chat!',
                description: 'Discuss games, share strategies, find teammates, and talk about your favorite titles.'
            },
            announcements: {
                icon: 'fas fa-bullhorn',
                title: 'Server Announcements',
                description: 'Important updates, news, and announcements from the server staff.'
            }
        };
        
        const info = channelInfo[this.currentChannel] || channelInfo.general;
        
        welcomeMsg.innerHTML = `
            <div class="welcome-icon">
                <i class="${info.icon}"></i>
            </div>
            <h3>${info.title}</h3>
            <p>${info.description}</p>
        `;
        
        this.messagesContainer?.appendChild(welcomeMsg);
    }

    // User management
    updateOnlineUsers() {
        if (!this.onlineUsersElement || !this.userCountElement) return;
        
        this.onlineUsersElement.innerHTML = '';
        
        // Update user count
        this.userCountElement.textContent = this.onlineUsers.size;
        
        // Add current user first
        if (this.currentUser) {
            const userElement = this.createUserElement(this.currentUser, this.currentRole, true);
            this.onlineUsersElement.appendChild(userElement);
        }
        
        // Add other users
        this.onlineUsers.forEach((userData, username) => {
            if (username !== this.currentUser) {
                const userElement = this.createUserElement(username, userData.role, false);
                this.onlineUsersElement.appendChild(userElement);
            }
        });
    }

    createUserElement(username, role, isCurrentUser) {
        const userElement = document.createElement('div');
        userElement.className = 'user';
        
        const color = this.userColors[username] || '#7289da';
        const roleColor = this.getRoleColor(role);
        const roleIcon = this.getRoleIcon(role);
        const displayName = isCurrentUser ? 'You' : username;
        
        userElement.innerHTML = `
            <div class="user-avatar" style="background: ${color}">
                ${username.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
                <span class="user-name">${displayName}</span>
                <span class="user-role-badge" style="color: ${roleColor}">${roleIcon} ${role}</span>
            </div>
            <span class="user-status online">
                <i class="fas fa-circle"></i>
            </span>
        `;
        
        return userElement;
    }

    // Modal management
    showMemberModal() {
        if (!this.memberModal || !this.memberListContent) return;
        
        this.memberListContent.innerHTML = '';
        
        const memberCount = document.createElement('p');
        memberCount.textContent = `Total Members: ${this.onlineUsers.size}`;
        memberCount.style.marginBottom = '15px';
        memberCount.style.color = 'var(--secondary-text)';
        this.memberListContent.appendChild(memberCount);
        
        // Add current user
        const currentUserElement = this.createMemberListItem(this.currentUser, this.currentRole, true);
        this.memberListContent.appendChild(currentUserElement);
        
        // Add other users
        this.onlineUsers.forEach((userData, username) => {
            if (username !== this.currentUser) {
                const memberElement = this.createMemberListItem(username, userData.role, false);
                this.memberListContent.appendChild(memberElement);
            }
        });
        
        this.memberModal.style.display = 'flex';
    }

    hideMemberModal() {
        if (this.memberModal) {
            this.memberModal.style.display = 'none';
        }
    }

    createMemberListItem(username, role, isCurrentUser) {
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        
        const color = this.userColors[username] || '#7289da';
        const roleColor = this.getRoleColor(role);
        const roleIcon = this.getRoleIcon(role);
        const displayName = isCurrentUser ? `${username} (You)` : username;
        
        memberElement.innerHTML = `
            <div class="member-avatar" style="background: ${color}">
                ${username.charAt(0).toUpperCase()}
            </div>
            <div class="member-info">
                <span class="member-name">${displayName}</span>
                <span class="member-role" style="color: ${roleColor}">${roleIcon} ${role}</span>
            </div>
        `;
        
        return memberElement;
    }

    showBanModal() {
        if (this.currentRole !== 'Admin' && this.currentRole !== 'Moderator') {
            this.showNotification('Only Admins and Moderators can ban users', 'error');
            return;
        }
        if (this.banModal) {
            this.banModal.style.display = 'flex';
        }
    }

    hideBanModal() {
        if (this.banModal) {
            this.banModal.style.display = 'none';
        }
    }

    showSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.style.display = 'flex';
        }
    }

    hideSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.style.display = 'none';
        }
    }

    async banUser() {
        const banUsernameInput = document.getElementById('ban-username-input');
        const banReasonInput = document.getElementById('ban-reason-input');
        
        if (!banUsernameInput || !banReasonInput) return;
        
        const usernameToBan = banUsernameInput.value.trim().toLowerCase();
        const reason = banReasonInput.value.trim() || 'No reason provided';
        
        if (!usernameToBan) {
            this.showNotification('Please enter a username to ban', 'error');
            return;
        }
        
        if (usernameToBan === this.currentUser.toLowerCase()) {
            this.showNotification('You cannot ban yourself', 'error');
            return;
        }
        
        this.bannedUsers.add(usernameToBan);
        try {
            localStorage.setItem('antiblox_banned_users', JSON.stringify([...this.bannedUsers]));
        } catch (error) {
            console.warn('Failed to save banned users to localStorage:', error);
        }
        
        // Remove banned user from online users
        this.onlineUsers.delete(usernameToBan);
        this.updateOnlineUsers();
        
        this.addSystemMessage(`${usernameToBan} was banned by ${this.currentUser}. Reason: ${reason} 🔨`);
        
        this.hideBanModal();
        banUsernameInput.value = '';
        banReasonInput.value = '';
        
        this.showNotification(`User ${usernameToBan} has been banned`, 'success');
    }

    async clearChat() {
        if (this.currentRole !== 'Moderator' && this.currentRole !== 'Admin') {
            this.showNotification('Only Moderators and Admins can clear chat', 'error');
            return;
        }
        
        this.messages[this.currentChannel] = [];
        this.renderMessages();
        this.addSystemMessage(`Chat cleared by ${this.currentUser} 🧹`);
        this.showNotification('Chat cleared successfully', 'success');
    }

    // Utility methods
    generateUserColor() {
        const colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
            '#1abc9c', '#34495e', '#e67e22', '#f1c40f', '#8e44ad'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getRoleColor(role) {
        const roleColors = {
            'Member': '#8e9297',
            'VIP': '#f1c40f',
            'Moderator': '#e67e22',
            'Admin': '#e74c3c'
        };
        return roleColors[role] || '#8e9297';
    }

    getRoleIcon(role) {
        const roleIcons = {
            'Member': '👤',
            'VIP': '⭐',
            'Moderator': '🛡️',
            'Admin': '👑'
        };
        return roleIcons[role] || '👤';
    }

    handleTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.showTypingIndicator();
        
        this.typingTimeout = setTimeout(() => {
            this.hideTypingIndicator();
        }, 3000);
    }

    showTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--secondary-bg);
            color: var(--primary-text);
            padding: 1rem 1.5rem;
            border-radius: var(--radius);
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        const colors = {
            success: 'var(--success-color)',
            error: 'var(--warning-color)',
            info: 'var(--accent-color)'
        };
        
        notification.style.borderLeftColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    playNotificationSound() {
        const soundEnabled = localStorage.getItem('antiblox_sound_notifications') !== 'false';
        if (soundEnabled) {
            // Create a simple notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    }

    // Settings
    loadSettings() {
        let theme, soundNotifications, desktopNotifications;
        try {
            theme = localStorage.getItem('antiblox_theme') || 'dark';
            soundNotifications = localStorage.getItem('antiblox_sound_notifications') !== 'false';
            desktopNotifications = localStorage.getItem('antiblox_desktop_notifications') === 'true';
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
            theme = 'dark';
            soundNotifications = true;
            desktopNotifications = false;
        }
        
        const themeSelect = document.getElementById('theme-select');
        const soundCheckbox = document.getElementById('sound-notifications');
        const desktopCheckbox = document.getElementById('desktop-notifications');
        
        if (themeSelect) themeSelect.value = theme;
        if (soundCheckbox) soundCheckbox.checked = soundNotifications;
        if (desktopCheckbox) desktopCheckbox.checked = desktopNotifications;
        
        this.changeTheme(theme);
    }

    changeTheme(theme) {
        localStorage.setItem('antiblox_theme', theme);
        // Theme implementation would go here
    }

    toggleSoundNotifications(enabled) {
        localStorage.setItem('antiblox_sound_notifications', enabled.toString());
    }

    toggleDesktopNotifications(enabled) {
        localStorage.setItem('antiblox_desktop_notifications', enabled.toString());
        if (enabled) {
            Notification.requestPermission();
        }
    }

    saveAccounts() {
        try {
            const accountsArray = Array.from(this.userAccounts.entries());
            localStorage.setItem('antiblox_accounts', JSON.stringify(accountsArray));
        } catch (error) {
            console.warn('Failed to save accounts to localStorage:', error);
            this.showNotification('Failed to save user data', 'error');
        }
    }

    syncData() {
        // Placeholder for data synchronization
        console.log('Syncing data...');
    }
}

// CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification {
        animation: slideIn 0.3s ease-out;
        border-left: 4px solid var(--accent-color);
    }
`;
document.head.appendChild(notificationStyles);

// Initialize the chat app
document.addEventListener('DOMContentLoaded', () => {
    new AntiBloxChat();
});
