import React, { useEffect, useRef } from 'react';

interface ConsoleViewerProps {
  logs: string[];
}

const ConsoleViewer: React.FC<ConsoleViewerProps> = ({ logs }) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  // 🟦 Color based on log content
  const getLogColor = (log: string): string => {
    if (log.includes('[ERROR]')) return 'text-red-400';
    if (log.includes('[INFO]')) return 'text-blue-400';
    if (log.includes('PRESSURE_')) return 'text-green-400';
    if (log.includes('BLE_RAW')) return 'text-yellow-400';
    return 'text-gray-300';
  };

  // ✅ Check if pressure-like data is valid (for both CSV or raw)
  const isValidPressureData = (log: string): boolean => {
    if (log.includes('PRESSURE_')) {
      const match = log.match(/PRESSURE_(?:LEFT|RIGHT): (.+)/);
      if (!match) return false;
      const values = match[1].split(',');
      return values.length === 8 && values.every(val => !isNaN(Number(val.trim())));
    }

    if (log.includes('BLE_RAW')) {
      const match = log.match(/BLE_RAW: \[(.+)\]/);
      if (!match) return false;
      const values = match[1].split(',').map(val => val.trim());
      return values.length === 8 && values.every(val => {
        const num = Number(val);
        return !isNaN(num) && num >= 0 && num <= 255;
      });
    }

    return true;
  };

  return (
    <div 
      ref={consoleRef}
      className="bg-black rounded border border-gray-600 p-3 h-64 overflow-y-auto font-mono text-sm"
    >
      {logs.length === 0 ? (
        <div className="text-gray-500 italic">Console output will appear here...</div>
      ) : (
        logs.map((log, index) => (
          <div 
            key={index} 
            className={`${getLogColor(log)} ${
              !isValidPressureData(log) ? 'bg-red-900 bg-opacity-30' : ''
            } py-1`}
          >
            {log}
          </div>
        ))
      )}
    </div>
  );
};

export default ConsoleViewer;
