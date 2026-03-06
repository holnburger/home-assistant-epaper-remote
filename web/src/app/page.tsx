import Flasher from '@/components/Flasher';
import OtaFlasher from '@/components/OtaFlasher';
import Image from 'next/image';

export default function Home() {
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

        {/* Flasher Section */}
        <section>
          <Flasher />
        </section>

        {/* OTA / Resources Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OtaFlasher />

          <div className="glass p-8 rounded-2xl flex flex-col gap-4">
            <h3 className="text-xl font-bold text-purple-400 font-sans tracking-tight">Resources</h3>
            <p className="text-sm text-gray-500">
              Download the latest compiled firmware binaries for manual flashing or local storage.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <a
                href="/build/m5-papers3/firmware.bin"
                download
                className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-purple-500/30 transition-all group"
              >
                <span className="text-sm font-medium text-gray-300">M5PaperS3 Firmware</span>
                <span className="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-1 rounded">BIN</span>
              </a>
              <button className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg opacity-50 cursor-not-allowed">
                <span className="text-sm font-medium text-gray-500">Lilygo T5 S3 Firmware</span>
                <span className="text-[10px] bg-gray-800 text-gray-600 px-2 py-1 rounded">BIN</span>
              </button>
            </div>
          </div>
        </section>

        <footer className="pt-12 text-center text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          E-Ink HA Remote Dashboard &bull; 2026
        </footer>
      </div>
    </main>
  );
}
