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

        // Write secrets.h just for this build
        const secretsHContent = `#pragma once

// WiFi Configuration
#define WIFI_SSID "${body.wifi_ssid}"
#define WIFI_PASSWORD "${body.wifi_password}"

// Home Assistant Configuration
#define HA_URL "${body.home_assistant_url}"
#define HA_TOKEN "${body.home_assistant_token}"
`;
        fs.writeFileSync(SECRETS_H_PATH, secretsHContent);

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
