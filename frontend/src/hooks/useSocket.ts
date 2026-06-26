import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || '';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mqttStatus, setMqttStatus] = useState<string>('CONNECTING');

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      timeout: 5000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => { setMqttStatus('ONLINE'); });
    newSocket.on('disconnect', () => { setMqttStatus('OFFLINE'); });
    newSocket.on('connect_error', () => { setMqttStatus('OFFLINE'); });

    return () => { newSocket.close(); };
  }, []);

  return { socket, mqttStatus };
}
