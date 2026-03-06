'use client';

import React, { useState, useEffect } from 'react';

const OtaFlasher = () => {
    const [ip, setIp] = useState<string>('');
    const [status, setStatus] = useState<string>('Idle');
    const [progress, setProgress] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

    useEffect(() => {
        const savedIp = localStorage.getItem('device_ip');
        if (savedIp) setIp(savedIp);

        const handleIpUpdate = () => {
            const newIp = localStorage.getItem('device_ip');
            if (newIp) setIp(newIp);
        };
        window.addEventListener('ip_selected_from_selector', handleIpUpdate);
        return () => window.removeEventListener('ip_selected_from_selector', handleIpUpdate);
    }, []);

    const update = async () => {
        if (!ip) return;
        setIsUpdating(true);
        setStatus('Preparing OTA Update...');
        setProgress(0);

        let currentProgress = 0;

        try {
            const cleanIp = ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
            const url = `http://${cleanIp}/update`;

            setStatus('Fetching built firmware...');
            // Hardcode to m5-papers3 per user request
            const res = await fetch(`/build/m5-papers3/firmware.bin`);
            if (!res.ok) throw new Error('Failed to fetch firmware.bin. Have you built the firmware yet?');
            const firmwareBlob = await res.blob();

            const formData = new FormData();
            formData.append('file', firmwareBlob, 'firmware.bin');

            setStatus('Uploading firmware to device...');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    currentProgress = Math.round((e.loaded / e.total) * 100);
                    setProgress(currentProgress);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    setStatus('Update Successful! Device is rebooting...');
                } else {
                    setStatus(`Update Failed: ${xhr.statusText}`);
                }
                setIsUpdating(false);
            };

            xhr.onerror = () => {
                // If the connection resets right at the end, it's actually a success because the ESP32 rebooted itself
                if (currentProgress === 100) {
                    setStatus('Update Successful! Device is rebooting...');
                } else {
                    setStatus('Update Failed: Network Error');
                }
                setIsUpdating(false);
            };

            xhr.send(formData);
        } catch (err: any) {
            console.error(err);
            setStatus(`Update Error: ${err.message}`);
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 mt-2">
                <button
                    onClick={update}
                    disabled={isUpdating || !ip}
                    className={`py-3 mt-2 rounded-lg text-sm font-bold transition-all ${isUpdating || !ip
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        }`}
                >
                    {isUpdating ? `Updating ${progress}%` : 'Start OTA Update'}
                </button>
            </div>

            {status !== 'Idle' && (
                <div className={`mt-2 p-3 rounded-lg text-xs leading-relaxed ${status.includes('Successful') ? 'bg-green-900/20 text-green-400 border border-green-500/20' :
                    status.includes('Failed') ? 'bg-red-900/20 text-red-400 border border-red-500/20' :
                        'bg-blue-900/20 text-blue-400 border border-blue-500/20'
                    }`}>
                    {status}
                </div>
            )}
        </div>
    );
};

export default OtaFlasher;
