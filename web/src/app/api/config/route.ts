import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/app';
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config.json');
const SECRETS_H_PATH = path.join(PROJECT_ROOT, 'src/secrets.h');

export async function GET() {
    try {
        const config = fs.existsSync(CONFIG_PATH)
            ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
            : { wifi_ssid: '', home_assistant_url: '' };

        return NextResponse.json({
            ...config,
            wifi_password: '', // Never return secrets
            home_assistant_token: ''
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Save ONLY non-sensitive to config.json
        const config = {
            wifi_ssid: body.wifi_ssid,
            home_assistant_url: body.home_assistant_url
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        return NextResponse.json({ message: 'Configuration metadata saved' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
