import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Copy, Trash2, Download } from 'lucide-react';

interface LogEntry {
  timestamp: Date;
  data: string;
  type: 'left' | 'right' | 'system' | 'error' | 'ble';
}

interface ConsoleViewerProps {
  logs: string[];
  isConnected?: boolean;
  onAddLog?: (message: string, type?: LogEntry['type']) => void;
}

const ConsoleViewer: React.FC<ConsoleViewerProps> = ({ 
  logs, 
  isConnected = false,
  onAddLog 
}) => {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Convert string logs to LogEntry format
  useEffect(() => {
    const newEntries = logs.map(log => {
      let type: LogEntry['type'] = 'system';
      
      if (log.includes('PRESSURE_LEFT:')) type = 'left';
      else if (log.includes('PRESSURE_RIGHT:')) type = 'right';
      else if (log.includes('[ERROR]')) type = 'error';
      else if (log.includes('BLE') || log.includes('ESP32') || log.includes('📡')) type = 'ble';
      
      return {
        timestamp: new Date(),
        data: log,
        type
      };
    });
    
    setLogEntries(newEntries);
  }, [logs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logEntries, isAutoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (terminalRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsAutoScroll(isAtBottom);
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogEntries([]);
    onAddLog?.('📋 Console cleared', 'system');
  };

  // Copy logs to clipboard
  const copyLogs = async () => {
    const logText = logEntries.map(log => 
      `[${formatTime(log.timestamp)}] ${log.data}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(logText);
      onAddLog?.('📋 Logs copied to clipboard', 'system');
    } catch (err) {
      onAddLog?.('❌ Failed to copy logs', 'error');
    }
  };

  // Export logs as text file
  const exportLogs = () => {
    const logText = logEntries.map(log => 
      `[${log.timestamp.toISOString()}] ${log.data}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foot-pressure-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onAddLog?.('💾 Logs exported successfully', 'system');
  };

  // Format timestamp for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get log entry styling based on type
  const getLogStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'left':
        return 'text-red-400';
      case 'right':
        return 'text-green-400';
      case 'ble':
        return 'text-cyan-400';
      case 'system':
        return 'text-blue-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-300';
    }
  };

  // ✅ CRITICAL: Validate pressure data format - DO NOT assume any values are wrong
  const isValidPressureData = (log: string): boolean => {
    if (log.includes('PRESSURE_')) {
      const match = log.match(/PRESSURE_(?:LEFT|RIGHT):(.+)/);
      if (!match) return false;
      const values = match[1].split(',');
      // Only check if we have 8 comma-separated values, don't validate individual numbers
      return values.length === 8 && values.every(val => !isNaN(Number(val.trim())));
    }
    return true; // All other logs are considered valid
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 h-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Terminal className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">📟 Live Sensor Console</h3>
          <div className="flex items-center space-x-2 ml-4">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            {logEntries.length} entries
          </span>
          <button
            onClick={copyLogs}
            disabled={logEntries.length === 0}
            className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy logs"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={exportLogs}
            disabled={logEntries.length === 0}
            className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export logs"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={clearLogs}
            disabled={logEntries.length === 0}
            className="p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="flex-1 p-4 bg-black text-green-400 font-mono text-sm overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #1f2937' }}
      >
        {logEntries.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Waiting for ESP32 sensor data...</p>
            <p className="text-xs mt-1">Connect to ESP32 to see real-time data</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logEntries.map((log, index) => (
              <div 
                key={index} 
                className={`flex ${!isValidPressureData(log.data) ? 'bg-red-900 bg-opacity-30' : ''}`}
              >
                <span className="text-gray-500 mr-2 flex-shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className={getLogStyle(log.type)}>
                  {log.data}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Auto-scroll: {isAutoScroll ? 'ON' : 'OFF'}</span>
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className="text-blue-400 hover:text-blue-300"
            >
              Toggle
            </button>
          </div>
          <div>
            Expected: PRESSURE_LEFT:50,100,150,200,250,255,128,64
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsoleViewer;