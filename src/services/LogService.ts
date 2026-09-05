export type LogType = 'info' | 'warning' | 'error' | 'success' | 'operation';

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: LogType;
}

type LogListener = (log: LogEntry) => void;

class LogService {
  private static instance: LogService;
  private listeners: LogListener[] = [];

  private constructor() {}

  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public log(message: string, type: LogType = 'info'): void {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      message,
      type,
    };

    this.listeners.forEach(listener => listener(entry));
    
    // Optional: Keep console logging for debugging
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  // Métodos abreviados para facilitar el desarrollo
  public info(message: string): void { this.log(message, 'info'); }
  public warn(message: string): void { this.log(message, 'warning'); }
  public success(message: string): void { this.log(message, 'success'); }
  public error(message: string, error?: unknown): void {
    const detailedMessage = error ? `${message} - DETALLE: ${error instanceof Error ? error.message : String(error)}` : message;
    this.log(detailedMessage, 'error');
  }
}

export const logger = LogService.getInstance();
