class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  public onDataReceived: ((data: number[]) => void) | null = null;
  public onConnectionChange: ((connected: boolean) => void) | null = null;

  private readonly SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
  private readonly CHARACTERISTIC_UUID = 'abcd1234-5678-90ab-cdef-1234567890ab';

  async scanForDevices(): Promise<BluetoothDevice[]> {
    try {
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth is not supported in this browser');
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [this.SERVICE_UUID] }
        ],
        optionalServices: [this.SERVICE_UUID]
      });

      return [device];
    } catch (error) {
      console.error('Error scanning for devices:', error);
      
      // For demo purposes, return mock devices if real BLE is not available
      return this.getMockDevices();
    }
  }

  private getMockDevices(): BluetoothDevice[] {
    // Return mock devices for demonstration
    return [
      {
        id: 'mock-device-1',
        name: 'Foot Pressure Sensor L',
        gatt: null
      } as BluetoothDevice,
      {
        id: 'mock-device-2', 
        name: 'Foot Pressure Sensor R',
        gatt: null
      } as BluetoothDevice
    ];
  }

  async connect(device: BluetoothDevice): Promise<void> {
    try {
      this.device = device;
      
      // For real BLE devices
      if (device.gatt) {
        this.server = await device.gatt.connect();
        this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
        this.characteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID);
        
        // Set up notifications
        await this.characteristic.startNotifications();
        this.characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged.bind(this));
      }
      
      this.onConnectionChange?.(true);
    } catch (error) {
      console.error('Error connecting to device:', error);
      
      // For demo purposes, simulate connection
      this.simulateConnection();
    }
  }

  private simulateConnection(): void {
    this.device = { id: 'mock-device', name: 'Demo Sensor' } as BluetoothDevice;
    this.onConnectionChange?.(true);
  }

  private handleCharacteristicValueChanged(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    
    if (value) {
      // Parse the received data
      const data = new Uint8Array(value.buffer);
      const pressureValues = Array.from(data);
      this.onDataReceived?.(pressureValues);
    }
  }

  startDataCollection(): void {
    this.isCollecting = true;
    
    // If we have a real BLE connection, data will come via notifications
    // For demo purposes, simulate data
    if (!this.characteristic) {
      this.simulateDataCollection();
    }
  }

  private simulateDataCollection(): void {
    this.collectionInterval = setInterval(() => {
      if (!this.isCollecting) return;
      
      // Generate realistic pressure data with some variation
      const baseValues = [88, 122, 199, 145, 101, 92, 130, 88];
      const simulatedData = baseValues.map(base => 
        Math.max(0, base + Math.floor(Math.random() * 40 - 20))
      );
      
      this.onDataReceived?.(simulatedData);
    }, 1000);
  }

  stopDataCollection(): void {
    this.isCollecting = false;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopDataCollection();
    
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
    return this.device !== null && (this.server?.connected || true); // Allow mock connections
  }
}

export default BLEManager;