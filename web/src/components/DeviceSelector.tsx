'use client';

import React, { useState, useEffect } from 'react';

export interface DeviceProfile {
    id: string;
    name: string;
    ip: string;
}

interface DeviceSelectorProps {
    onDeviceSelected: (ip: string) => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ onDeviceSelected }) => {
    const [devices, setDevices] = useState<DeviceProfile[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

    const [isAddingManually, setIsAddingManually] = useState(false);
    const [manualIp, setManualIp] = useState('');
    const [manualName, setManualName] = useState('');

    // Initial load from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('saved_devices');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as DeviceProfile[];
                setDevices(parsed);
                // Also check if there's an active selected ID
                const active = localStorage.getItem('active_device_id');
                if (active && parsed.some(d => d.id === active)) {
                    setActiveDeviceId(active);
                    onDeviceSelected(parsed.find(d => d.id === active)!.ip);
                } else if (parsed.length > 0) {
                    setActiveDeviceId(parsed[0].id);
                    onDeviceSelected(parsed[0].ip);
                }
            } catch (e) {
                console.error('Failed to parse saved devices');
            }
        }
    }, [onDeviceSelected]);

    const handleSelect = (id: string, ip: string) => {
        setActiveDeviceId(id);
        localStorage.setItem('active_device_id', id);
        onDeviceSelected(ip);
    };

    const handleDelete = (id: string) => {
        const newDevices = devices.filter(d => d.id !== id);
        setDevices(newDevices);
        localStorage.setItem('saved_devices', JSON.stringify(newDevices));
        if (activeDeviceId === id) {
            setActiveDeviceId(null);
            localStorage.removeItem('active_device_id');
            onDeviceSelected('');
        }
    };

    const saveManualDevice = () => {
        if (!manualIp || !manualName) return;
        const newDevice = { id: `dev_${Date.now()}`, name: manualName, ip: manualIp };

        try {
            const updated = [...devices, newDevice];
            localStorage.setItem('saved_devices', JSON.stringify(updated));
            setDevices(updated);

            // Auto-select the newly added device
            setActiveDeviceId(newDevice.id);
            localStorage.setItem('active_device_id', newDevice.id);
            onDeviceSelected(manualIp);

            setIsAddingManually(false);
            setManualIp('');
            setManualName('');
        } catch (e) {
            console.error("Failed to save device manually", e);
        }
    };

    return (
        <div className="glass p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white font-sans tracking-tight">Active Device</h3>
                <button
                    onClick={() => setIsAddingManually(!isAddingManually)}
                    className="text-sm bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Device
                </button>
            </div>

            <p className="text-sm text-gray-500">
                Select your target M5PaperS3 from your saved devices, or configure a new one. Future versions will support adding generic devices.
            </p>

            {isAddingManually && (
                <div className="bg-gray-900/40 p-4 rounded-xl border border-blue-500/30 flex flex-col gap-3">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Device IP (e.g. 192.168.1.10)"
                            value={manualIp}
                            onChange={(e) => setManualIp(e.target.value)}
                            autoFocus
                            className="w-1/2 bg-black/40 border border-gray-700/50 rounded-lg px-3 py-2 text-sm outline-none text-white focus:border-blue-500 transition-colors font-mono"
                        />
                        <input
                            type="text"
                            placeholder="Device Name (e.g. Kitchen)"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="w-1/2 bg-black/40 border border-gray-700/50 rounded-lg px-3 py-2 text-sm outline-none text-white focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="flex justify-end gap-2 text-sm">
                        <button
                            onClick={() => setIsAddingManually(false)}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveManualDevice}
                            disabled={!manualIp || !manualName}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${!manualIp || !manualName
                                    ? 'bg-gray-800 text-gray-500'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                }`}
                        >
                            Save Device
                        </button>
                    </div>
                </div>
            )}

            {devices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map((device) => (
                        <div
                            key={device.id}
                            onClick={() => handleSelect(device.id, device.ip)}
                            className={`p-4 rounded-xl cursor-pointer border transition-all ${activeDeviceId === device.id ? 'bg-blue-900/40 border-blue-500/50 shadow-lg shadow-blue-500/20' : 'bg-gray-900/40 border-gray-800 hover:border-gray-600'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`font-bold ${activeDeviceId === device.id ? 'text-blue-400' : 'text-gray-300'}`}>{device.name}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(device.id); }}
                                    className="text-gray-600 hover:text-red-400 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                            <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${activeDeviceId === device.id ? 'bg-green-500' : 'bg-gray-700'}`}></span>
                                {device.ip}
                            </div>
                        </div>
                    ))}
                </div>
            ) : !isAddingManually && (
                <div className="p-4 rounded-xl bg-gray-900/20 border border-gray-800/50 text-center text-gray-500 text-sm">
                    No devices saved yet. Click 'Add Device' above to manually add one, or run the USB Flasher first.
                </div>
            )}
        </div>
    );
};

export default DeviceSelector;
