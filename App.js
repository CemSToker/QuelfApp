import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  Button,
  ScrollView,
  View,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const manager = new BleManager();

export default function App() {
  const [devices, setDevices] = useState({});
  const [uuid, setUuid] = useState('');
  const [data, setData] = useState('');
  const [connectedDeviceId, setConnectedDeviceId] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const granted =
        result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;

      if (!granted) {
        Alert.alert('Bluetooth permissions not granted');
      }

      return granted;
    }
    return true;
  };

  const scanDevices = async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    setDevices({});
    setData('');
    setConnectedDeviceId(null);
    setScanning(true);

    console.log('🔍 Scanning for nearby BLE devices...');

    manager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error('Scan error:', error);
        setScanning(false);
        return;
      }

      if (scannedDevice?.id) {
        setDevices(prev => ({
          ...prev,
          [scannedDevice.id]: scannedDevice,
        }));
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
      console.log('⏹️ Scan complete');
    }, 10000);
  };

  const connectToDevice = async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    try {
      const scannedDevice = await manager.connectToDevice(uuid);
      await scannedDevice.discoverAllServicesAndCharacteristics();
      setConnectedDeviceId(scannedDevice.id);
      console.log('🔗 Connected to device:', scannedDevice.id);

      const services = await scannedDevice.services();
      for (let service of services) {
        const characteristics = await service.characteristics();
        for (let char of characteristics) {
          if (char.isNotifiable) {
            char.monitor((err, c) => {
              if (c?.value) {
                const decoded = Buffer.from(c.value, 'base64').toString('utf8');
                setData(prev => prev + decoded + '\n');
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
      Alert.alert('Connection failed', 'Could not connect to device. Check the address and try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>Nearby BLE Devices</Text>
      <Button title={scanning ? 'Scanning...' : '🔄 Scan Devices'} onPress={scanDevices} disabled={scanning} />

      {scanning && (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 15 }} />
      )}

      {Object.values(devices).map((d) => (
        <TouchableOpacity
          key={d.id}
          onPress={() => setUuid(d.id)}
          style={{
            padding: 10,
            marginVertical: 5,
            backgroundColor: d.id === connectedDeviceId ? '#c8facc' : '#eee',
            borderRadius: 5,
          }}
        >
          <Text style={{ fontWeight: 'bold' }}>{d.name || '(No Name)'}</Text>
          <Text selectable>{d.id}</Text>
        </TouchableOpacity>
      ))}

      <Text style={{ marginTop: 20, fontWeight: 'bold' }}>Device Address to Connect:</Text>
      <TextInput
        placeholder="Paste or tap to autofill from list"
        value={uuid}
        onChangeText={setUuid}
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
          borderRadius: 5,
          borderColor: '#ccc',
        }}
      />
      <Button title="🔗 Connect to Device" onPress={connectToDevice} />

      <Text style={{ marginTop: 20, fontWeight: 'bold' }}>Received Data:</Text>
      <Text style={{ marginTop: 10 }}>{data || 'No data yet.'}</Text>
    </ScrollView>
  );
}
