const socketIO = require('socket.io');
const appConfig = require('../config/app.config');
const { isOriginAllowed } = require('../middlewares/cors.middleware');

let io;
const activeRooms = new Map(); // roomId -> { participants: [...] }
const globalActiveUsers = new Map(); // userId -> socketId

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: (origin, callback) => {
        const allowed = isOriginAllowed(
          origin,
          appConfig.server.allowedOrigins,
          appConfig.isDevelopment || appConfig.isTest
        );
        if (allowed) {
          return callback(null, true);
        }
        return callback(new Error(`Socket.IO CORS blocked origin: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Usuario conectado al WebSocket:', socket.id);

    // Registro global de usuario para notificaciones
    socket.on('register-user', (userId) => {
      if (userId) {
        globalActiveUsers.set(userId.toString(), socket.id);
        console.log(`📡 Usuario ${userId} registrado globalmente en socket ${socket.id}`);
      }
    });

    // Notificar llamada entrante (Doctor -> Paciente)
    socket.on('initiate-call', ({ toUserId, fromName, roomId, consultationId }) => {
      const targetSocketId = globalActiveUsers.get(toUserId.toString());
      if (targetSocketId) {
        console.log(`📞 Notificando llamada de ${fromName} a usuario ${toUserId}`);
        io.to(targetSocketId).emit('incoming-call', {
          fromName,
          roomId,
          consultationId
        });
      } else {
        console.log(`📵 Usuario ${toUserId} no está en línea para recibir la llamada`);
      }
    });

    // Usuario se une a una sala de videoconsulta
    socket.on('join-room', ({ roomId, userId, userType }) => {
      socket.join(roomId);
      
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, { participants: [] });
      }
      
      const room = activeRooms.get(roomId);
      room.participants.push({ socketId: socket.id, userId, userType });
      
      console.log(`👤 ${userType} (ID: ${userId}) se unió a sala ${roomId}`);
      console.log(`📊 Participantes en sala: ${room.participants.length}`);
      
      // Notificar a otros participantes que alguien se unió
      socket.to(roomId).emit('user-joined', { userId, userType });
      
      // Si ya hay 2 personas en la sala, están listos para conectar
      if (room.participants.length === 2) {
        console.log('✅ Sala completa, listos para conectar');
        io.to(roomId).emit('ready-to-connect');
      }
    });

    // Señalización WebRTC - Offer (iniciador)
    socket.on('offer', ({ roomId, offer }) => {
      console.log('📤 Enviando offer a sala:', roomId);
      socket.to(roomId).emit('offer', offer);
    });

    // Señalización WebRTC - Answer (receptor)
    socket.on('answer', ({ roomId, answer }) => {
      console.log('📤 Enviando answer a sala:', roomId);
      socket.to(roomId).emit('answer', answer);
    });

    // Señalización WebRTC - ICE Candidates
    socket.on('ice-candidate', ({ roomId, candidate }) => {
      console.log('🧊 Enviando ICE candidate a sala:', roomId);
      socket.to(roomId).emit('ice-candidate', candidate);
    });

    // Usuario sale de la sala
    socket.on('leave-room', ({ roomId }) => {
      console.log(`👋 Usuario salió de sala: ${roomId}`);
      socket.leave(roomId);
      socket.to(roomId).emit('user-left');
      
      const room = activeRooms.get(roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        if (room.participants.length === 0) {
          activeRooms.delete(roomId);
          console.log(`🗑️ Sala ${roomId} eliminada (vacía)`);
        }
      }
    });

    // Desconexión del socket
    socket.on('disconnect', () => {
      console.log('❌ Usuario desconectado:', socket.id);
      
      // Limpiar de la lista global de usuarios activos
      globalActiveUsers.forEach((socketId, userId) => {
        if (socketId === socket.id) {
          globalActiveUsers.delete(userId);
          console.log(`📤 Usuario ${userId} eliminado del registro global`);
        }
      });
      
      // Limpiar de todas las salas
      activeRooms.forEach((room, roomId) => {
        const wasInRoom = room.participants.some(p => p.socketId === socket.id);
        
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        
        if (wasInRoom) {
          io.to(roomId).emit('user-left');
        }
        
        if (room.participants.length === 0) {
          activeRooms.delete(roomId);
          console.log(`🗑️ Sala ${roomId} eliminada (vacía)`);
        }
      });
    });
  });

  console.log('🎥 Servidor WebSocket inicializado para videoconsultas');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado. Llama a initializeSocket() primero.');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
