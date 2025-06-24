class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private isDemoMode = false;

  public onDataReceived: ((data: number[]) => void) | null = null;
  public onConnectionChange: ((connected: boolean) => void) | null = null;
  public onRawDataReceived: ((rawData: string) => void) | null = null;

  // Updated UUIDs to match your reference code
  private readonly SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
  private readonly CHARACTERISTIC_UUID = 'abcd1234-5678-90ab-cdef-1234567890ab';

  async scanForDevices(): Promise<BluetoothDevice[]> {
    try {
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }

      console.log('Scanning for ESP32 BLE devices...');
      
      // Request device with specific filters for ESP32 foot pressure sensors
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ESP32' },
          { namePrefix: 'FootPressure' },
          { namePrefix: 'Foot' },
          { services: [this.SERVICE_UUID] }
        ],
        optionalServices: [
          this.SERVICE_UUID,
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
        ]
      });

      console.log('Found ESP32 device:', device.name || 'Unknown Device', device.id);
      return [device];
      
    } catch (error) {
      console.error('Error scanning for ESP32 devices:', error);
      
      if (error instanceof Error && error.message.includes('User cancelled')) {
        throw new Error('Device selection cancelled by user');
      }
      
      // Fallback to acceptAllDevices if specific filters don't work
      try {
        console.log('Trying fallback scan method...');
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [this.SERVICE_UUID]
        });
        
        return [device];
      } catch (fallbackError) {
        console.log('Falling back to demo mode...');
        return this.getMockDevices();
      }
    }
  }

  private getMockDevices(): BluetoothDevice[] {
    // Return mock devices for demonstration when real BLE is not available
    return [
      {
        id: 'demo-esp32-left',
        name: 'ESP32-FootSensor-L',
        gatt: null
      } as BluetoothDevice,
      {
        id: 'demo-esp32-right', 
        name: 'ESP32-FootSensor-R',
        gatt: null
      } as BluetoothDevice
    ];
  }

  async connect(device: BluetoothDevice): Promise<void> {
    try {
      console.log('Attempting to connect to ESP32:', device.name || 'Unknown');
      this.device = device;
      this.isDemoMode = false;
      
      // For real BLE devices
      if (device.gatt && !device.id.startsWith('demo-')) {
        console.log('Connecting to GATT server...');
        this.server = await device.gatt.connect();
        
        console.log('Getting primary service...');
        this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
        
        console.log('Getting characteristic...');
        this.characteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID);
        
        // Set up notifications for real-time data
        console.log('Starting notifications...');
        await this.characteristic.startNotifications();
        this.characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged.bind(this));
        
        // Handle disconnection
        device.addEventListener('gattserverdisconnected', () => {
          console.log('ESP32 device disconnected');
          this.onConnectionChange?.(false);
          this.onRawDataReceived?.('❌ ESP32 BLE disconnected');
        });
        
        console.log('✅ Successfully connected to ESP32 device');
        this.onRawDataReceived?.('✅ ESP32 BLE connection established');
        this.onConnectionChange?.(true);
        
      } else {
        // Demo mode
        console.log('Using demo mode for device:', device.name);
        this.simulateConnection();
      }
      
    } catch (error) {
      console.error('Error connecting to ESP32:', error);
      
      // ✅ FIXED: Don't automatically fall back to demo mode on real connection attempts
      // Only use demo mode if explicitly requested or if it's a mock device
      if (device.id.startsWith('demo-')) {
        this.simulateConnection();
        return;
      }
      
      // Provide more specific error messages for real connection failures
      if (error instanceof Error) {
        if (error.message.includes('GATT operation not permitted')) {
          throw new Error('Device connection failed. Make sure the ESP32 is advertising and not connected to another device.');
        } else if (error.message.includes('Service not found')) {
          throw new Error('ESP32 service not found. Please check that your ESP32 is running the correct firmware with service UUID: ' + this.SERVICE_UUID);
        } else if (error.message.includes('Characteristic not found')) {
          throw new Error('ESP32 characteristic not found. Please verify the characteristic UUID: ' + this.CHARACTERISTIC_UUID);
        }
      }
      
      throw error; // Re-throw the error instead of falling back to demo mode
    }
  }

  private simulateConnection(): void {
    this.device = { 
      id: 'demo-device', 
      name: 'Demo ESP32 Sensor',
      gatt: null 
    } as BluetoothDevice;
    this.isDemoMode = true;
    this.onConnectionChange?.(true);
    this.onRawDataReceived?.('🎭 Demo mode activated - simulated ESP32 data');
  }

  private handleCharacteristicValueChanged(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    
    if (value && this.isCollecting) {
      try {
        // Try to decode as text first (most common ESP32 format)
        const decoder = new TextDecoder();
        const dataString = decoder.decode(value);
        
        console.log('📡 Received ESP32 data:', dataString);
        this.onRawDataReceived?.(dataString);
        
        // 🎯 CRITICAL: Parse pressure data EXACTLY as received from ESP32
        // Format: "PRESSURE_LEFT:50,100,150,200,250,255,128,64" or "PRESSURE_RIGHT:..."
        if (dataString.includes('PRESSURE_LEFT:') || dataString.includes('PRESSURE_RIGHT:')) {
          const match = dataString.match(/PRESSURE_(?:LEFT|RIGHT):(.+)/);
          if (match) {
            const valuesString = match[1].trim();
            
            // ✅ PRESERVE ALL VALUES EXACTLY AS RECEIVED - Support uint32_t range (0-4294967295)
            const pressureValues = valuesString.split(',')
              .map(val => {
                const trimmedVal = val.trim();
                const num = parseInt(trimmedVal, 10);
                // Support full uint32_t range - only clamp invalid values
                return isNaN(num) ? 0 : Math.max(0, Math.min(4294967295, num));
              })
              .slice(0, 8); // Take only first 8 values
            
            // Pad with zeros if less than 8 values (but preserve all received values)
            while (pressureValues.length < 8) {
              pressureValues.push(0);
            }
            
            console.log('✅ Parsed pressure values (EXACT from ESP32, uint32_t range):', pressureValues);
            this.onDataReceived?.(pressureValues);
            return;
          }
        }
        
        // Fallback: Try parsing as comma-separated values without prefix
        if (dataString.includes(',')) {
          const pressureValues = dataString.trim().split(',')
            .map(val => {
              const trimmedVal = val.trim();
              const num = parseInt(trimmedVal, 10);
              // Support full uint32_t range
              return isNaN(num) ? 0 : Math.max(0, Math.min(4294967295, num));
            })
            .slice(0, 8);
          
          if (pressureValues.length >= 4) { // At least 4 valid values
            while (pressureValues.length < 8) {
              pressureValues.push(0);
            }
            
            console.log('✅ Parsed CSV values (EXACT from ESP32, uint32_t range):', pressureValues);
            this.onDataReceived?.(pressureValues);
            return;
          }
        }
        
        // Fallback: Try raw byte parsing for uint32_t[8] format (32 bytes total)
        if (value.byteLength === 32) {
          const data = new Uint32Array(value.buffer);
          const pressureValues = Array.from(data);
          console.log('✅ Received raw uint32_t pressure values (EXACT from ESP32):', pressureValues);
          this.onDataReceived?.(pressureValues);
          return;
        }
        
        // Legacy fallback: uint8_t[8] format (8 bytes)
        if (value.byteLength === 8) {
          const data = new Uint8Array(value.buffer);
          const pressureValues = Array.from(data);
          console.log('✅ Received raw uint8_t pressure values (legacy format):', pressureValues);
          this.onDataReceived?.(pressureValues);
          return;
        }
        
        // If we get here, data format is unrecognized
        console.warn('❌ Unrecognized ESP32 data format:', dataString);
        this.onRawDataReceived?.(`❌ Unrecognized data format: ${dataString}`);
        
      } catch (error) {
        console.error('❌ Error parsing ESP32 data:', error);
        this.onRawDataReceived?.(`❌ Error parsing data: ${error}`);
      }
    }
  }

  startDataCollection(): void {
    this.isCollecting = true;
    console.log('🚀 Starting ESP32 data collection...');
    this.onRawDataReceived?.('🚀 Starting data collection...');
    
    // If we have a real BLE connection, data will come via notifications
    // For demo purposes, simulate data when no real connection
    if (this.isDemoMode || !this.characteristic) {
      this.simulateDataCollection();
    } else {
      // For real ESP32 connection, send start command if needed
      this.sendStartCommand();
    }
  }

  private async sendStartCommand(): Promise<void> {
    if (this.characteristic) {
      try {
        // Send start command to ESP32 (customize based on your ESP32 implementation)
        const startCommand = new TextEncoder().encode('START');
        await this.characteristic.writeValue(startCommand);
        console.log('📡 Sent START command to ESP32');
        this.onRawDataReceived?.('📡 Sent START command to ESP32');
      } catch (error) {
        console.error('❌ Error sending start command:', error);
        this.onRawDataReceived?.(`❌ Error sending start command: ${error}`);
      }
    }
  }

  private simulateDataCollection(): void {
    console.log('🎭 Starting simulated ESP32 data collection...');
    this.onRawDataReceived?.('🎭 Simulating ESP32 pressure data (uint32_t range)...');
    
    this.collectionInterval = setInterval(() => {
      if (!this.isCollecting) return;
      
      // Generate realistic pressure data with some variation for uint32_t range
      // ✅ IMPORTANT: These are example values - real ESP32 will send actual sensor readings
      const baseValues = [50000, 100000, 150000, 200000, 250000, 300000, 128000, 64000];
      const simulatedData = baseValues.map(base => 
        Math.max(0, Math.min(4294967295, base + Math.floor(Math.random() * 40000 - 20000)))
      );
      
      // Simulate the expected ESP32 data format
      const dataString = `PRESSURE_LEFT:${simulatedData.join(',')}`;
      this.onRawDataReceived?.(dataString);
      this.onDataReceived?.(simulatedData);
    }, 500); // 500ms intervals for demo
  }

  stopDataCollection(): void {
    this.isCollecting = false;
    console.log('🛑 Stopping ESP32 data collection...');
    
    // ✅ FIXED: Only show stop message once and don't repeat it
    if (this.collectionInterval || this.characteristic) {
      this.onRawDataReceived?.('🛑 Data collection stopped');
    }
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    // Send stop command to ESP32 if connected
    if (this.characteristic && !this.isDemoMode) {
      this.sendStopCommand();
    }
  }

  private async sendStopCommand(): Promise<void> {
    if (this.characteristic) {
      try {
        const stopCommand = new TextEncoder().encode('STOP');
        await this.characteristic.writeValue(stopCommand);
        console.log('📡 Sent STOP command to ESP32');
        this.onRawDataReceived?.('📡 Sent STOP command to ESP32');
      } catch (error) {
        console.error('❌ Error sending stop command:', error);
        this.onRawDataReceived?.(`❌ Error sending stop command: ${error}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from ESP32...');
    this.onRawDataReceived?.('🔌 Disconnecting from ESP32...');
    this.stopDataCollection();
    
    if (this.characteristic) {
      try {
        await this.characteristic.stopNotifications();
      } catch (error) {
        console.error('Error stopping notifications:', error);
      }
    }
    
    if (this.server && this.server.connected) {
      this.server.disconnect();
    }
    
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isDemoMode = false;
    
    this.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    if (this.isDemoMode) {
      return true; // Demo devices are always "connected"
    }
    return this.server?.connected || false;
  }

  // Helper method to get device info
  getDeviceInfo(): { name: string; id: string; connected: boolean } | null {
    if (!this.device) return null;
    
    return {
      name: this.device.name || 'Unknown Device',
      id: this.device.id,
      connected: this.isConnected()
    };
  }
}

export default BLEManager;