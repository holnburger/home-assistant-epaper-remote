'use client';

import React, { useState, useEffect } from 'react';
import Flasher from '@/components/Flasher';
import OtaFlasher from '@/components/OtaFlasher';
import ConfigPanel from '@/components/ConfigPanel';
import DeviceSelector from '@/components/DeviceSelector';

type SetupStage = 'config' | 'usb' | 'ota';

export default function Home() {
  const [stage, setStage] = useState<SetupStage>('config');
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshDevices, setRefreshDevices] = useState(0);

  useEffect(() => {
    // Check local storage to see if they've successfully flashed via USB before
    const hasFlashedUsb = localStorage.getItem('has_flashed_usb');
    if (hasFlashedUsb) {
      setStage('ota');
    }
    setIsLoaded(true);

    const handleDevicesUpdated = () => setRefreshDevices(prev => prev + 1);
    window.addEventListener('devices_updated', handleDevicesUpdated);
    return () => window.removeEventListener('devices_updated', handleDevicesUpdated);
  }, []);

  const handleBuildComplete = () => {
    if (stage === 'config') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      setStage('usb');
    }
  };

  const handleFlashComplete = () => {
    setStage('ota');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Trigger selector reload in case USB flasher saved a new IP
    setRefreshDevices(prev => prev + 1);
  };

  if (!isLoaded) return null; // Avoid hydration mismatch

  return (
    <main className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header section */}
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 relative animate-pulse-slow">
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full"></div>
            <div className="glass rounded-2xl flex items-center justify-center w-full h-full relative z-10">
              <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-purple-500">
                HA
              </span>
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tighter">
            E-Ink <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Hub</span>
          </h1>
          <p className="text-gray-400 max-w-md">
            The ultimate companion for your Home Assistant setup. Flash over USB or update wirelessly.
          </p>
        </header>

        {/* Dynamic Guided Flow */}
        <div className="flex flex-col gap-8">

          <dl className="space-y-8">
            <ConfigPanel
              onBuildComplete={handleBuildComplete}
              isMinimized={stage !== 'config'}
              onExpand={() => setStage('config')}
              onCollapse={() => { if (localStorage.getItem('has_flashed_usb')) setStage('ota'); }}
            />

            <Flasher
              onFlashComplete={handleFlashComplete}
              isMinimized={stage !== 'usb'}
              isActive={stage === 'usb' || stage === 'ota'}
              onExpand={() => { if (stage !== 'config') setStage('usb'); }}
              onCollapse={() => { if (localStorage.getItem('has_flashed_usb')) setStage('ota'); }}
            />
          </dl>

        </div>

        {/* OTA Section */}
        <div className={`transition-all duration-700 ${stage === 'ota' ? 'opacity-100 ring-2 ring-purple-500/50 rounded-2xl p-2' : 'opacity-30 grayscale pointer-events-none'}`}>
          <div className="mb-6 px-2">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Step 3: Device Management & OTA
            </h2>
            <p className="text-sm text-gray-400 mt-1">Manage multiple remotes and push updates to them over your WiFi network.</p>
          </div>

          <section className="flex flex-col gap-6">
            <DeviceSelector
              key={refreshDevices}
              onDeviceSelected={(ip) => {
                localStorage.setItem('device_ip', ip);
                // Dispatch an event so OtaFlasher knows to update its internal IP state
                window.dispatchEvent(new Event('ip_selected_from_selector'));
              }}
            />
            <OtaFlasher />
          </section>
        </div>

        <footer className="pt-12 text-center text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          E-Ink HA Remote Dashboard &bull; 2026
        </footer>
      </div>
    </main>
  );
}
