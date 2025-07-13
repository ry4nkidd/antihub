
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(__dirname));

// Store connected users and their data
const connectedUsers = new Map();
const channels = {
    general: [],
    uploads: [],
    nsfw: [],
    gaming: [],
    announcements: []
};
const bannedUsers = new Set();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user authentication
    socket.on('authenticate', (userData) => {
        const { username, role, hasAdminCode, email } = userData;
        
        // Check if user is banned
        if (bannedUsers.has(username.toLowerCase())) {
            socket.emit('banned', { message: 'You have been banned from this server' });
            return;
        }

        // Store user data
        connectedUsers.set(socket.id, {
            username,
            role,
            hasAdminCode,
            email,
            socketId: socket.id,
            currentChannel: 'general'
        });

        // Join default channel
        socket.join('general');

        // Send current online users
        const onlineUsers = Array.from(connectedUsers.values()).map(user => ({
            username: user.username,
            role: user.role,
            hasAdminCode: user.hasAdminCode
        }));

        // Broadcast user joined
        io.emit('user_joined', {
            username,
            role,
            onlineUsers
        });

        // Send channel history to new user
        socket.emit('channel_history', {
            channel: 'general',
            messages: channels.general.slice(-50) // Last 50 messages
        });

        console.log(`${username} authenticated as ${role}`);
    });

    // Handle channel switching
    socket.on('switch_channel', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const { channel } = data;
        
        // Leave current channel
        socket.leave(user.currentChannel);
        
        // Join new channel
        socket.join(channel);
        user.currentChannel = channel;

        // Send channel history
        socket.emit('channel_history', {
            channel,
            messages: channels[channel]?.slice(-50) || []
        });
    });

    // Handle new messages
    socket.on('send_message', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const { text, channel } = data;
        
        // Check if user is banned
        if (bannedUsers.has(user.username.toLowerCase())) {
            socket.emit('message_error', { message: 'You have been banned' });
            return;
        }

        const message = {
            id: Date.now(),
            username: user.username,
            role: user.role,
            text,
            timestamp: new Date().toISOString(),
            channel
        };

        // Store message
        if (!channels[channel]) channels[channel] = [];
        channels[channel].push(message);

        // Keep only last 100 messages per channel
        if (channels[channel].length > 100) {
            channels[channel] = channels[channel].slice(-100);
        }

        // Broadcast message to channel
        io.to(channel).emit('new_message', message);
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        socket.to(user.currentChannel).emit('user_typing', {
            username: user.username,
            channel: data.channel
        });
    });

    socket.on('stop_typing', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        socket.to(user.currentChannel).emit('user_stop_typing', {
            username: user.username,
            channel: data.channel
        });
    });

    // Handle user ban (admin/moderator only)
    socket.on('ban_user', (data) => {
        const adminUser = connectedUsers.get(socket.id);
        if (!adminUser || (adminUser.role !== 'Admin' && adminUser.role !== 'Moderator')) {
            socket.emit('error', { message: 'Insufficient permissions' });
            return;
        }

        const { username, reason } = data;
        const usernameLower = username.toLowerCase();
        
        bannedUsers.add(usernameLower);

        // Find and disconnect banned user
        for (const [socketId, userData] of connectedUsers.entries()) {
            if (userData.username.toLowerCase() === usernameLower) {
                io.to(socketId).emit('banned', { message: `You have been banned. Reason: ${reason}` });
                io.sockets.sockets.get(socketId)?.disconnect();
                break;
            }
        }

        // Broadcast ban message
        io.emit('system_message', {
            text: `${username} was banned by ${adminUser.username}. Reason: ${reason} 🔨`,
            timestamp: new Date().toISOString()
        });
    });

    // Handle clear chat (moderator/admin only)
    socket.on('clear_chat', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user || (user.role !== 'Admin' && user.role !== 'Moderator')) {
            socket.emit('error', { message: 'Insufficient permissions' });
            return;
        }

        const { channel } = data;
        channels[channel] = [];

        io.to(channel).emit('chat_cleared', { channel });
        io.to(channel).emit('system_message', {
            text: `Chat cleared by ${user.username} 🧹`,
            timestamp: new Date().toISOString()
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            connectedUsers.delete(socket.id);
            
            const onlineUsers = Array.from(connectedUsers.values()).map(user => ({
                username: user.username,
                role: user.role,
                hasAdminCode: user.hasAdminCode
            }));

            io.emit('user_left', {
                username: user.username,
                onlineUsers
            });

            console.log(`${user.username} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
