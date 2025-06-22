class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  public onDataReceived: ((data: number[]) => void) | null = null;
  public onConnectionChange: ((connected: boolean) => void) | null = null;

  private readonly SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  private readonly CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  async scanForDevices(): Promise<BluetoothDevice[]> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        this.SERVICE_UUID,
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
      ]
    });
    return [device];
  }

  async connect(device: BluetoothDevice): Promise<void> {
    this.device = device;
    if (device.gatt) {
      this.server = await device.gatt.connect();
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID);
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged.bind(this));
      device.addEventListener('gattserverdisconnected', () => this.onConnectionChange?.(false));
    }
    this.onConnectionChange?.(true);
  }

  private handleCharacteristicValueChanged(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;

    if (!value || !this.isCollecting) return;

    try {
      const raw = new Uint8Array(value.buffer);
      if (raw.length >= 8) {
        const pressureValues = Array.from(raw.slice(0, 8));
        console.log('[BLE] Raw pressure values:', pressureValues);
        this.onDataReceived?.(pressureValues);
        return;
      }

      const text = new TextDecoder().decode(value);
      const parts = text.trim().split(',').map(v => parseInt(v));
      if (parts.length >= 8 && parts.every(n => !isNaN(n))) {
        const pressureValues = parts.slice(0, 8);
        console.log('[BLE] Parsed string values:', pressureValues);
        this.onDataReceived?.(pressureValues);
      }
    } catch (e) {
      console.error('[BLE] Parse error:', e);
    }
  }

  startDataCollection(): void {
    this.isCollecting = true;
    if (!this.characteristic || this.device?.id?.startsWith('demo-')) {
      this.simulateDataCollection();
    } else {
      this.sendCommand('START');
    }
  }

  stopDataCollection(): void {
    this.isCollecting = false;
    if (this.collectionInterval) clearInterval(this.collectionInterval);
    if (this.characteristic && !this.device?.id?.startsWith('demo-')) {
      this.sendCommand('STOP');
    }
  }

  private async sendCommand(cmd: string): Promise<void> {
    if (this.characteristic) {
      try {
        await this.characteristic.writeValue(new TextEncoder().encode(cmd));
      } catch (e) {
        console.error('[BLE] Command send error:', e);
      }
    }
  }

  private simulateDataCollection(): void {
    this.collectionInterval = setInterval(() => {
      if (!this.isCollecting) return;
      const data = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
      this.onDataReceived?.(data);
    }, 500);
  }

  async disconnect(): Promise<void> {
    this.stopDataCollection();
    if (this.characteristic) {
      try {
        await this.characteristic.stopNotifications();
      } catch {}
    }
    if (this.server?.connected) this.server.disconnect();
    this.device = this.server = this.service = this.characteristic = null;
    this.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    return !!(this.server?.connected);
  }

  getDeviceInfo(): { name: string; id: string; connected: boolean } | null {
    if (!this.device) return null;
    return {
      name: this.device.name || 'Unknown',
      id: this.device.id,
      connected: this.isConnected()
    };
  }
}

export default BLEManager;
