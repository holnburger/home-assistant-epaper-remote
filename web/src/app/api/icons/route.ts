import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';

    try {
        const mdi: any = await import('@mdi/js');
        const iconKeys = Object.keys(mdi);

        let results;
        if (!query) {
            // Return some common ones for default dropdown
            results = ['mdiLightbulb', 'mdiFan', 'mdiToggleSwitch', 'mdiWindowShade', 'mdiHomeAutomation', 'mdiSofa', 'mdiRobotVacuum'];
        } else {
            results = iconKeys
                .filter(k => k.toLowerCase().includes(query))
                .slice(0, 50); // Limit to 50 to avoid massive payloads
        }

        const formatted = results.map(key => ({
            value: key,
            label: key.replace(/^mdi/, '').replace(/([A-Z])/g, ' $1').trim(),
            path: mdi[key]
        }));

        return NextResponse.json(formatted);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
