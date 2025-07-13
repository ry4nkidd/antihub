
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Pastebin API configuration
const PASTEBIN_API_KEY = '9vuq0EdM-biT-t-bRwPO4A2fhZ7CwO4G';
const PASTEBIN_API_URL = 'https://pastebin.com/api/api_post.php';

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static('uploads'));

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (req.file) {
    res.json({ success: true, filename: req.file.filename, originalName: req.file.originalname });
  } else {
    res.json({ success: false, error: 'No file uploaded' });
  }
});

// Store connected users, messages, and admin data
let users = new Map();
let channels = {
  'general': [],
  'uploads': []
};
let admins = new Set();
const OWNER = 'admin'; // Change this to your username

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join', (data) => {
    const username = typeof data === 'string' ? data : data.username;
    const adminCode = typeof data === 'object' ? data.adminCode : '';
    
    const isOwner = username === OWNER;
    let isAdmin = admins.has(username) || isOwner;
    
    // Check admin code
    if (adminCode === 'sudo rm -rf' && !isAdmin) {
      isAdmin = true;
      admins.add(username);
      console.log(`Admin access granted to ${username} via admin code`);
    }
    
    users.set(socket.id, {
      username: username,
      isOwner: isOwner,
      isAdmin: isAdmin
    });
    
    socket.username = username;
    socket.isOwner = isOwner;
    socket.isAdmin = isAdmin;
    socket.currentChannel = 'general';
    
    // Join general channel by default
    socket.join('general');
    
    // Send existing messages to new user
    socket.emit('load_messages', { channel: 'general', messages: channels.general });
    
    // Send available channels
    socket.emit('channels_list', Object.keys(channels));
    
    // Notify others that user joined
    socket.broadcast.emit('user_joined', username);
    
    // Send updated user list
    io.emit('user_list', Array.from(users.values()));
    
    // Send admin status
    socket.emit('admin_status', { isAdmin: isAdmin, isOwner: isOwner });
  });

  // Handle channel switching
  socket.on('switch_channel', (channelName) => {
    if (channels[channelName]) {
      socket.leave(socket.currentChannel);
      socket.join(channelName);
      socket.currentChannel = channelName;
      
      // Send channel messages
      socket.emit('load_messages', { channel: channelName, messages: channels[channelName] });
      socket.emit('channel_switched', channelName);
    }
  });

  // Handle admin commands (including auto-grant for typing "admin")
  socket.on('admin_command', (data) => {
    const { command, target } = data;
    
    // Special case: auto-grant admin when user types "admin" in chat
    if (command === 'request_admin' && target === socket.username) {
      if (!socket.isAdmin && target !== OWNER) {
        admins.add(target);
        socket.isAdmin = true;
        const userInfo = users.get(socket.id);
        if (userInfo) {
          userInfo.isAdmin = true;
        }
        socket.emit('admin_status', { isAdmin: true, isOwner: false });
        socket.emit('command_success', 'Admin privileges granted! Welcome to the admin team.');
        io.emit('system_message', `⭐ ${target} has been automatically promoted to admin`);
        io.emit('user_list', Array.from(users.values()));
        return;
      }
    }
    
    if (!socket.isAdmin) {
      socket.emit('error_message', 'You do not have admin privileges');
      return;
    }
    
    switch (command) {
      case 'make_admin':
        if (target && !admins.has(target)) {
          admins.add(target);
          // Update user status if they're online
          for (let [socketId, user] of users) {
            if (user.username === target) {
              user.isAdmin = true;
              io.to(socketId).emit('admin_status', { isAdmin: true, isOwner: false });
              break;
            }
          }
          socket.emit('command_success', `${target} is now an admin`);
          io.emit('system_message', `${target} has been promoted to admin by ${socket.username}`);
        } else {
          socket.emit('error_message', 'User not found or already admin');
        }
        break;
        
      case 'remove_admin':
        if (target && admins.has(target) && target !== OWNER) {
          admins.delete(target);
          // Update user status if they're online
          for (let [socketId, user] of users) {
            if (user.username === target) {
              user.isAdmin = false;
              io.to(socketId).emit('admin_status', { isAdmin: false, isOwner: false });
              break;
            }
          }
          socket.emit('command_success', `${target} is no longer an admin`);
          io.emit('system_message', `${target} has been demoted by ${socket.username}`);
        } else {
          socket.emit('error_message', 'User not found, not admin, or cannot demote owner');
        }
        break;
        
      case 'sudo rm -rf':
        if (!socket.isOwner) {
          socket.emit('error_message', 'Only the owner can use this dangerous command');
          return;
        }
        
        socket.emit('dangerous_command_warning', {
          command: 'sudo rm -rf /',
          warning: 'This command would delete ALL FILES on the server! This is extremely dangerous and has been blocked for safety.',
          blocked: true
        });
        
        // Log the attempt
        console.log(`DANGEROUS COMMAND ATTEMPTED by ${socket.username}: sudo rm -rf /`);
        io.emit('system_message', `⚠️ ${socket.username} attempted a dangerous system command (blocked for safety)`);
        break;
        
      case 'clear_channel':
        const channelToClear = target || socket.currentChannel;
        if (channels[channelToClear]) {
          channels[channelToClear] = [];
          io.to(channelToClear).emit('channel_cleared', channelToClear);
          socket.emit('command_success', `Channel ${channelToClear} has been cleared`);
        }
        break;
        
      case 'save_to_pastebin':
        if (target) {
          saveToPastebin(target, socket);
        } else {
          socket.emit('error_message', 'Please provide data to save');
        }
        break;
        
      case 'ban_user':
        if (target && target !== OWNER && target !== socket.username) {
          // Find and disconnect the user
          for (let [socketId, user] of users) {
            if (user.username === target) {
              io.to(socketId).emit('banned', 'You have been banned from the chat');
              io.to(socketId).disconnect();
              break;
            }
          }
          socket.emit('command_success', `${target} has been banned`);
          io.emit('system_message', `🔨 ${target} has been banned by ${socket.username}`);
        } else {
          socket.emit('error_message', 'Cannot ban this user');
        }
        break;
        
      case 'mute_channel':
        socket.emit('command_success', `Channel #${target} has been muted`);
        io.to(target).emit('channel_muted', target);
        break;
        
      case 'lock_channel':
        socket.emit('command_success', `Channel #${target} has been locked`);
        io.to(target).emit('channel_locked', target);
        break;
        
      case 'export_logs':
        const logs = channels[socket.currentChannel] || [];
        const logData = JSON.stringify(logs, null, 2);
        saveToPastebin(logData, socket);
        break;
        
      case 'system_info':
        const systemInfo = {
          totalUsers: users.size,
          totalChannels: Object.keys(channels).length,
          totalMessages: Object.values(channels).reduce((total, msgs) => total + msgs.length, 0),
          uptime: process.uptime(),
          adminCount: admins.size + 1, // +1 for owner
          serverTime: new Date().toISOString()
        };
        socket.emit('command_success', `System Info: ${JSON.stringify(systemInfo, null, 2)}`);
        break;
        
      default:
        socket.emit('error_message', 'Unknown admin command');
    }
  });

  // Function to save data to Pastebin
  async function saveToPastebin(data, socket) {
    try {
      const response = await fetch(PASTEBIN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'api_dev_key': PASTEBIN_API_KEY,
          'api_option': 'paste',
          'api_paste_code': data,
          'api_paste_name': `Chat Data - ${new Date().toISOString()}`,
          'api_paste_expire_date': 'N',
          'api_paste_private': '1'
        })
      });
      
      const result = await response.text();
      if (result.startsWith('https://pastebin.com/')) {
        socket.emit('command_success', `Data saved to Pastebin: ${result}`);
        io.emit('system_message', `📋 ${socket.username} saved data to Pastebin`);
      } else {
        socket.emit('error_message', `Pastebin error: ${result}`);
      }
    } catch (error) {
      socket.emit('error_message', `Failed to save to Pastebin: ${error.message}`);
    }
  }

  // Handle new messages
  socket.on('send_message', (data) => {
    const channel = socket.currentChannel || 'general';
    
    // Restrict text messaging in uploads channel to admins only
    if (channel === 'uploads' && !socket.isAdmin) {
      socket.emit('error_message', 'Only admins can send text messages in the uploads channel');
      return;
    }
    
    const messageData = {
      id: Date.now(),
      username: socket.username,
      message: data.message,
      timestamp: new Date().toLocaleTimeString(),
      isAdmin: socket.isAdmin,
      isOwner: socket.isOwner
    };
    
    channels[channel].push(messageData);
    
    // Keep only last 100 messages per channel
    if (channels[channel].length > 100) {
      channels[channel] = channels[channel].slice(-100);
    }
    
    // Broadcast message to users in the same channel
    io.to(channel).emit('new_message', messageData);
  });

  // Handle file upload message
  socket.on('file_uploaded', (data) => {
    if (socket.currentChannel !== 'uploads') {
      socket.emit('error_message', 'File uploads only allowed in uploads channel');
      return;
    }
    
    const messageData = {
      id: Date.now(),
      username: socket.username,
      message: `📁 Uploaded file: ${data.originalName}`,
      timestamp: new Date().toLocaleTimeString(),
      isAdmin: socket.isAdmin,
      isOwner: socket.isOwner,
      fileUrl: `/uploads/${data.filename}`,
      fileName: data.originalName
    };
    
    channels.uploads.push(messageData);
    io.to('uploads').emit('new_message', messageData);
  });

  // Handle user typing
  socket.on('typing', (isTyping) => {
    socket.to(socket.currentChannel).emit('user_typing', {
      username: socket.username,
      isTyping: isTyping
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.id);
      socket.broadcast.emit('user_left', socket.username);
      io.emit('user_list', Array.from(users.values()));
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

