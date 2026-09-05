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
}

export const logger = LogService.getInstance();
