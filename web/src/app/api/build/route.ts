import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const SECRETS_H_PATH = process.env.PROJECT_ROOT ? path.join(process.env.PROJECT_ROOT, 'src/secrets.h') : path.join(process.cwd(), '../src/secrets.h');

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

        // Generate dynamically config_widgets.h based on widgets in body
        const configWidgetsPath = path.join(PROJECT_ROOT, 'src/config_widgets.h');
        const configPath = path.join(PROJECT_ROOT, 'config.json');

        let configWidgets = [];
        if (fs.existsSync(configPath)) {
            try {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                configWidgets = configData.widgets || [];
            } catch (e) { }
        }

        const widgets = body.widgets || configWidgets;

        let entitiesCode = '';
        let widgetsCode = '';

        const uniqueIcons = new Set<string>();

        widgets.forEach((w: any, index: number) => {
            const entityName = `entity_${index}`;
            entitiesCode += `
    EntityConfig ${entityName} = {
        .entity_id = "${w.entity_id}",
        .command_type = CommandType::${w.command_type},
    };
`;

            // Clean up the icon names to be valid C variable names
            const iconOnVar = w.icon_on?.replace(/-/g, '_').replace(/ /g, '_') || 'lightbulb_outline';
            const iconOffVar = w.icon_off?.replace(/-/g, '_').replace(/ /g, '_') || 'lightbulb_off_outline';

            if (w.icon_on) uniqueIcons.add(w.icon_on);
            if (w.icon_off) uniqueIcons.add(w.icon_off);

            if (w.type === 'Slider') {
                widgetsCode += `
    screen_add_slider(
        SliderConfig{
            .entity_ref = store_add_entity(store, ${entityName}),
            .label = "${w.label || ''}",
            .icon_on = ${iconOnVar},
            .icon_off = ${iconOffVar},
            .pos_x = ${w.pos_x || 30},
            .pos_y = ${w.pos_y || 30},
            .width = ${w.width || 480},
            .height = ${w.height || 170},
        },
        screen);
`;
            } else if (w.type === 'Button') {
                widgetsCode += `
    screen_add_button(
        ButtonConfig{
            .entity_ref = store_add_entity(store, ${entityName}),
            .label = "${w.label || ''}",
            .icon_on = ${iconOnVar},
            .icon_off = ${iconOffVar},
            .pos_x = ${w.pos_x || 30},
            .pos_y = ${w.pos_y || 30},
        },
        screen);
`;
            }
        });

        const configWidgetsHeaderContent = `#pragma once
#include "assets/icons.h"
#include "boards.h"
#include "config.h"
#include "screen.h"
#include "store.h"

void configure_widgets(EntityStore* store, Screen* screen) {
    // Declare home assistant entities${entitiesCode}
    // Add widgets${widgetsCode}
}
`;
        fs.writeFileSync(configWidgetsPath, configWidgetsHeaderContent);

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode(`Starting build for ${target}...\n`));

                try {
                    // 1. Generate MDI PNGs for the selected widgets
                    controller.enqueue(encoder.encode('Processing MDI SVG icons into PNG...\n'));
                    const sharp = (await import('sharp')).default;
                    const mdi = await import('@mdi/js');

                    const iconsDir = path.join(PROJECT_ROOT, 'icons-buttons');
                    if (!fs.existsSync(iconsDir)) {
                        fs.mkdirSync(iconsDir, { recursive: true });
                    }

                    for (const iconName of uniqueIcons) {
                        const mdiPath = (mdi as any)[iconName];
                        if (mdiPath) {
                            // Convert SVG path to 64x64 PNG
                            const svgStr = `<svg width="64" height="64" viewBox="0 0 24 24"><path d="${mdiPath}" fill="black" /></svg>`;
                            const safeFileName = iconName.replace(/-/g, '_').replace(/ /g, '_') + '.png';
                            await sharp(Buffer.from(svgStr)).resize(64, 64).png().toFile(path.join(iconsDir, safeFileName));
                            controller.enqueue(encoder.encode(`Generated ${safeFileName}\n`));
                        }
                    }

                    // 2. Run the icon generator script to convert PNGs to C++ header
                    controller.enqueue(encoder.encode('Re-generating src/assets/icons.h...\n'));
                    const pyGen = spawn('python3', ['generate-icons.py'], { cwd: PROJECT_ROOT, env: { ...process.env, PYTHONUNBUFFERED: '1' } });

                    await new Promise<void>((resolve, reject) => {
                        pyGen.stdout.on('data', (data) => controller.enqueue(encoder.encode(data.toString())));
                        pyGen.stderr.on('data', (data) => controller.enqueue(encoder.encode(data.toString())));
                        pyGen.on('close', (code) => {
                            if (code !== 0) reject(new Error(`generate-icons.py failed with code ${code}`));
                            else resolve();
                        });
                    });

                } catch (iconErr: any) {
                    controller.enqueue(encoder.encode(`\n[ICON GENERATION ERROR] ${iconErr.message}\n`));
                }

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
