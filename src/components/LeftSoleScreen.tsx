import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bluetooth, 
  Play, 
  Square, 
  Download, 
  FileText, 
  Image, 
  Archive,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import BLEManager from '../utils/BLEManager';
import HeatmapVisualization from './HeatmapVisualization';
import ConsoleViewer from './ConsoleViewer';
import ExportManager from '../utils/ExportManager';

interface PressureData {
  timestamp: string;
  values: number[];
}

const LeftSoleScreen: React.FC = () => {
  const [bleConnected, setBleConnected] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [pressureData, setPressureData] = useState<PressureData[]>([]);
  const [currentPressures, setCurrentPressures] = useState<number[]>(Array(8).fill(0));
  const [averagePressures, setAveragePressures] = useState<number[]>(Array(8).fill(0));
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [testCompleted, setTestCompleted] = useState(false);
  const [maxPressurePoint, setMaxPressurePoint] = useState({ index: 0, value: 0 });
  const [averagePressure, setAveragePressure] = useState(0);
  
  const bleManager = useRef(new BLEManager());
  const exportManager = useRef(new ExportManager());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleDataReceived = (data: number[]) => {
      const timestamp = new Date().toLocaleTimeString();
      const newData: PressureData = { timestamp, values: data };
      
      setPressureData(prev => [...prev, newData]);
      setCurrentPressures(data);
      
      const logEntry = `[${timestamp}] PRESSURE_LEFT: ${data.join(',')}`;
      setConsoleLog(prev => [...prev, logEntry]);
    };

    const handleConnectionChange = (connected: boolean) => {
      setBleConnected(connected);
    };

    bleManager.current.onDataReceived = handleDataReceived;
    bleManager.current.onConnectionChange = handleConnectionChange;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const scanForDevices = async () => {
    try {
      const devices = await bleManager.current.scanForDevices();
      setAvailableDevices(devices);
    } catch (error) {
      console.error('Failed to scan for devices:', error);
      setConsoleLog(prev => [...prev, `[ERROR] Failed to scan for devices: ${error}`]);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      await bleManager.current.connect(device);
      setSelectedDevice(device);
      setBleConnected(true);
      setConsoleLog(prev => [...prev, `[INFO] Connected to ${device.name}`]);
    } catch (error) {
      console.error('Failed to connect to device:', error);
      setConsoleLog(prev => [...prev, `[ERROR] Failed to connect: ${error}`]);
    }
  };

  const startMeasurement = () => {
    if (!bleConnected) {
      alert('Please pair with device to begin.');
      return;
    }

    setIsRecording(true);
    setTestCompleted(false);
    setPressureData([]);
    setConsoleLog(prev => [...prev, '[INFO] Starting 20-second measurement...']);
    setTimeRemaining(20);

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          stopMeasurement();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    bleManager.current.startDataCollection();
  };

  const stopMeasurement = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    bleManager.current.stopDataCollection();
    
    if (pressureData.length > 0) {
      calculateAverages();
      setTestCompleted(true);
      setConsoleLog(prev => [...prev, '[INFO] Measurement completed. Calculating averages...']);
    }
  };

  const calculateAverages = () => {
    if (pressureData.length === 0) return;

    const sums = Array(8).fill(0);
    pressureData.forEach(data => {
      data.values.forEach((value, index) => {
        sums[index] += value;
      });
    });

    const averages = sums.map(sum => Math.round(sum / pressureData.length));
    setAveragePressures(averages);

    const maxValue = Math.max(...averages);
    const maxIndex = averages.indexOf(maxValue);
    setMaxPressurePoint({ index: maxIndex, value: maxValue });

    const totalAverage = Math.round(averages.reduce((sum, val) => sum + val, 0) / averages.length);
    setAveragePressure(totalAverage);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadExcel = async () => {
    try {
      await exportManager.current.exportToExcel(pressureData, averagePressures, doctorNotes, 'left');
    } catch (error) {
      console.error('Failed to export Excel:', error);
    }
  };

  const downloadHeatmapImage = async () => {
    try {
      await exportManager.current.exportHeatmapImage('heatmap-container', 'left_sole_heatmap.png');
    } catch (error) {
      console.error('Failed to export heatmap:', error);
    }
  };

  const downloadAll = async () => {
    try {
      await exportManager.current.exportAll(pressureData, averagePressures, doctorNotes, 'left', 'heatmap-container');
    } catch (error) {
      console.error('Failed to export all files:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-700 pb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-light">🦶 Foot Pressure Heatmap – Left Sole</h1>
          </div>
          <div className="flex items-center space-x-2">
            {bleConnected ? (
              <span className="flex items-center space-x-2 bg-green-900 text-green-100 px-3 py-1 rounded-full text-sm">
                <CheckCircle size={16} />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2 bg-red-900 text-red-100 px-3 py-1 rounded-full text-sm">
                <XCircle size={16} />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            {/* BLE Connection */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-medium mb-4 flex items-center space-x-2">
                <Bluetooth className="text-[#d32f2f]" size={20} />
                <span>BLE Connection</span>
              </h2>
              
              <div className="space-y-4">
                <button
                  onClick={scanForDevices}
                  className="w-full bg-[#d32f2f] hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
                  disabled={isRecording}
                >
                  Scan for Devices
                </button>

                {availableDevices.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Available BLE Devices</label>
                    <select 
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                      onChange={(e) => {
                        const device = availableDevices.find(d => d.id === e.target.value);
                        if (device) connectToDevice(device);
                      }}
                      disabled={isRecording}
                    >
                      <option value="">Select a device...</option>
                      {availableDevices.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name || 'Unknown Device'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="text-xs text-gray-400 space-y-1">
                  <div>Service UUID: 12345678-1234-1234-1234-1234567890ab</div>
                  <div>Characteristic UUID: abcd1234-5678-90ab-cdef-1234567890ab</div>
                </div>
              </div>
            </div>

            {/* Test Controls */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-medium mb-4">⏱️ 20-Second Averaging Test</h2>
              
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-[#d32f2f]">
                    {formatTime(timeRemaining)}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={startMeasurement}
                    disabled={!bleConnected || isRecording}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
                  >
                    <Play size={16} />
                    <span>Start Measurement</span>
                  </button>

                  <button
                    onClick={stopMeasurement}
                    disabled={!isRecording}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
                  >
                    <Square size={16} />
                    <span>Stop Early</span>
                  </button>
                </div>

                {!bleConnected && (
                  <div className="text-sm text-yellow-400 flex items-center space-x-2">
                    <AlertTriangle size={16} />
                    <span>Please pair with device to begin.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary & Notes */}
            {testCompleted && (
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-medium mb-4">📊 Test Summary</h2>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Average Pressure:</span>
                    <span className="font-medium">{averagePressure} kPa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Max Point:</span>
                    <span className="font-medium">P{maxPressurePoint.index + 1} – {maxPressurePoint.value} kPa</span>
                  </div>
                  {maxPressurePoint.value > 200 && (
                    <div className="text-yellow-400 text-sm flex items-center space-x-2">
                      <AlertTriangle size={16} />
                      <span>Pressure point exceeded 200kPa</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">📝 Doctor Notes</label>
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Add any observations here..."
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white h-24 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Center Column - Heatmap */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-medium mb-4">🦶 Left Sole Heatmap</h2>
            <div id="heatmap-container">
              <HeatmapVisualization 
                pressureValues={testCompleted ? averagePressures : currentPressures}
                soleType="left"
                isRecording={isRecording}
              />
            </div>
          </div>

          {/* Right Column - Console & Export */}
          <div className="space-y-6">
            {/* Console */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-medium mb-4">📟 Live Sensor Console</h2>
              <ConsoleViewer logs={consoleLog} />
            </div>

            {/* Export Controls */}
            {testCompleted && (
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-medium mb-4">🧾 Download Reports</h2>
                
                <div className="space-y-3">
                  <button
                    onClick={downloadExcel}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
                  >
                    <FileText size={16} />
                    <span>Download Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={downloadHeatmapImage}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
                  >
                    <Image size={16} />
                    <span>Download Heatmap Image (.png)</span>
                  </button>

                  <button
                    onClick={downloadAll}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
                  >
                    <Archive size={16} />
                    <span>Export All (.zip)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center pt-6 border-t border-gray-700">
          <Link
            to="/right-sole"
            className="bg-[#d32f2f] hover:bg-red-700 text-white py-2 px-6 rounded transition-colors"
          >
            → View Right Sole
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LeftSoleScreen;