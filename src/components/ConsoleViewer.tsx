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

  const getLogColor = (log: string): string => {
    if (log.includes('[ERROR]')) return 'text-red-400';
    if (log.includes('[INFO]')) return 'text-blue-400';
    if (log.includes('PRESSURE_')) return 'text-green-400';
    return 'text-gray-300';
  };

  const isValidPressureData = (log: string): boolean => {
    if (!log.includes('PRESSURE_')) return true;
    
    const match = log.match(/PRESSURE_(?:LEFT|RIGHT): (.+)/);
    if (!match) return false;
    
    const values = match[1].split(',');
    return values.length === 8 && values.every(val => !isNaN(Number(val.trim())));
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