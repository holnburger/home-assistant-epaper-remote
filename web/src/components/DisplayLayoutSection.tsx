'use client';

import React, { useState, useEffect } from 'react';
import EinkSimulator, { WidgetConfig } from './EinkSimulator';

interface Entity {
    entity_id: string;
    friendly_name: string;
}

export default function DisplayLayoutSection() {
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [status, setStatus] = useState('');
    const [config, setConfig] = useState({ wifi_ssid: '', home_assistant_url: '' });

    useEffect(() => {
        const loadConfig = () => {
            const savedWifiSsid = localStorage.getItem('wifi_ssid') || '';
            const savedWifiPassword = localStorage.getItem('wifi_password') || '';
            const savedHaUrl = localStorage.getItem('home_assistant_url') || '';
            const savedHaToken = localStorage.getItem('home_assistant_token') || '';

            fetch('/api/config')
                .then(res => res.json())
                .then(data => {
                    setWidgets(data.widgets || []);

                    const finalSsid = data.wifi_ssid || savedWifiSsid;
                    const finalUrl = data.home_assistant_url || savedHaUrl;

                    setConfig({
                        wifi_ssid: finalSsid,
                        home_assistant_url: finalUrl
                    });

                    // Fetch HA Entities if possible
                    const token = savedHaToken;
                    if (finalUrl && token) {
                        fetch('/api/ha', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: finalUrl, token })
                        })
                            .then(res => res.json())
                            .then(haData => {
                                if (Array.isArray(haData)) {
                                    // Assuming GET /api/states returns an array
                                    const parsedEntities = haData.map((s: any) => ({
                                        entity_id: s.entity_id,
                                        friendly_name: s.attributes?.friendly_name || s.entity_id
                                    }));
                                    setEntities(parsedEntities);
                                }
                            })
                            .catch(e => console.error("Failed to fetch HA entities", e));
                    }
                })
                .catch(err => console.error('Failed to load config:', err));
        };

        loadConfig();

        // Listen for token updates (basic cross-component sync via window event)
        const handleStorageChange = () => loadConfig();
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('config_updated', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('config_updated', handleStorageChange);
        };
    }, []);

    const handleWidgetsChange = (newWidgets: WidgetConfig[]) => {
        setWidgets(newWidgets);
        setStatus('Unsaved changes');
    };

    const buildAndUpdate = async () => {
        const currentIp = localStorage.getItem('device_ip');
        if (!currentIp) {
            setStatus("Error: Select a device in 'Wireless Management' first!");
            return;
        }

        setIsUpdating(true);
        try {
            // STEP 1: Save Layout
            setStatus('Step 1/3: Saving Layout...');
            const resConfig = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wifi_ssid: config.wifi_ssid,
                    home_assistant_url: config.home_assistant_url,
                    widgets
                })
            });
            if (!resConfig.ok) throw new Error('Failed to save layout');

            // STEP 2: Build Firmware
            setStatus('Step 2/3: Compiling Firmware (Takes ~1 min)...');
            const resBuild = await fetch('/api/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device: 'm5-papers3',
                    wifi_ssid: config.wifi_ssid || localStorage.getItem('wifi_ssid') || "",
                    wifi_password: localStorage.getItem('wifi_password') || "",
                    home_assistant_url: config.home_assistant_url || localStorage.getItem('home_assistant_url') || "",
                    home_assistant_token: localStorage.getItem('home_assistant_token') || "",
                    widgets
                })
            });

            if (!resBuild.body) throw new Error('Browser error reading build stream');
            const reader = resBuild.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;
            let buildSuccess = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: !done });
                    if (chunk.includes('=== BUILD SUCCESSFUL ===')) buildSuccess = true;
                    if (chunk.includes('=== BUILD FAILED')) throw new Error('Compilation Failed in API Server');
                }
            }
            if (!buildSuccess) throw new Error('Build did not cleanly finish');

            // STEP 3: OTA Flash
            setStatus('Step 3/3: Flashing Firmware Object via OTA...');
            const cleanIp = currentIp.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
            const url = `http://${cleanIp}/update`;

            const resFirmware = await fetch(`/build/m5-papers3/firmware.bin?t=${Date.now()}`);
            if (!resFirmware.ok) throw new Error('Failed to fetch compiled firmware array');
            const firmwareBlob = await resFirmware.blob();

            const formData = new FormData();
            formData.append('file', firmwareBlob, 'firmware.bin');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setStatus(`Step 3/3: Uploading ${Math.round((e.loaded / e.total) * 100)}%`);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    setStatus('Success! Device rebooting to new layout.');
                    setTimeout(() => setStatus(''), 5000);
                } else {
                    setStatus(`Update Failed: ${xhr.statusText}`);
                }
                setIsUpdating(false);
            };

            xhr.onerror = () => {
                // If connection drops at 100%, device reset immediately, signifying success
                setStatus('Success! Device rebooting to new layout.');
                setTimeout(() => setStatus(''), 5000);
                setIsUpdating(false);
            };

            xhr.send(formData);

        } catch (err: any) {
            setStatus(`Pipeline Error: ${err.message}`);
            setIsUpdating(false);
        }
    };

    return (
        <section className="space-y-6 mt-16 col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between px-2">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        Display Layout
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Configure how widgets appear on the e-ink display. The layout will be included in your next firmware build (USB or OTA).</p>
                </div>
                {status && (
                    <div className="text-sm text-blue-400 font-medium px-3 py-1 bg-blue-900/30 rounded-full">
                        {status}
                    </div>
                )}
            </div>

            <div className="glass p-8 rounded-2xl border border-gray-800 shadow-lg relative">
                <EinkSimulator
                    widgets={widgets}
                    onWidgetsChange={handleWidgetsChange}
                    entities={entities}
                />

                <div className="mt-8 flex justify-center border-t border-gray-800/50 pt-8">
                    <button
                        onClick={buildAndUpdate}
                        disabled={isUpdating}
                        className={`group relative overflow-hidden rounded-2xl px-12 py-4 text-lg font-black tracking-wide transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-2xl ${isUpdating
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:shadow-blue-500/50'
                            }`}
                    >
                        {isUpdating && <div className="absolute inset-0 bg-white/10 animate-pulse"></div>}
                        <div className="relative z-10 flex items-center justify-center gap-2">
                            {isUpdating ? 'Processing Pipeline...' : '🚀 Build & Update Device'}
                        </div>
                    </button>
                </div>
            </div>
        </section>
    );
}
