import { Session, User, Message, Room } from '../models/index.js';
import { SOCKET_EVENTS } from '../utils/constants.js';
import { sanitizeMessage } from '../utils/helpers.js';

export const initializeSocket = (io) => {
  io.on(SOCKET_EVENTS.CONNECTION, async (socket) => {
    console.log('User connected:', socket.id);

    // User joins with username
    socket.on(SOCKET_EVENTS.USER_JOIN, async (username) => {
      await handleUserJoin(socket, username);
    });

    // Send message
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data) => {
      await handleSendMessage(socket, data);
    });

    // Private message
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data) => {
      await handlePrivateMessage(socket, data);
    });

    // Join room
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (roomName) => {
      await handleJoinRoom(socket, roomName);
    });

    // Typing indicators
    socket.on(SOCKET_EVENTS.USER_TYPING, async () => {
      await handleTypingStart(socket);
    });

    socket.on(SOCKET_EVENTS.USER_STOP_TYPING, async () => {
      await handleTypingStop(socket);
    });

    // Message reactions
    socket.on(SOCKET_EVENTS.MESSAGE_REACTION, async (data) => {
      await handleMessageReaction(socket, data);
    });

    // Disconnect
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      await handleDisconnect(socket);
    });
  });
};

async function handleUserJoin(socket, username) {
  try {
    // Update user status
    await User.findOneAndUpdate(
      { username },
      { online: true, status: 'online', lastSeen: new Date() }
    );

    // Create or update session
    await Session.findOneAndUpdate(
      { socketId: socket.id },
      {
        socketId: socket.id,
        username,
        currentRoom: 'general',
        connectedAt: new Date(),
        lastActivity: new Date()
      },
      { upsert: true }
    );

    // Join general room
    socket.join('general');

    // Get online users
    const sessions = await Session.find().select('username');
    const onlineUsers = [...new Set(sessions.map(session => session.username))];

    // Get rooms
    const rooms = await Room.find({ isArchived: false, isPrivate: false }).select('name description');

    // Get room messages
    const roomMessages = await Message.find({ room: 'general' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Notify client
    socket.emit('user_joined_success', {
      user: { username, online: true },
      onlineUsers,
      rooms: rooms.map(room => ({ name: room.name, description: room.description })),
      roomMessages: roomMessages.reverse()
    });

    // Notify others
    socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, username);
    socket.broadcast.emit('user_joined', `${username} joined the chat`);
    io.emit(SOCKET_EVENTS.ONLINE_USERS_UPDATE, onlineUsers);

  } catch (error) {
    console.error('User join error:', error);
    socket.emit('join_error', 'Failed to join chat');
  }
}

async function handleSendMessage(socket, data) {
  try {
    const session = await Session.findOne({ socketId: socket.id });
    if (!session) return;

    const messageData = {
      room: session.currentRoom,
      username: session.username,
      text: sanitizeMessage(data.text),
      type: 'message',
      timestamp: new Date()
    };

    const message = new Message(messageData);
    await message.save();

    const messagePayload = {
      id: message._id,
      username: message.username,
      text: message.text,
      timestamp: message.createdAt,
      room: message.room
    };

    io.to(session.currentRoom).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, messagePayload);

  } catch (error) {
    console.error('Send message error:', error);
  }
}

async function handlePrivateMessage(socket, data) {
  try {
    const fromSession = await Session.findOne({ socketId: socket.id });
    if (!fromSession) return;

    const toSession = await Session.findOne({ username: data.to });
    
    if (toSession) {
      const messageData = {
        room: 'private',
        username: fromSession.username,
        text: sanitizeMessage(data.text),
        type: 'private',
        privateTo: data.to,
        timestamp: new Date()
      };

      const message = new Message(messageData);
      await message.save();

      const messagePayload = {
        id: message._id,
        from: fromSession.username,
        text: message.text,
        timestamp: message.createdAt,
        isPrivate: true
      };

      // Send to recipient
      io.to(toSession.socketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, messagePayload);
      
      // Send confirmation to sender
      socket.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, { 
        ...messagePayload, 
        from: 'You',
        to: data.to
      });
    }
  } catch (error) {
    console.error('Private message error:', error);
  }
}

async function handleJoinRoom(socket, roomName) {
  try {
    const session = await Session.findOne({ socketId: socket.id });
    if (!session) return;

    socket.leave(session.currentRoom);
    socket.join(roomName);

    await Session.findOneAndUpdate(
      { socketId: socket.id },
      { currentRoom: roomName, lastActivity: new Date() }
    );

    const roomMessages = await Message.find({ room: roomName })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    socket.emit('room_joined', {
      room: roomName,
      messages: roomMessages.reverse()
    });

    io.to(roomName).emit('user_joined', `${session.username} joined ${roomName}`);
  } catch (error) {
    console.error('Join room error:', error);
  }
}

async function handleTypingStart(socket) {
  try {
    const session = await Session.findOne({ socketId: socket.id });
    if (session) {
      io.to(session.currentRoom).emit(SOCKET_EVENTS.USER_TYPING, {
        username: session.username,
        room: session.currentRoom
      });
    }
  } catch (error) {
    console.error('Typing start error:', error);
  }
}

async function handleTypingStop(socket) {
  try {
    const session = await Session.findOne({ socketId: socket.id });
    if (session) {
      io.to(session.currentRoom).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
        username: session.username,
        room: session.currentRoom
      });
    }
  } catch (error) {
    console.error('Typing stop error:', error);
  }
}

async function handleMessageReaction(socket, data) {
  try {
    await Message.findByIdAndUpdate(
      data.messageId,
      { $set: { [`reactions.${data.reaction}`]: (data.count || 1) } }
    );

    io.emit(SOCKET_EVENTS.MESSAGE_REACTION, {
      messageId: data.messageId,
      reaction: data.reaction,
      count: data.count
    });
  } catch (error) {
    console.error('Message reaction error:', error);
  }
}

async function handleDisconnect(socket) {
  try {
    const session = await Session.findOne({ socketId: socket.id });
    if (session) {
      await User.findOneAndUpdate(
        { username: session.username },
        { online: false, lastSeen: new Date() }
      );

      await Session.deleteOne({ socketId: socket.id });

      io.emit(SOCKET_EVENTS.USER_OFFLINE, session.username);
      io.emit(SOCKET_EVENTS.USER_DISCONNECTED, `${session.username} left the chat`);
    }
    console.log('User disconnected:', socket.id);
  } catch (error) {
    console.error('Disconnect error:', error);
  }
}