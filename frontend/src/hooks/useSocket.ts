import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || '';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [mqttStatus, setMqttStatus] = useState<string>('CHECKING');

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsSocketConnected(true);
      console.log('[Socket.IO] Connected to backend server:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      setIsSocketConnected(false);
      console.warn('[Socket.IO] Disconnected from backend server:', reason);
    });

    newSocket.on('connect_error', (err) => {
      setIsSocketConnected(false);
      console.error('[Socket.IO] Connection error:', err.message);
    });

    newSocket.on('mqtt_status', (data: { connected: boolean; broker?: string }) => {
      console.log('[MQTT Status Update]', data);
      setMqttStatus(data.connected ? 'ONLINE' : 'OFFLINE');
    });

    // Also fetch initial MQTT status via REST API check
    fetch('/api/mqtt-status')
      .then(res => res.json())
      .then(data => {
        setMqttStatus(data.online ? 'ONLINE' : 'OFFLINE');
      })
      .catch(() => {});

    return () => { newSocket.close(); };
  }, []);

  return { socket, mqttStatus, isSocketConnected };
}
