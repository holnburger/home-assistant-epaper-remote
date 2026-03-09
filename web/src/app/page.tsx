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
    const storedDevices = localStorage.getItem('saved_devices');
    let hasDevices = false;
    try {
      if (storedDevices) {
        hasDevices = JSON.parse(storedDevices).length > 0;
      }
    } catch (e) { }

    if (hasFlashedUsb || hasDevices) {
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
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header section */}
        <header className="flex flex-col items-center text-center space-y-6">
          <div className="w-24 h-24 relative animate-pulse-slow">
            <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-30 rounded-full"></div>
            <div className="glass rounded-3xl flex items-center justify-center w-full h-full relative z-10 border border-white/10 shadow-2xl">
              <span className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-purple-500">
                HA
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-6xl font-black tracking-tighter">
              E-Ink <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">Hub</span>
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto text-lg">
              The professional dashboard for your Home Assistant remotes. Setup new devices via USB or manage existing ones wirelessly.
            </p>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Path A: Initial Setup */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-sm font-black">1</span>
                  Initial USB Setup
                </h2>
                <p className="text-sm text-gray-500 mt-1">Required for first-time activation</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/20">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Chrome/Edge Only</span>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <ConfigPanel
                onBuildComplete={handleBuildComplete}
                isMinimized={stage === 'ota'}
                onExpand={() => setStage('config')}
                onCollapse={() => {
                  const hasDevices = (localStorage.getItem('saved_devices') || '[]').includes('dev_');
                  if (localStorage.getItem('has_flashed_usb') || hasDevices) setStage('ota');
                }}
              />

              <Flasher
                onFlashComplete={handleFlashComplete}
                isMinimized={stage === 'ota'}
                isActive={stage === 'usb' || stage === 'ota' || stage === 'config'}
                onExpand={() => { if (stage !== 'config') setStage('usb'); }}
                onCollapse={() => {
                  const hasDevices = (localStorage.getItem('saved_devices') || '[]').includes('dev_');
                  if (localStorage.getItem('has_flashed_usb') || hasDevices) setStage('ota');
                }}
              />
            </div>
          </section>

          {/* Path B: Wireless Management */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 text-sm font-black">2</span>
                  Wireless Management
                </h2>
                <p className="text-sm text-gray-500 mt-1">Update & manage paired devices</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/30 border border-purple-500/20">
                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">All Browsers</span>
              </div>
            </div>

            <div className={`transition-all duration-700 flex flex-col gap-6`}>
              <DeviceSelector
                key={refreshDevices}
                onDeviceSelected={(ip) => {
                  localStorage.setItem('device_ip', ip);
                  window.dispatchEvent(new Event('ip_selected_from_selector'));
                }}
              />
              <div className="glass p-8 rounded-2xl flex flex-col gap-4 border border-purple-500/10 shadow-lg shadow-purple-500/5">
                <OtaFlasher />
              </div>
            </div>
          </section>

        </div>

        <footer className="pt-24 text-center">

        </footer>
      </div>
    </main>
  );
}
