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
  XCircle,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';
import BLEManager from '../utils/BLEManager';
import HeatmapVisualization from './HeatmapVisualization';
import ConsoleViewer from './ConsoleViewer';
import ExportManager from '../utils/ExportManager';

interface PressureData {
  timestamp: string;
  values: number[];
}

const RightSoleScreen: React.FC = () => {
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
  const [isScanning, setIsScanning] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  
  const bleManager = useRef(new BLEManager());
  const exportManager = useRef(new ExportManager());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleDataReceived = (data: number[]) => {
      const timestamp = new Date().toLocaleTimeString();
      const newData: PressureData = { timestamp, values: data };
      
      setPressureData(prev => [...prev, newData]);
      setCurrentPressures(data);
      
      const logEntry = `[${timestamp}] PRESSURE_RIGHT: ${data.join(',')}`;
      setConsoleLog(prev => [...prev, logEntry]);
    };

    const handleRawDataReceived = (rawData: string) => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${rawData}`;
      setConsoleLog(prev => [...prev, logEntry]);
    };

    const handleConnectionChange = (connected: boolean) => {
      setBleConnected(connected);
      if (connected) {
        setConnectionError('');
        const deviceInfo = bleManager.current.getDeviceInfo();
        if (deviceInfo) {
          setConsoleLog(prev => [...prev, `[INFO] Connected to ${deviceInfo.name} (${deviceInfo.id})`]);
        }
      } else {
        setConsoleLog(prev => [...prev, '[INFO] ESP32 device disconnected']);
      }
    };

    bleManager.current.onDataReceived = handleDataReceived;
    bleManager.current.onRawDataReceived = handleRawDataReceived;
    bleManager.current.onConnectionChange = handleConnectionChange;

    // Add initial console messages
    setConsoleLog(['[INFO] Foot Pressure Heatmap System Initialized']);
    setConsoleLog(prev => [...prev, '[INFO] Ready to scan for ESP32 BLE devices']);
    setConsoleLog(prev => [...prev, '[INFO] Expected data format: PRESSURE_RIGHT:val1,val2,val3,val4,val5,val6,val7,val8']);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      bleManager.current.disconnect();
    };
  }, []);

  const scanForDevices = async () => {
    setIsScanning(true);
    setConnectionError('');
    setConsoleLog(prev => [...prev, '[INFO] Scanning for ESP32 BLE devices...']);
    
    try {
      const devices = await bleManager.current.scanForDevices();
      setAvailableDevices(devices);
      
      if (devices.length > 0) {
        setConsoleLog(prev => [...prev, `[INFO] Found ${devices.length} ESP32 device(s)`]);
        devices.forEach(device => {
          setConsoleLog(prev => [...prev, `[INFO] - ${device.name || 'Unknown Device'} (${device.id})`]);
        });
      } else {
        setConsoleLog(prev => [...prev, '[INFO] No ESP32 devices found']);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setConnectionError(errorMessage);
      setConsoleLog(prev => [...prev, `[ERROR] ESP32 scan failed: ${errorMessage}`]);
      
      if (errorMessage.includes('User cancelled')) {
        setConsoleLog(prev => [...prev, '[INFO] Device selection cancelled by user']);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    setConnectionError('');
    setConsoleLog(prev => [...prev, `[INFO] Attempting to connect to ESP32: ${device.name || 'Unknown Device'}...`]);
    
    try {
      await bleManager.current.connect(device);
      setSelectedDevice(device);
      setBleConnected(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      setConsoleLog(prev => [...prev, `[ERROR] ESP32 connection failed: ${errorMessage}`]);
    }
  };

  const startMeasurement = () => {
    if (!bleConnected) {
      alert('Please connect to an ESP32 device first.');
      return;
    }

    setIsRecording(true);
    setTestCompleted(false);
    setPressureData([]);
    setAveragePressures(Array(8).fill(0));
    setConsoleLog(prev => [...prev, '[INFO] Starting 20-second measurement...']);
    setConsoleLog(prev => [...prev, '[INFO] Please stand still on the pressure sensors']);
    setConsoleLog(prev => [...prev, '[INFO] ESP32 will send pressure data via BLE']);
    setTimeRemaining(20);

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setTimeout(() => {
            completeTest();
          }, 100);
          return 0;
        }
        return newTime;
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
    completeTest();
  };

  const completeTest = () => {
    console.log('Completing test with data points:', pressureData.length);
    
    if (pressureData.length > 0) {
      calculateAverages();
      setTestCompleted(true);
      setConsoleLog(prev => [...prev, '[INFO] Measurement completed. Calculating averages...']);
    } else {
      setConsoleLog(prev => [...prev, '[WARNING] No data collected during measurement']);
    }
  };

  const calculateAverages = () => {
    console.log('Calculating averages from', pressureData.length, 'data points');
    
    if (pressureData.length === 0) return;

    const sums = Array(8).fill(0);
    pressureData.forEach(data => {
      data.values.forEach((value, index) => {
        sums[index] += value;
      });
    });

    const averages = sums.map(sum => Math.round(sum / pressureData.length));
    console.log('Calculated averages:', averages);
    setAveragePressures(averages);

    const maxValue = Math.max(...averages);
    const maxIndex = averages.indexOf(maxValue);
    setMaxPressurePoint({ index: maxIndex, value: maxValue });

    const totalAverage = Math.round(averages.reduce((sum, val) => sum + val, 0) / averages.length);
    setAveragePressure(totalAverage);

    setConsoleLog(prev => [...prev, `[INFO] Processed ${pressureData.length} data points`]);
    setConsoleLog(prev => [...prev, `[INFO] Average pressure: ${totalAverage} kPa`]);
    setConsoleLog(prev => [...prev, `[INFO] Max pressure: P${maxIndex + 1} = ${maxValue} kPa`]);
    setConsoleLog(prev => [...prev, `[INFO] Averaged pressure values: ${averages.join(', ')}`]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadExcel = async () => {
    try {
      await exportManager.current.exportToExcel(pressureData, averagePressures, doctorNotes, 'right');
      setConsoleLog(prev => [...prev, '[INFO] Excel report exported successfully']);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      setConsoleLog(prev => [...prev, '[ERROR] Failed to export Excel report']);
    }
  };

  const downloadHeatmapImage = async () => {
    try {
      await exportManager.current.exportHeatmapImage('heatmap-container', 'right_sole_heatmap.png');
      setConsoleLog(prev => [...prev, '[INFO] Heatmap image exported successfully']);
    } catch (error) {
      console.error('Failed to export heatmap:', error);
      setConsoleLog(prev => [...prev, '[ERROR] Failed to export heatmap image']);
    }
  };

  const downloadAll = async () => {
    try {
      await exportManager.current.exportAll(pressureData, averagePressures, doctorNotes, 'right', 'heatmap-container');
      setConsoleLog(prev => [...prev, '[INFO] Complete export package created successfully']);
    } catch (error) {
      console.error('Failed to export all files:', error);
      setConsoleLog(prev => [...prev, '[ERROR] Failed to create export package']);
    }
  };

  const getHeatmapPressureValues = () => {
    if (testCompleted) {
      return averagePressures;
    } else if (isRecording) {
      return currentPressures;
    } else {
      return Array(8).fill(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-700 pb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-light">🦶 Foot Pressure Heatmap – Right Sole</h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* Web Bluetooth Support Indicator */}
            <div className="flex items-center space-x-2">
              {navigator.bluetooth ? (
                <span className="flex items-center space-x-2 bg-blue-900 text-blue-100 px-3 py-1 rounded-full text-sm">
                  <Wifi size={16} />
                  <span>BLE Supported</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2 bg-red-900 text-red-100 px-3 py-1 rounded-full text-sm">
                  <WifiOff size={16} />
                  <span>BLE Not Supported</span>
                </span>
              )}
            </div>
            
            {/* Connection Status */}
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
                <span>ESP32 BLE Connection</span>
              </h2>
              
              <div className="space-y-4">
                <button
                  onClick={scanForDevices}
                  disabled={isRecording || isScanning}
                  className="w-full bg-[#d32f2f] hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center space-x-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Scanning & Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth size={16} />
                      <span>Connect ESP32</span>
                    </>
                  )}
                </button>

                {connectionError && (
                  <div className="text-sm text-red-400 bg-red-900 bg-opacity-30 p-3 rounded border border-red-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle size={16} />
                      <span className="font-medium">Connection Error</span>
                    </div>
                    <div>{connectionError}</div>
                  </div>
                )}

                {availableDevices.length > 0 && !bleConnected && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Available ESP32 Devices</label>
                    <select 
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                      onChange={(e) => {
                        const device = availableDevices.find(d => d.id === e.target.value);
                        if (device) connectToDevice(device);
                      }}
                      disabled={isRecording}
                      value={selectedDevice?.id || ''}
                    >
                      <option value="">Select a device...</option>
                      {availableDevices.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name || 'Unknown Device'} ({device.id.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {bleConnected && selectedDevice && (
                  <div className="flex items-center space-x-3 px-4 py-2 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div>
                      <span className="text-sm font-medium text-green-300">Connected</span>
                      <p className="text-xs text-green-400">{selectedDevice.name || 'ESP32 Device'}</p>
                    </div>
                    <button
                      onClick={() => bleManager.current.disconnect()}
                      disabled={isRecording}
                      className="ml-auto px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Disconnect
                    </button>
                  </div>
                )}

                {/* Connection Instructions */}
                <div className="text-xs text-gray-400 space-y-1 bg-gray-800 p-3 rounded">
                  <div className="font-medium text-gray-300">ESP32 Configuration:</div>
                  <div>Service UUID: 12345678-1234-1234-1234-1234567890ab</div>
                  <div>Characteristic UUID: abcd1234-5678-90ab-cdef-1234567890ab</div>
                  <div className="text-yellow-400 mt-2">
                    ⚠️ Make sure your ESP32 is powered on and advertising
                  </div>
                  <div className="text-blue-400 mt-2">
                    📡 Expected format: PRESSURE_RIGHT:val1,val2,val3,val4,val5,val6,val7,val8
                  </div>
                  <div className="text-green-400 mt-1">
                    ✅ Look for devices named "ESP32", "FootPressure", or similar
                  </div>
                </div>

                {!navigator.bluetooth && (
                  <div className="text-sm text-yellow-400 bg-yellow-900 bg-opacity-30 p-3 rounded border border-yellow-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle size={16} />
                      <span className="font-medium">Browser Not Supported</span>
                    </div>
                    <div>Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera for ESP32 connectivity.</div>
                  </div>
                )}
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
                  {isRecording && (
                    <div className="text-sm text-yellow-400 mt-2">
                      Recording live data... Stand still!
                    </div>
                  )}
                  {testCompleted && (
                    <div className="text-sm text-green-400 mt-2">
                      ✅ Test completed - Showing averaged results
                    </div>
                  )}
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
                    <span>Please connect to ESP32 device to begin measurement.</span>
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
                    <span className="text-gray-300">Data Points:</span>
                    <span className="font-medium">{pressureData.length}</span>
                  </div>
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
                      <span>Pressure point exceeded 200kPa - consider medical evaluation</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">📝 Doctor Notes</label>
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Add clinical observations, patient symptoms, or treatment recommendations..."
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white h-24 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Center Column - Heatmap */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-medium mb-4 flex items-center justify-between">
              <span>🦶 Right Sole Heatmap</span>
              {testCompleted && (
                <span className="text-sm bg-green-900 text-green-100 px-2 py-1 rounded-full">
                  Averaged Results
                </span>
              )}
              {isRecording && (
                <span className="text-sm bg-yellow-900 text-yellow-100 px-2 py-1 rounded-full animate-pulse">
                  Live Data
                </span>
              )}
            </h2>
            <div id="heatmap-container">
              <HeatmapVisualization 
                pressureValues={getHeatmapPressureValues()}
                soleType="right"
                isRecording={isRecording}
              />
            </div>
          </div>

          {/* Right Column - Console & Export */}
          <div className="space-y-6">
            {/* Console */}
            <ConsoleViewer 
              logs={consoleLog} 
              isConnected={bleConnected}
              onAddLog={(message, type) => {
                setConsoleLog(prev => [...prev, message]);
              }}
            />

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
            to="/left-sole"
            className="bg-[#d32f2f] hover:bg-red-700 text-white py-2 px-6 rounded transition-colors"
          >
            ← View Left Sole
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RightSoleScreen;