import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

const backendUrl = import.meta.env.VITE_BACKEND_URL 
  || (Capacitor.isNativePlatform() || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? 'https://digital-udhaar-khata.onrender.com'
      : 'http://localhost:4000');

let socket = null;

export const initSocket = () => {
  if (socket) return socket;

  socket = io(backendUrl, {
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Connected to real-time sync server:', socket.id);
  });

  socket.on('refresh_data', (data) => {
    console.log('Received real-time refresh signal:', data);
    // Dispatch a custom window event that React components can listen to
    const event = new CustomEvent('socket_refresh', { detail: data });
    window.dispatchEvent(event);
  });

  socket.on('payment_screenshot_received', (data) => {
    console.log('Payment screenshot received:', data);
    import('react-toastify').then(({ toast }) => {
      toast.info(`Payment Screenshot Received from ${data.customerName || 'Customer'} (₹${data.amount})!`, {
        autoClose: 10000,
      });
    });
    const event = new CustomEvent('socket_screenshot', { detail: data });
    window.dispatchEvent(event);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from real-time sync server');
  });

  return socket;
};

export const getSocket = () => socket;
