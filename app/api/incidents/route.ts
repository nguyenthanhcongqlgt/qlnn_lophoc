// ===== API: Incident Types CRUD =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            let rows;
            if (type) {
                const result = await sql`SELECT id, content, point, type FROM incident_types WHERE type = ${type} ORDER BY id`;
                rows = result.rows;
            } else {
                const result = await sql`SELECT id, content, point, type FROM incident_types ORDER BY type, id`;
                rows = result.rows;
            }
            return NextResponse.json(rows);
        }

        let items = Object.values(getStore().incident_types);
        if (type) items = items.filter((i: any) => i.type === type);
        return NextResponse.json(items);
    } catch (error) {
        console.error('GET /api/incidents error:', error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Batch import
        if (body.batch && Array.isArray(body.batch)) {
            const results = [];
            for (const item of body.batch) {
                const id = item.id || `${item.type === 'violation' ? 'V' : 'A'}${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
                const { content, point, type } = item;
                if (hasPostgres()) {
                    const { sql } = await import('@vercel/postgres');
                    await sql`
                        INSERT INTO incident_types (id, content, point, type)
                        VALUES (${id}, ${content}, ${point}, ${type})
                        ON CONFLICT (id) DO UPDATE SET content = ${content}, point = ${point}
                    `;
                } else {
                    getStore().incident_types[id] = { id, content, point, type };
                }
                results.push({ id, content, point, type });
            }
            return NextResponse.json(results);
        }

        // Single add
        const { id, content, point, type } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`
                INSERT INTO incident_types (id, content, point, type)
                VALUES (${id}, ${content}, ${point}, ${type})
            `;
        } else {
            getStore().incident_types[id] = { id, content, point, type };
        }
        return NextResponse.json({ id, content, point, type });
    } catch (error) {
        console.error('POST /api/incidents error:', error);
        return NextResponse.json({ error: 'Failed to add incident type' }, { status: 500 });
    }
}


export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, content, point } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`UPDATE incident_types SET content = ${content}, point = ${point} WHERE id = ${id}`;
        } else {
            const store = getStore();
            if (store.incident_types[id]) {
                store.incident_types[id].content = content;
                store.incident_types[id].point = point;
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/incidents error:', error);
        return NextResponse.json({ error: 'Failed to update incident type' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`DELETE FROM incident_types WHERE id = ${id}`;
        } else {
            delete getStore().incident_types[id];
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/incidents error:', error);
        return NextResponse.json({ error: 'Failed to delete incident type' }, { status: 500 });
    }
}
