import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            const result = await sql`SELECT id, name FROM subjects ORDER BY id ASC`;
            return NextResponse.json(result.rows);
        }

        const store = getStore();
        if (!store.subjects) store.subjects = {};
        const subjects = Object.values(store.subjects).sort((a: any, b: any) => a.id.localeCompare(b.id));
        return NextResponse.json(subjects);
    } catch (error) {
        console.error('GET /api/subjects error:', error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`
                INSERT INTO subjects (id, name)
                VALUES (${id}, ${name})
            `;
        } else {
            const store = getStore();
            if (!store.subjects) store.subjects = {};
            store.subjects[id] = { id, name };
        }

        return NextResponse.json({ id, name }, { status: 201 });
    } catch (error) {
        console.error('POST /api/subjects error:', error);
        return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`
                UPDATE subjects
                SET name = ${name}
                WHERE id = ${id}
            `;
        } else {
            const store = getStore();
            if (store.subjects && store.subjects[id]) {
                store.subjects[id] = { ...store.subjects[id], name };
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/subjects error:', error);
        return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
        }

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');

            // Check if used in logs
            const subjectRes = await sql`SELECT name FROM subjects WHERE id = ${id}`;
            if (subjectRes.rowCount && subjectRes.rowCount > 0) {
                const subjectName = subjectRes.rows[0].name;
                const checkRes = await sql`SELECT id FROM log_entries WHERE subject = ${subjectName} LIMIT 1`;
                if (checkRes.rowCount && checkRes.rowCount > 0) {
                    return NextResponse.json({ error: 'Không thể xoá môn học đã có học sinh ghi nhận. Chỉ có thể sửa tên.' }, { status: 400 });
                }
            }

            await sql`DELETE FROM subjects WHERE id = ${id}`;
        } else {
            const store = getStore();
            if (store.subjects && store.subjects[id]) {
                const subjectName = store.subjects[id].name;
                const logEntries = Object.values(store.log_entries || {});
                const isUsed = logEntries.some((log: any) => log.subject === subjectName);
                if (isUsed) {
                    return NextResponse.json({ error: 'Không thể xoá môn học đã có học sinh ghi nhận. Chỉ có thể sửa tên.' }, { status: 400 });
                }
                delete store.subjects[id];
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/subjects error:', error);
        return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 });
    }
}
