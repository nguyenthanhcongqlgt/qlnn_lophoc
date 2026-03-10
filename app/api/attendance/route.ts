// ===== API: Attendance CRUD =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            const { rows } = await sql`
                SELECT id, student_id AS "studentId", date, COALESCE(session, 'morning') AS session, status, note
                FROM attendance ORDER BY date DESC, student_id
            `;
            return NextResponse.json(rows);
        }
        return NextResponse.json(Object.values(getStore().attendance));
    } catch (error) {
        console.error('GET /api/attendance error:', error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { studentId, date, session = 'morning', status, note } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            if (status === 'present') {
                await sql`DELETE FROM attendance WHERE student_id = ${studentId} AND date = ${date} AND COALESCE(session, 'morning') = ${session}`;
                return NextResponse.json({ success: true, action: 'deleted' });
            }
            const id = `ATT${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await sql`
                INSERT INTO attendance (id, student_id, date, session, status, note)
                VALUES (${id}, ${studentId}, ${date}, ${session}, ${status}, ${note || null})
                ON CONFLICT (student_id, date, session)
                DO UPDATE SET status = ${status}, note = ${note || null}
            `;
            return NextResponse.json({ id, studentId, date, session, status, note });
        }

        // In-memory fallback
        const store = getStore();
        const key = `${studentId}_${date}_${session}`;
        if (status === 'present') {
            delete store.attendance[key];
            return NextResponse.json({ success: true, action: 'deleted' });
        }
        const id = `ATT${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        store.attendance[key] = { id, studentId, date, session, status, note: note || null };
        return NextResponse.json({ id, studentId, date, session, status, note });
    } catch (error) {
        console.error('POST /api/attendance error:', error);
        return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
    }
}
