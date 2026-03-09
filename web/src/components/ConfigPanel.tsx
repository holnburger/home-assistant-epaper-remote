'use client';

import React, { useState, useEffect } from 'react';

interface ConfigPanelProps {
    onBuildComplete?: () => void;
    isMinimized?: boolean;
    onExpand?: () => void;
    onCollapse?: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onBuildComplete, isMinimized = false, onExpand, onCollapse }) => {
    const [config, setConfig] = useState({
        wifi_ssid: '',
        wifi_password: '',
        home_assistant_url: '',
        home_assistant_token: ''
    });
    const [status, setStatus] = useState('Idle');
    const [isSaving, setIsSaving] = useState(false);
    const [isBuilding, setIsBuilding] = useState(false);
    const [buildLog, setBuildLog] = useState('');

    const [progress, setProgress] = useState(0);

    // Initial load effects
    useEffect(() => {
        // Load API config
        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                setConfig(prev => ({
                    ...prev,
                    wifi_ssid: data.wifi_ssid || '',
                    home_assistant_url: data.home_assistant_url || ''
                }));
            })
            .catch(err => console.error('Failed to load config:', err));

        // Load secrets from local storage
        const savedWifiPassword = localStorage.getItem('wifi_password');
        const savedHaToken = localStorage.getItem('home_assistant_token');
        if (savedWifiPassword || savedHaToken) {
            setConfig(prev => ({
                ...prev,
                wifi_password: savedWifiPassword || '',
                home_assistant_token: savedHaToken || ''
            }));
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));

        // Save secrets to local storage as they are typed
        if (name === 'wifi_password' || name === 'home_assistant_token') {
            localStorage.setItem(name, value);
        }
    };

    const saveConfig = async () => {
        setIsSaving(true);
        setStatus('Saving...');
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (res.ok) {
                setStatus('Config Saved! (Passwords are required for each build)');
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const buildFirmware = async () => {
        setIsBuilding(true);
        setStatus('Building Firmware...');
        setProgress(5); // Initial connection progress
        setBuildLog('');

        try {
            const res = await fetch('/api/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device: 'm5-papers3',
                    ...config
                })
            });

            if (!res.body) throw new Error('ReadableStream not supported in this browser.');

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;
            let currentLog = '';

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: !done });
                    currentLog += chunk;
                    setBuildLog(prev => prev + chunk);

                    // Estimate progress based on PlatformIO output keywords
                    if (chunk.includes('Resolving dependencies')) setProgress(15);
                    else if (chunk.includes('Compiling .pio')) setProgress(prev => Math.min(prev + 2, 80)); // Increment on compile lines up to 80%
                    else if (chunk.includes('Linking .pio')) setProgress(85);
                    else if (chunk.includes('Building .pio')) setProgress(90);
                    else if (chunk.includes('=== BUILD SUCCESSFUL ===')) {
                        setProgress(100);
                        setStatus('Build Successful!');
                        setTimeout(() => setProgress(0), 3000); // Hide after 3s
                        if (onBuildComplete) onBuildComplete();
                    }
                    else if (chunk.includes('=== BUILD FAILED')) {
                        setProgress(0);
                        setStatus('Build Failed. See log.');
                    }
                }
            }

        } catch (err: any) {
            setStatus(`Build Error: ${err.message}`);
            setProgress(0);
        } finally {
            setIsBuilding(false);
        }
    };

    if (isMinimized) {
        return (
            <div onClick={onExpand} className="glass p-4 rounded-xl flex items-center justify-between opacity-70 filter grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                <div>
                    <h3 className="text-sm font-bold text-gray-400">Step 1.1: Configuration</h3>
                    <p className="text-xs text-gray-500">SSID: {config.wifi_ssid || 'Not configured'}</p>
                </div>
                <div className="text-xs text-green-500 bg-green-900/40 px-3 py-1 rounded-full">Completed</div>
            </div>
        );
    }

    return (
        <div className="glass p-8 rounded-2xl flex flex-col gap-6 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10 relative">
            {onCollapse && (typeof window !== 'undefined' && (localStorage.getItem('has_flashed_usb') || localStorage.getItem('saved_devices')?.includes('dev_'))) && (
                <button
                    onClick={onCollapse}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-gray-900/50 p-2 rounded-full border border-gray-800"
                    title="Collapse Panel"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
            )}
            <div className="flex justify-between items-center pr-12">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Step 1.1: Configuration
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">Provide your WiFi and Home Assistant details for the initial build.</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${status === 'Idle' ? 'bg-gray-800 text-gray-400' :
                    status.includes('Error') || status.includes('Failed') ? 'bg-red-900/40 text-red-400' :
                        status.includes('Saved') || status.includes('Successful') ? 'bg-green-900/40 text-green-400' :
                            'bg-blue-900/40 text-blue-400 animate-pulse'
                    }`}>
                    {status}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">WiFi SSID</label>
                    <input
                        type="text"
                        name="wifi_ssid"
                        value={config.wifi_ssid}
                        onChange={handleChange}
                        placeholder="SSID"
                        className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 outline-none transition-all"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                        WiFi Password
                    </label>
                    <input
                        type="password"
                        name="wifi_password"
                        value={config.wifi_password}
                        onChange={handleChange}
                        placeholder="Enter password"
                        className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 outline-none transition-all"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">HA WebSocket URL</label>
                    <input
                        type="text"
                        name="home_assistant_url"
                        value={config.home_assistant_url}
                        onChange={handleChange}
                        placeholder="ws://IP:8123/api/websocket"
                        className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 outline-none transition-all"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                        HA Token
                    </label>
                    <input
                        type="password"
                        name="home_assistant_token"
                        value={config.home_assistant_token}
                        onChange={handleChange}
                        placeholder="Enter token"
                        className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
                <button
                    onClick={saveConfig}
                    disabled={isSaving || isBuilding}
                    className={`flex-1 min-w-[150px] py-3 rounded-xl text-sm font-bold transition-all ${isSaving || isBuilding
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                        }`}
                >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>

                <button
                    onClick={buildFirmware}
                    disabled={isSaving || isBuilding}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${isSaving || isBuilding
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        }`}
                >
                    {isBuilding ? 'Building...' : 'Build Firmware (M5PaperS3)'}
                </button>
            </div>

            {progress > 0 && (
                <div className="w-full bg-gray-900 rounded-full h-2.5 my-2 overflow-hidden border border-gray-800">
                    <div
                        className={`block h-2.5 rounded-full transition-all duration-1000 ease-in-out ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'
                            }`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}

            {buildLog && (
                <div className="mt-4 flex flex-col gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Build Log</label>
                    <pre className="bg-black/80 p-4 rounded-xl text-[10px] text-gray-300 font-mono overflow-auto max-h-48 whitespace-pre-wrap border border-gray-800">
                        {buildLog}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default ConfigPanel;
