class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  public onDataReceived: ((data: number[]) => void) | null = null;
  public onConnectionChange: ((connected: boolean) => void) | null = null;

  // Updated UUIDs - these should match your ESP32 implementation
  private readonly SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  private readonly CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  async scanForDevices(): Promise<BluetoothDevice[]> {
    try {
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }

      console.log('Scanning for BLE devices...');
      
      // More flexible device scanning - look for ESP32 devices
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          this.SERVICE_UUID,
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
        ]
      });

      console.log('Found device:', device.name || 'Unknown Device', device.id);
      return [device];
      
    } catch (error) {
      console.error('Error scanning for devices:', error);
      
      // If user cancelled or no devices found, still show mock devices for demo
      if (error instanceof Error && error.message.includes('User cancelled')) {
        throw error;
      }
      
      console.log('Falling back to demo mode...');
      return this.getMockDevices();
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
      console.log('Attempting to connect to device:', device.name || 'Unknown');
      this.device = device;
      
      // For real BLE devices
      if (device.gatt && device.id !== 'demo-esp32-left' && device.id !== 'demo-esp32-right') {
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
          console.log('Device disconnected');
          this.onConnectionChange?.(false);
        });
        
        console.log('Successfully connected to ESP32 device');
      } else {
        // Demo mode
        console.log('Using demo mode for device:', device.name);
        this.simulateConnection();
      }
      
      this.onConnectionChange?.(true);
      
    } catch (error) {
      console.error('Error connecting to device:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('GATT operation not permitted')) {
          throw new Error('Device connection failed. Make sure the ESP32 is advertising and not connected to another device.');
        } else if (error.message.includes('Service not found')) {
          throw new Error('ESP32 service not found. Please check that your ESP32 is running the correct firmware with the expected service UUID.');
        } else if (error.message.includes('Characteristic not found')) {
          throw new Error('ESP32 characteristic not found. Please verify the characteristic UUID in your ESP32 code.');
        }
      }
      
      // Fall back to demo mode
      console.log('Falling back to demo mode due to connection error');
      this.simulateConnection();
    }
  }

  private simulateConnection(): void {
    this.device = { 
      id: 'demo-device', 
      name: 'Demo ESP32 Sensor',
      gatt: null 
    } as BluetoothDevice;
    this.onConnectionChange?.(true);
  }

  private handleCharacteristicValueChanged(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    
    if (value && this.isCollecting) {
      try {
        console.log('Received BLE data, length:', value.byteLength);
        
        // Method 1: Try parsing as string (most common ESP32 format)
        const decoder = new TextDecoder();
        const dataString = decoder.decode(value);
        console.log('Received string data:', dataString);
        
        // Check if it's comma-separated values
        if (dataString.includes(',')) {
          const pressureValues = dataString.trim().split(',')
            .map(val => {
              const num = parseInt(val.trim(), 10);
              return isNaN(num) ? 0 : Math.max(0, Math.min(255, num)); // Clamp to 0-255
            })
            .filter((_, index) => index < 8); // Take only first 8 values
          
          if (pressureValues.length === 8) {
            console.log('Parsed pressure values:', pressureValues);
            this.onDataReceived?.(pressureValues);
            return;
          }
        }
        
        // Method 2: Try parsing as space-separated values
        if (dataString.includes(' ')) {
          const pressureValues = dataString.trim().split(/\s+/)
            .map(val => {
              const num = parseInt(val.trim(), 10);
              return isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
            })
            .filter((_, index) => index < 8);
          
          if (pressureValues.length === 8) {
            console.log('Parsed space-separated values:', pressureValues);
            this.onDataReceived?.(pressureValues);
            return;
          }
        }
        
        // Method 3: Try parsing as single number (if ESP32 sends one value at a time)
        const singleValue = parseInt(dataString.trim(), 10);
        if (!isNaN(singleValue)) {
          // For single values, we'll need to handle this differently
          // This is a fallback - ideally ESP32 should send all 8 values
          console.log('Received single value:', singleValue);
          const paddedValues = Array(8).fill(singleValue);
          this.onDataReceived?.(paddedValues);
          return;
        }
        
        // Method 4: Try parsing as raw bytes
        const data = new Uint8Array(value.buffer);
        console.log('Raw byte data:', Array.from(data));
        
        if (data.length >= 8) {
          const pressureValues = Array.from(data.slice(0, 8));
          console.log('Parsed byte values:', pressureValues);
          this.onDataReceived?.(pressureValues);
          return;
        }
        
        // Method 5: Try parsing as 16-bit values (if ESP32 sends 2 bytes per sensor)
        if (data.length >= 16) {
          const pressureValues = [];
          for (let i = 0; i < 16; i += 2) {
            const value = (data[i + 1] << 8) | data[i]; // Little endian
            pressureValues.push(Math.max(0, Math.min(255, value)));
          }
          console.log('Parsed 16-bit values:', pressureValues.slice(0, 8));
          this.onDataReceived?.(pressureValues.slice(0, 8));
          return;
        }
        
        console.warn('Could not parse ESP32 data format:', dataString, 'Raw bytes:', Array.from(data));
        
      } catch (error) {
        console.error('Error parsing ESP32 data:', error);
      }
    }
  }

  startDataCollection(): void {
    this.isCollecting = true;
    console.log('Starting data collection...');
    
    // If we have a real BLE connection, data will come via notifications
    // For demo purposes, simulate data when no real connection
    if (!this.characteristic || this.device?.id?.startsWith('demo-')) {
      this.simulateDataCollection();
    } else {
      // For real ESP32 connection, you might want to send a start command
      this.sendStartCommand();
    }
  }

  private async sendStartCommand(): Promise<void> {
    if (this.characteristic) {
      try {
        // Send start command to ESP32 (customize based on your ESP32 implementation)
        const startCommand = new TextEncoder().encode('START');
        await this.characteristic.writeValue(startCommand);
        console.log('Sent START command to ESP32');
      } catch (error) {
        console.error('Error sending start command:', error);
      }
    }
  }

  private simulateDataCollection(): void {
    console.log('Starting simulated data collection...');
    this.collectionInterval = setInterval(() => {
      if (!this.isCollecting) return;
      
      // Generate realistic pressure data with some variation
      const baseValues = [88, 122, 199, 145, 101, 92, 130, 88];
      const simulatedData = baseValues.map(base => 
        Math.max(0, Math.min(255, base + Math.floor(Math.random() * 40 - 20)))
      );
      
      this.onDataReceived?.(simulatedData);
    }, 500); // Faster updates for demo
  }

  stopDataCollection(): void {
    this.isCollecting = false;
    console.log('Stopping data collection...');
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    // Send stop command to ESP32 if connected
    if (this.characteristic && !this.device?.id?.startsWith('demo-')) {
      this.sendStopCommand();
    }
  }

  private async sendStopCommand(): Promise<void> {
    if (this.characteristic) {
      try {
        const stopCommand = new TextEncoder().encode('STOP');
        await this.characteristic.writeValue(stopCommand);
        console.log('Sent STOP command to ESP32');
      } catch (error) {
        console.error('Error sending stop command:', error);
      }
    }
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from device...');
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
    
    this.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    if (this.device?.id?.startsWith('demo-')) {
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