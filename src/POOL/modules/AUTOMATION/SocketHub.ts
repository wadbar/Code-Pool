/**
 * SocketHub - Real-time Orchestration Module
 * Location: POOL/modules/AUTOMATION
 */

import { io, Socket } from 'socket.io-client';

export class SocketHub {
  private socket: Socket;
  private static instance: SocketHub;

  private constructor() {
    // Connect to the backend server
    this.socket = io(window.location.origin);
    
    this.socket.on('connect', () => {
      console.log('[SocketHub] Connected to orchestration layer.');
    });
  }

  public static getInstance(): SocketHub {
    if (!SocketHub.instance) {
      SocketHub.instance = new SocketHub();
    }
    return SocketHub.instance;
  }

  public emitEvent(event: string, payload: any) {
    this.socket.emit(event, payload);
  }

  public onEvent(event: string, callback: (payload: any) => void) {
    this.socket.on(event, callback);
  }

  public disconnect() {
    this.socket.disconnect();
  }
}

export const socketHub = SocketHub.getInstance();
