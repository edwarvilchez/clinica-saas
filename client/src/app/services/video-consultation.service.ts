import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { API_URL, SOCKET_URL } from '../api-config';

interface VideoConsultation {
  id: number;
  roomId: string;
  appointmentId: number;
  doctorId: number;
  patientId: number;
  status: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VideoConsultationService {
  private apiUrl = `${API_URL}/video-consultations`;
  private socketUrl = SOCKET_URL;
  private socket: Socket | null = null;
  private peer: SimplePeer.Instance | null = null;
  private currentRoomId: string = '';

  // Signals para estado reactivo
  isConnected = signal(false);
  remoteStream = signal<MediaStream | null>(null);
  localStream = signal<MediaStream | null>(null);
  isMuted = signal(false);
  isVideoOff = signal(false);
  isConnecting = signal(false);
  connectionError = signal<string | null>(null);
  
  // Signal para notificación de llamada entrante (Global)
  incomingCall = signal<{ fromName: string, roomId: string, consultationId: number } | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Registro global del socket para recibir notificaciones (Llamar en app.component)
   */
  registerGlobalSocket() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;
    
    const user = JSON.parse(userJson);
    if (!this.socket) {
      this.socket = io(this.socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true
      });

      this.socket.on('connect', () => {
        console.log('📡 Socket global conectado para notificaciones');
        this.socket?.emit('register-user', user.id);
      });

      this.socket.on('incoming-call', (data) => {
        console.log('📞 Recibiendo llamada entrante:', data);
        this.incomingCall.set(data);
      });
    } else {
      this.socket.emit('register-user', user.id);
    }
  }

  /**
   * El doctor inicia la llamada para alertar al paciente
   */
  notifyPatient(toUserId: number, fromName: string, roomId: string, consultationId: number) {
    if (this.socket) {
      console.log(`📞 Solicitando alerta de llamada para usuario ${toUserId}`);
      this.socket.emit('initiate-call', { toUserId, fromName, roomId, consultationId });
    }
  }

  // ==================== API REST ====================

  createVideoConsultation(appointmentId: number): Observable<any> {
    return this.http.post(this.apiUrl, { appointmentId });
  }

  getVideoConsultation(id: number): Observable<VideoConsultation> {
    return this.http.get<VideoConsultation>(`${this.apiUrl}/${id}`);
  }

  getVideoConsultationByRoom(roomId: string): Observable<VideoConsultation> {
    return this.http.get<VideoConsultation>(`${this.apiUrl}/room/${roomId}`);
  }

  startVideoConsultation(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/start`, {});
  }

  endVideoConsultation(id: number, notes: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/end`, { notes });
  }

  getMyConsultations(): Observable<VideoConsultation[]> {
    return this.http.get<VideoConsultation[]>(`${this.apiUrl}/my-consultations`);
  }

  getMyPatientConsultations(): Observable<VideoConsultation[]> {
    return this.http.get<VideoConsultation[]>(`${this.apiUrl}/my-patient-consultations`);
  }

  cancelVideoConsultation(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/cancel`, {});
  }

  // ==================== WebRTC y Socket.io ====================

  async initializeMedia(): Promise<MediaStream> {
    try {
      this.isConnecting.set(true);
      this.connectionError.set(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.localStream.set(stream);
      this.isConnecting.set(false);
      console.log('✅ Media inicializada correctamente');
      return stream;
    } catch (error: any) {
      this.isConnecting.set(false);
      const errorMsg = this.getMediaErrorMessage(error);
      this.connectionError.set(errorMsg);
      console.error('❌ Error accediendo a cámara/micrófono:', error);
      throw new Error(errorMsg);
    }
  }

  private getMediaErrorMessage(error: any): string {
    if (error.name === 'NotAllowedError') {
      return 'Permiso denegado. Por favor, permite el acceso a la cámara y micrófono.';
    } else if (error.name === 'NotFoundError') {
      return 'No se encontró cámara o micrófono. Verifica que estén conectados.';
    } else if (error.name === 'NotReadableError') {
      return 'La cámara o micrófono están siendo usados por otra aplicación.';
    } else {
      return 'Error al acceder a los dispositivos multimedia.';
    }
  }

  connectToRoom(roomId: string, userId: number, userType: 'doctor' | 'patient') {
    this.currentRoomId = roomId;
    this.socket = io(this.socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ Conectado al servidor WebSocket:', this.socket?.id);
      this.socket!.emit('join-room', { roomId, userId, userType });
    });

    this.socket.on('user-joined', ({ userId: joinedUserId, userType: joinedUserType }) => {
      console.log(`👤 ${joinedUserType} se unió a la sala`);
    });

    this.socket.on('ready-to-connect', () => {
      console.log('🎥 Ambos participantes en sala, iniciando conexión WebRTC');
      this.createPeerConnection(userType === 'doctor');
    });

    this.socket.on('offer', (offer: SimplePeer.SignalData) => {
      console.log('📥 Offer recibida');
      if (this.peer) {
        this.peer.signal(offer);
      }
    });

    this.socket.on('answer', (answer: SimplePeer.SignalData) => {
      console.log('📥 Answer recibida');
      if (this.peer) {
        this.peer.signal(answer);
      }
    });

    this.socket.on('ice-candidate', (candidate: SimplePeer.SignalData) => {
      console.log('🧊 ICE candidate recibido');
      if (this.peer) {
        this.peer.signal(candidate);
      }
    });

    this.socket.on('user-left', () => {
      console.log('❌ El otro usuario abandonó la sala');
      this.remoteStream.set(null);
      this.isConnected.set(false);
      this.connectionError.set('El otro participante se desconectó');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error);
      this.connectionError.set('Error de conexión con el servidor');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Desconectado del WebSocket:', reason);
      if (reason === 'io server disconnect') {
        // El servidor forzó la desconexión, reconectar
        this.socket?.connect();
      }
    });
  }

  private createPeerConnection(initiator: boolean) {
    const stream = this.localStream();
    if (!stream) {
      console.error('❌ No hay stream local disponible');
      return;
    }

    console.log(`🔗 Creando peer connection (iniciador: ${initiator})`);

    this.peer = new SimplePeer({
      initiator,
      stream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('signal', (data: SimplePeer.SignalData) => {
      console.log(`📤 Enviando señal WebRTC: ${data.type}`);
      
      if (data.type === 'offer') {
        this.socket!.emit('offer', { roomId: this.currentRoomId, offer: data });
      } else if (data.type === 'answer') {
        this.socket!.emit('answer', { roomId: this.currentRoomId, answer: data });
      } else if (data.type === 'candidate') {
        this.socket!.emit('ice-candidate', { roomId: this.currentRoomId, candidate: data });
      } else {
        // Fallback para otros tipos de señales (renegotiate, transceivers)
        if (initiator) {
          this.socket!.emit('offer', { roomId: this.currentRoomId, offer: data });
        } else {
          this.socket!.emit('answer', { roomId: this.currentRoomId, answer: data });
        }
      }
    });

    this.peer.on('stream', (remoteStream: MediaStream) => {
      console.log('📹 Stream remoto recibido');
      this.remoteStream.set(remoteStream);
      this.isConnected.set(true);
      this.connectionError.set(null);
    });

    this.peer.on('connect', () => {
      console.log('✅ Peer conectado exitosamente');
    });

    this.peer.on('error', (err: Error) => {
      console.error('❌ Error en peer connection:', err);
      this.connectionError.set('Error en la conexión de video');
    });

    this.peer.on('close', () => {
      console.log('🔌 Peer connection cerrada');
      this.isConnected.set(false);
    });
  }

  toggleMute() {
    const stream = this.localStream();
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isMuted.set(!audioTrack.enabled);
        console.log(`🎤 Audio ${audioTrack.enabled ? 'activado' : 'silenciado'}`);
      }
    }
  }

  toggleVideo() {
    const stream = this.localStream();
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoOff.set(!videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'activado' : 'desactivado'}`);
      }
    }
  }

  disconnect() {
    console.log('🔌 Desconectando videoconsulta...');

    // Destruir peer connection
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Desconectar socket
    if (this.socket) {
      this.socket.emit('leave-room', { roomId: this.currentRoomId });
      this.socket.disconnect();
      this.socket = null;
    }

    // Detener tracks de media local
    const stream = this.localStream();
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`⏹️ Track detenido: ${track.kind}`);
      });
      this.localStream.set(null);
    }

    // Resetear estado
    this.remoteStream.set(null);
    this.isConnected.set(false);
    this.isMuted.set(false);
    this.isVideoOff.set(false);
    this.currentRoomId = '';
    this.connectionError.set(null);

    console.log('✅ Desconexión completa');
  }

  // Obtener el roomId actual
  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  // Verificar si hay una conexión activa
  hasActiveConnection(): boolean {
    return this.isConnected() && this.socket !== null && this.peer !== null;
  }
}
