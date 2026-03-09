import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/app';
const SECRETS_H_PATH = path.join(PROJECT_ROOT, 'src/secrets.h');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const target = body.device || 'm5-papers3';

        // Helper to escape strings for C++ macros
        const escapeCppString = (str: string) => {
            if (!str) return '';
            return str
                .replace(/\\/g, '\\\\')   // Escape backslashes first
                .replace(/"/g, '\\"')     // Escape double quotes
                .replace(/\n/g, '\\n')    // Escape newlines
                .replace(/\r/g, '\\r');   // Escape returns
        };

        // Write secrets.h just for this build
        const secretsHContent = `#pragma once

// WiFi Configuration
#define WIFI_SSID "${escapeCppString(body.wifi_ssid)}"
#define WIFI_PASSWORD "${escapeCppString(body.wifi_password)}"

// Home Assistant Configuration
#define HA_URL "${escapeCppString(body.home_assistant_url)}"
#define HA_TOKEN "${escapeCppString(body.home_assistant_token)}"
`;
        fs.writeFileSync(SECRETS_H_PATH, secretsHContent);

        // PIO's LDF ignores macros like #if __has_include(), so it doesn't know secrets.h
        // is used by config_remote.cpp. Force recompile config_remote.cpp to ensure secrets are bundled
        const configRemotePath = path.join(PROJECT_ROOT, 'src/config_remote.cpp');
        if (fs.existsSync(configRemotePath)) {
            const time = new Date();
            fs.utimesSync(configRemotePath, time, time);
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`Starting build for ${target}...\n`));

                // Run platformio build using spawn
                // set PYTHONUNBUFFERED=1 to ensure python flushes output immediately
                const pio = spawn('/usr/local/bin/pio', ['run', '-e', target], {
                    cwd: PROJECT_ROOT,
                    env: { ...process.env, PYTHONUNBUFFERED: '1' }
                });

                pio.stdout.on('data', (data) => {
                    controller.enqueue(encoder.encode(data.toString()));
                });

                pio.stderr.on('data', (data) => {
                    controller.enqueue(encoder.encode(data.toString()));
                });

                pio.on('close', (code) => {
                    // Cleanup sensitive info after build
                    fs.writeFileSync(SECRETS_H_PATH, `#pragma once\n// Volatile secrets cleared after build\n`);

                    if (code === 0) {
                        try {
                            const srcPath = path.join(PROJECT_ROOT, '.pio/build', target, 'firmware.bin');
                            const bootAppSrcPath = '/root/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin';
                            const destDir = path.join(PROJECT_ROOT, 'web/public/build', target);
                            const destPath = path.join(destDir, 'firmware.bin');
                            const bootAppDestPath = path.join(destDir, 'boot_app0.bin');

                            if (!fs.existsSync(destDir)) {
                                fs.mkdirSync(destDir, { recursive: true });
                            }

                            if (fs.existsSync(srcPath)) {
                                fs.copyFileSync(srcPath, destPath);
                                // Always provision boot_app0 for OTA partition capability
                                if (fs.existsSync(bootAppSrcPath)) {
                                    fs.copyFileSync(bootAppSrcPath, bootAppDestPath);
                                }
                                controller.enqueue(encoder.encode(`\nFirmware ready for OTA update.\n`));
                            }
                        } catch (err: any) {
                            controller.enqueue(encoder.encode(`\n[ERROR] Failed to export firmware: ${err.message}\n`));
                        }
                        controller.enqueue(encoder.encode(`\n=== BUILD SUCCESSFUL ===\n`));
                    } else {
                        controller.enqueue(encoder.encode(`\n=== BUILD FAILED (code ${code}) ===\n`));
                    }
                    controller.close();
                });

                pio.on('error', (error) => {
                    controller.enqueue(encoder.encode(`\n[SPAWN ERROR] ${error.message}\n`));
                    fs.writeFileSync(SECRETS_H_PATH, `#pragma once\n// Volatile secrets cleared after build (Error)\n`);
                    controller.close();
                });
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no' // disable nginx buffering if present
            },
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
