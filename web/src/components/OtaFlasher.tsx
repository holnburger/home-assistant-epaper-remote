'use client';

import React, { useState } from 'react';

const OtaFlasher = () => {
    const [ip, setIp] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<string>('Idle');
    const [progress, setProgress] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const update = async () => {
        if (!ip || !file) return;
        setIsUpdating(true);
        setStatus('Updating...');
        setProgress(0);

        const cleanIp = ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const url = `http://${cleanIp}/update`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100));
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
                setStatus('Update Failed: Network Error');
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
        <div className="glass p-8 rounded-2xl flex flex-col gap-4">
            <h3 className="text-xl font-bold text-blue-400 font-sans tracking-tight">OTA Update</h3>
            <p className="text-sm text-gray-500">
                Update your device wirelessly. Enter the device IP and select the firmware binary.
            </p>

            <div className="flex flex-col gap-3 mt-2">
                <input
                    type="text"
                    placeholder="Device IP Address (e.g. 192.168.1.50)"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all text-white font-mono"
                />

                <div className="relative group">
                    <input
                        type="file"
                        accept=".bin"
                        onChange={handleFileChange}
                        className="hidden"
                        id="ota-file"
                    />
                    <label
                        htmlFor="ota-file"
                        className="flex items-center justify-center p-4 border-2 border-dashed border-gray-800 rounded-lg cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-sm text-gray-400"
                    >
                        {file ? file.name : 'Select firmware.bin'}
                    </label>
                </div>

                <button
                    onClick={update}
                    disabled={isUpdating || !ip || !file}
                    className={`py-3 rounded-lg text-sm font-bold transition-all ${isUpdating || !ip || !file
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
