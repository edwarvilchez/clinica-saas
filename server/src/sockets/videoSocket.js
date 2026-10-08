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

    // Usuario se une a una sala de videoconsulta con token criptográfico (Anti-Eavesdropping Guard)
    socket.on('join-room-secure', ({ roomId, roomToken }) => {
      try {
        const telemedicineService = require('../services/telemedicine.service');
        const tokenData = telemedicineService.verifyRoomAccessToken(roomToken, roomId);

        // Guard against room capacity overflow (max 2 participants: Doctor + Paciente)
        const currentRoom = activeRooms.get(roomId);
        if (currentRoom && currentRoom.participants.length >= 2) {
          socket.emit('room-error', { code: 'ROOM_FULL', message: 'La sala de videoconsulta ya está completa (máximo 2 participantes autorizados).' });
          return;
        }

        socket.join(roomId);
        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, { participants: [] });
        }

        const room = activeRooms.get(roomId);
        room.participants.push({
          socketId: socket.id,
          userId: tokenData.userId,
          userType: tokenData.participantType,
          organizationId: tokenData.organizationId
        });

        console.log(`🔒 [Telemedicina] ${tokenData.participantType} admitido con token seguro en sala ${roomId}`);

        socket.emit('room-admitted', {
          roomId,
          participantType: tokenData.participantType,
          participantsCount: room.participants.length
        });

        socket.to(roomId).emit('user-joined', {
          userId: tokenData.userId,
          userType: tokenData.participantType
        });

        if (room.participants.length === 2) {
          console.log('✅ Sala completa, listos para conectar WebRTC');
          io.to(roomId).emit('ready-to-connect');
        }
      } catch (err) {
        console.warn(`⛔ [Telemedicina] Rechazo de admisión a sala ${roomId}:`, err.message);
        socket.emit('room-error', { code: 'UNAUTHORIZED', message: err.message });
      }
    });

    // Usuario se une a una sala de videoconsulta (Compatibilidad)
    socket.on('join-room', ({ roomId, userId, userType }) => {
      const currentRoom = activeRooms.get(roomId);
      if (currentRoom && currentRoom.participants.length >= 2) {
        socket.emit('room-error', { code: 'ROOM_FULL', message: 'Sala completa' });
        return;
      }

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
