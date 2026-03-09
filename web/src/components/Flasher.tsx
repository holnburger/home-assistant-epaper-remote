'use client';

import React, { useState, useEffect } from 'react';
import { ESPLoader, Transport } from 'esptool-js';

interface FlasherProps {
    onFlashComplete?: () => void;
    isMinimized?: boolean;
    isActive?: boolean;
    onExpand?: () => void;
    onCollapse?: () => void;
}

const Flasher: React.FC<FlasherProps> = ({ onFlashComplete, isMinimized = false, isActive = true, onExpand, onCollapse }) => {
    const [port, setPort] = useState<any>(null);
    const [status, setStatus] = useState<string>('Idle');
    const [progress, setProgress] = useState<number>(0);
    const [foundIp, setFoundIp] = useState<string>('');
    const [deviceName, setDeviceName] = useState('');
    const [device, setDevice] = useState<string>('m5-papers3');
    const [isFlashing, setIsFlashing] = useState<boolean>(false);

    const [isSupported, setIsSupported] = useState<boolean>(true);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serial' in navigator)) {
            setIsSupported(false);
            setStatus('WebSerial Not Supported');
        }
    }, []);

    const connect = async () => {
        if (!('serial' in navigator)) {
            setStatus('WebSerial Not Supported');
            return;
        }
        try {
            const p = await (navigator as any).serial.requestPort();
            setPort(p);
            setStatus('Connected');
        } catch (err) {
            console.error(err);
            setStatus('Connection Failed');
        }
    };

    const flash = async () => {
        if (!port) return;
        setIsFlashing(true);
        setStatus('Preparing binaries...');
        setProgress(0);

        try {
            const transport = new Transport(port);
            const esploader = new ESPLoader({
                transport,
                baudrate: 115200,
                romBaudrate: 115200,
            });

            // Fetch all 3 binaries and append timestamp to prevent Next.js caching
            const fetchBinary = async (name: string) => {
                const timestamp = Date.now();
                const url = `/build/${device}/${name}.bin?t=${timestamp}`;
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.statusText} (${res.status})`);
                const buffer = await res.arrayBuffer();
                return esploader.ui8ToBstr(new Uint8Array(buffer));
            };

            setStatus('Downloading binaries...');
            const bootloader = await fetchBinary('bootloader');
            const partitions = await fetchBinary('partitions');
            const bootApp0 = await fetchBinary('boot_app0');
            const firmware = await fetchBinary('firmware');

            setStatus('Connecting to ESP32...');
            await esploader.main();

            setStatus('Erasing and flashing...');

            const fileContents = [
                { data: bootloader, address: 0x0000 },
                { data: partitions, address: 0x8000 },
                { data: bootApp0, address: 0xe000 },
                { data: firmware, address: 0x10000 }
            ];

            await esploader.writeFlash({
                fileArray: fileContents,
                flashSize: 'keep',
                flashMode: 'dio',
                flashFreq: '40m',
                eraseAll: false,
                compress: true,
                reportProgress: (fileIndex: number, written: number, total: number) => {
                    // Update overall progress based on which file we are on
                    const offset = (fileIndex / fileContents.length) * 100;
                    const scale = 1 / fileContents.length;
                    setProgress(Math.round(offset + (written / total) * 100 * scale));
                },
            });

            setStatus('Flash Successful! Restarting device...');

            // Try to hard reset the board
            try {
                if (typeof (esploader as any).hardReset === 'function') {
                    await (esploader as any).hardReset();
                } else {
                    await transport.setDTR(false);
                    await transport.setRTS(true);
                    await new Promise(r => setTimeout(r, 100));
                    await transport.setDTR(false);
                    await transport.setRTS(false);
                }
            } catch (e) {
                console.warn("Could not hard reset", e);
            }

            // Disconnect ESPLoader transport to release the port
            await transport.disconnect();

            // Re-open port to monitor for IP address
            try {
                setStatus('Waiting for device to connect to WiFi...');
                await port.open({ baudRate: 115200 });
                const reader = port.readable.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                // Timeout after 15 seconds if no IP is found to avoid locking the port forever
                const timeoutId = setTimeout(() => {
                    reader.cancel().catch(() => { });
                    localStorage.setItem('has_flashed_usb', 'true');
                    if (onFlashComplete) onFlashComplete();
                }, 15000);

                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        if (value) {
                            const chunk = decoder.decode(value, { stream: true });
                            console.log('[WebSerial]', chunk);
                            buffer += chunk;
                            // Match the exact string output by the firmware, accommodating newlines/returns
                            const ipMatch = buffer.match(/WiFi Connected:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);

                            if (ipMatch) {
                                const matchedIp = ipMatch[1];
                                setStatus(`Ready! Device IP: ${matchedIp}`);
                                setFoundIp(matchedIp);
                                localStorage.setItem('device_ip', matchedIp);
                                localStorage.setItem('has_flashed_usb', 'true');
                                clearTimeout(timeoutId);
                                await reader.cancel();
                                // We intentionally DO NOT call onFlashComplete here.
                                // We wait for the user to click Save or Skip in the foundIp UI block below.
                                break;
                            } else if (buffer.length > 10000) {
                                // Keep buffer from growing infinitely
                                buffer = buffer.slice(-5000);
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                    await port.close();
                }
            } catch (e) {
                console.warn('Serial monitoring error:', e);
                setStatus('Flash Successful! Device Restarted.');
                localStorage.setItem('has_flashed_usb', 'true');
                if (onFlashComplete) onFlashComplete();
            }

        } catch (err: any) {
            console.error('Flash error:', err);
            setStatus(`Flash Failed: ${err.message}`);
        } finally {
            setIsFlashing(false);
        }
    };

    const saveDevice = () => {
        if (!foundIp || !deviceName) return;
        const newDevice = { id: `dev_${Date.now()}`, name: deviceName, ip: foundIp };

        try {
            const existing = JSON.parse(localStorage.getItem('saved_devices') || '[]');
            const updated = [...existing, newDevice];
            localStorage.setItem('saved_devices', JSON.stringify(updated));
            localStorage.setItem('active_device_id', newDevice.id);
            // We use a custom event to tell the DeviceSelector to reload
            window.dispatchEvent(new Event('devices_updated'));

            setStatus(`Device "${deviceName}" saved successfully.`);
            setFoundIp('');
            if (onFlashComplete) onFlashComplete();
        } catch (e) {
            console.error("Failed to save device", e);
        }
    };

    if (isMinimized) {
        return (
            <div onClick={onExpand} className="glass p-4 rounded-xl flex items-center justify-between opacity-70 filter grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                <div>
                    <h3 className="text-sm font-bold text-gray-400">Step 2: USB Flash</h3>
                    <p className="text-xs text-gray-500">Device was successfully flashed via USB.</p>
                </div>
                <div className="text-xs text-green-500 bg-green-900/40 px-3 py-1 rounded-full">Completed</div>
            </div>
        );
    }

    return (
        <div className={`glass p-8 rounded-2xl w-full max-w-2xl mx-auto flex flex-col gap-6 relative overflow-hidden transition-all duration-500 ${isActive ? 'ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10' : 'opacity-40 grayscale pointer-events-none'}`}>
            {onCollapse && (typeof window !== 'undefined' && (localStorage.getItem('has_flashed_usb') || localStorage.getItem('saved_devices')?.includes('dev_'))) && (
                <button
                    onClick={onCollapse}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-900/50 p-2 rounded-full border border-gray-800 z-30"
                    title="Collapse Panel"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
            )}
            {!isSupported && isActive && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/50">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">WebSerial Not Available</h3>
                    <p className="text-gray-400 text-sm max-w-sm">
                        WebSerial is only available in <strong>Chrome</strong> or <strong>Edge</strong> over a secure connection (<strong>localhost</strong> or HTTPS).
                    </p>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Step 1.2: USB Flasher
                    </h2>
                    <p className="text-xs text-purple-300/60 mt-1 flex items-center gap-1.5">
                        <svg className="w-3.3 h-3.3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Connect via USB (Chrome/Edge Required)
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${status === 'Idle' ? 'bg-gray-800 text-gray-400' :
                    status.includes('Failed') ? 'bg-red-900/40 text-red-400' :
                        status.includes('Successful') ? 'bg-green-900/40 text-green-400' :
                            'bg-blue-900/40 text-blue-400 animate-pulse'
                    }`}>
                    {status}
                </div>
            </div>

            {/* Dropped target device selector for now as it will be managed globally soon */}

            <div className="flex flex-col gap-2">
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                    <span></span>
                    <span>{progress}%</span>
                    <span></span>
                </div>
            </div>

            <div className="flex gap-4">
                {!port ? (
                    <button
                        onClick={connect}
                        className="glow-button flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all"
                    >
                        Connect via USB
                    </button>
                ) : (
                    <button
                        onClick={flash}
                        disabled={isFlashing}
                        className={`glow-button flex-1 py-3 ${isFlashing ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'} rounded-xl font-bold transition-all`}
                    >
                        {isFlashing ? 'Flashing...' : 'Flash Firmware'}
                    </button>
                )}
            </div>

            {foundIp ? (
                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl flex flex-col gap-3 mt-2">
                    <p className="text-sm text-green-400 font-bold">
                        Device flashed and connected to WiFi: <span className="text-white font-mono">{foundIp}</span>
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Name your device (e.g. Living Room Remote)"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            className="flex-1 bg-black/40 border border-green-500/50 rounded-lg px-4 py-3 text-sm outline-none text-white focus:ring-1 focus:ring-green-500"
                        />
                        <button
                            onClick={saveDevice}
                            disabled={!deviceName}
                            className={`px-6 rounded-lg text-sm font-bold transition-all ${!deviceName ? 'bg-gray-800 text-gray-500' : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'}`}
                        >
                            Save Device
                        </button>
                        <button
                            onClick={() => { setFoundIp(''); if (onFlashComplete) onFlashComplete(); }}
                            className="px-4 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Skip
                        </button>
                    </div>
                </div>
            ) : status.includes('Successful') && (
                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl text-sm text-green-400">
                    Device flashed successfully! You can now configure it via the OTA interface or disconnect.
                </div>
            )}
        </div>
    );
};

export default Flasher;
