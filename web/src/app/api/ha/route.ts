import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { url, token } = await req.json();
        if (!url || !token) return NextResponse.json({ error: 'Missing url or token' }, { status: 400 });

        const restUrl = url.replace('ws://', 'http://').replace('wss://', 'https://').replace('/api/websocket', '/api/states');

        const res = await fetch(restUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error(`HA API responded with HTTP ${res.status}`);
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
