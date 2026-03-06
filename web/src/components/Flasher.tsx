'use client';

import React, { useState, useEffect } from 'react';
import { ESPLoader, Transport } from 'esptool-js';

const Flasher = () => {
    const [port, setPort] = useState<any>(null);
    const [status, setStatus] = useState<string>('Idle');
    const [progress, setProgress] = useState<number>(0);
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

            // Fetch all 3 binaries
            const fetchBinary = async (name: string) => {
                const url = `/build/${device}/${name}.bin`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.statusText} (${res.status})`);
                const buffer = await res.arrayBuffer();
                return esploader.ui8ToBstr(new Uint8Array(buffer));
            };

            setStatus('Downloading binaries...');
            const bootloader = await fetchBinary('bootloader');
            const partitions = await fetchBinary('partitions');
            const firmware = await fetchBinary('firmware');

            setStatus('Connecting to ESP32...');
            await esploader.main();

            setStatus('Erasing and flashing...');

            const fileContents = [
                { data: bootloader, address: 0x0000 },
                { data: partitions, address: 0x8000 },
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

            setStatus('Flash Successful!');
        } catch (err: any) {
            console.error('Flash error:', err);
            setStatus(`Flash Failed: ${err.message}`);
        } finally {
            setIsFlashing(false);
        }
    };

    return (
        <div className="glass p-8 rounded-2xl w-full max-w-2xl mx-auto flex flex-col gap-6 relative overflow-hidden">
            {!isSupported && (
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
                    <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-left">
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">How to fix:</p>
                        <ul className="text-xs text-blue-300 space-y-1 list-disc list-inside">
                            <li>Use <strong>Chrome</strong> or <strong>Edge</strong> browser</li>
                            <li>Access this tool via <strong>http://localhost:3000</strong></li>
                            <li>Avoid using local IP addresses (like 192.168.x.x)</li>
                        </ul>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    Firmware Flasher
                </h2>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${status === 'Idle' ? 'bg-gray-800 text-gray-400' :
                    status.includes('Failed') ? 'bg-red-900/40 text-red-400' :
                        status.includes('Successful') ? 'bg-green-900/40 text-green-400' :
                            'bg-blue-900/40 text-blue-400 animate-pulse'
                    }`}>
                    {status}
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <label className="text-sm text-gray-400">Target Device:</label>
                <select
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    className="bg-gray-900 text-white rounded-lg px-4 py-2 border border-gray-700 outline-none focus:border-blue-500 transition-colors"
                >
                    <option value="m5-papers3">M5PaperS3</option>
                    <option value="lilygo-t5-s3">Lilygo T5 S3</option>
                </select>
            </div>

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
                        Connect Device
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

            {status.includes('Successful') && (
                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl text-sm text-green-400">
                    Device flashed successfully! You can now configure it via the OTA interface or disconnect.
                </div>
            )}
        </div>
    );
};

export default Flasher;
