import { NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            const { rows } = await sql`
                SELECT COUNT(*) as count FROM log_entries WHERE status = 'pending'
            `;
            return NextResponse.json({ count: parseInt(rows[0].count, 10) });
        }

        const store = getStore();
        const pendingCount = Object.values(store.log_entries).filter((l: any) => l.status === 'pending').length;
        return NextResponse.json({ count: pendingCount });
    } catch (error) {
        console.error('GET /api/logs/pending-count error:', error);
        return NextResponse.json({ count: 0 }); // Fail gracefully
    }
}
