// ===== API: Positions CRUD =====
// Manages class positions (Lớp trưởng, Bí thư, etc.) with canCreateLog flag

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

const DEFAULT_POSITIONS = [
    { id: 'pos_lt', name: 'Lớp trưởng', canCreateLog: true },
    { id: 'pos_lp', name: 'Lớp phó', canCreateLog: true },
    { id: 'pos_bt', name: 'Bí thư', canCreateLog: true },
    { id: 'pos_tt', name: 'Tổ trưởng', canCreateLog: true },
    { id: 'pos_cd', name: 'Cờ đỏ', canCreateLog: true },
    { id: 'pos_hs', name: 'Học sinh', canCreateLog: false },
];

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            // Try to get from DB; if table doesn't exist, return defaults
            try {
                const { rows } = await sql`
                    SELECT id, name, can_create_log AS "canCreateLog"
                    FROM positions ORDER BY name
                `;

                // Merge defaults with DB rows (DB takes precedence for same ID)
                const merged = [...DEFAULT_POSITIONS];
                (rows as unknown as typeof DEFAULT_POSITIONS).forEach(row => {
                    const idx = merged.findIndex(p => p.id === row.id);
                    if (idx >= 0) merged[idx] = row;
                    else merged.push(row);
                });
                return NextResponse.json(merged);
            } catch {
                return NextResponse.json(DEFAULT_POSITIONS);
            }
        }
        const store = getStore();
        if (!store.positions || Object.keys(store.positions).length === 0) {
            return NextResponse.json(DEFAULT_POSITIONS);
        }
        return NextResponse.json(Object.values(store.positions));
    } catch (error) {
        console.error('GET /api/positions error:', error);
        return NextResponse.json(DEFAULT_POSITIONS);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, canCreateLog } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`
                INSERT INTO positions (id, name, can_create_log)
                VALUES (${id}, ${name}, ${canCreateLog})
                ON CONFLICT (id) DO UPDATE SET name = ${name}, can_create_log = ${canCreateLog}
            `;
        } else {
            const store = getStore();
            if (!store.positions) store.positions = {};
            // If it's a default ID being saved, it will overwrite the default in local store
            store.positions[id] = { id, name, canCreateLog };
        }
        return NextResponse.json({ id, name, canCreateLog });
    } catch (error) {
        console.error('POST /api/positions error:', error);
        return NextResponse.json({ error: 'Failed to save position' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, canCreateLog } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`UPDATE positions SET name = ${name}, can_create_log = ${canCreateLog} WHERE id = ${id}`;
        } else {
            const store = getStore();
            if (store.positions?.[id]) {
                store.positions[id] = { id, name, canCreateLog };
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/positions error:', error);
        return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`DELETE FROM positions WHERE id = ${id}`;
        } else {
            const store = getStore();
            delete store.positions?.[id];
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/positions error:', error);
        return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 });
    }
}
