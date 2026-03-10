// ===== API: Log Entries CRUD =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            const { rows } = await sql`
                SELECT id, student_id AS "studentId", type, content, point,
                       date, timestamp, subject, session, period, status, reject_reason AS "rejectReason", created_by AS "createdBy"
                FROM log_entries ORDER BY timestamp DESC
            `;
            return NextResponse.json(rows);
        }
        return NextResponse.json(Object.values(getStore().log_entries));
    } catch (error) {
        console.error('GET /api/logs error:', error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { studentId, type, content, point, date, subject, session, period, status = 'pending', rejectReason, createdBy } = body;

        // Parse date for prefix: ddMMyy
        // Assuming date is in 'YYYY-MM-DD' format
        const dateObj = new Date(date);
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yy = String(dateObj.getFullYear()).slice(-2);

        const prefix = type === 'violation' ? `VP${dd}${mm}${yy}` : `VT${dd}${mm}${yy}`;
        let sequence = 1;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            // Get highest sequence number for this prefix
            const { rows } = await sql`
                SELECT id FROM log_entries 
                WHERE id LIKE ${prefix + '%'}
            `;
            const existingSeq = rows.map(r => parseInt(r.id.split('_')[1] || '0')).filter(n => !isNaN(n));
            if (existingSeq.length > 0) {
                sequence = Math.max(...existingSeq) + 1;
            }

            const id = `${prefix}_${String(sequence).padStart(2, '0')}`;
            const timestamp = new Date().toISOString();

            await sql`
                    INSERT INTO log_entries (id, student_id, type, content, point, date, timestamp, subject, session, period, status, reject_reason, created_by)
                    VALUES (${id}, ${studentId}, ${type}, ${content}, ${point}, ${date}, ${timestamp}, ${subject || null}, ${session || null}, ${period || null}, ${status}, ${rejectReason || null}, ${createdBy || null})
                `;
            return NextResponse.json({ id, studentId, type, content, point, date, timestamp, subject, session, period, status, rejectReason, createdBy });
        } else {
            const store = getStore();
            const existingIds = Object.keys(store.log_entries).filter(id => id.startsWith(prefix));
            const existingSeq = existingIds.map(id => parseInt(id.split('_')[1] || '0')).filter(n => !isNaN(n));
            if (existingSeq.length > 0) {
                sequence = Math.max(...existingSeq) + 1;
            }

            const id = `${prefix}_${String(sequence).padStart(2, '0')}`;
            const timestamp = new Date().toISOString();

            store.log_entries[id] = { id, studentId, type, content, point, date, timestamp, subject: subject || null, session: session || null, period: period || null, status, rejectReason: rejectReason || undefined, createdBy };
            return NextResponse.json({ id, studentId, type, content, point, date, timestamp, subject, session, period, status, rejectReason, createdBy });
        }
    } catch (error) {
        console.error('POST /api/logs error:', error);
        return NextResponse.json({ error: 'Failed to add log' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...data } = body;

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            if (data.type !== undefined) await sql`UPDATE log_entries SET type = ${data.type} WHERE id = ${id}`;
            if (data.content !== undefined) await sql`UPDATE log_entries SET content = ${data.content} WHERE id = ${id}`;
            if (data.point !== undefined) await sql`UPDATE log_entries SET point = ${data.point} WHERE id = ${id}`;
            if (data.date !== undefined) await sql`UPDATE log_entries SET date = ${data.date} WHERE id = ${id}`;
            if (data.subject !== undefined) await sql`UPDATE log_entries SET subject = ${data.subject} WHERE id = ${id}`;
            if (data.session !== undefined) await sql`UPDATE log_entries SET session = ${data.session} WHERE id = ${id}`;
            if (data.period !== undefined) await sql`UPDATE log_entries SET period = ${data.period} WHERE id = ${id}`;
            if (data.status !== undefined) await sql`UPDATE log_entries SET status = ${data.status} WHERE id = ${id}`;
            if (data.rejectReason !== undefined) await sql`UPDATE log_entries SET reject_reason = ${data.rejectReason} WHERE id = ${id}`;
            if (data.createdBy !== undefined) await sql`UPDATE log_entries SET created_by = ${data.createdBy} WHERE id = ${id}`;
        } else {
            const store = getStore();
            if (store.log_entries[id]) {
                Object.assign(store.log_entries[id], data);
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/logs error:', error);
        return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`DELETE FROM log_entries WHERE id = ${id}`;
        } else {
            delete getStore().log_entries[id];
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/logs error:', error);
        return NextResponse.json({ error: 'Failed to delete log' }, { status: 500 });
    }
}
