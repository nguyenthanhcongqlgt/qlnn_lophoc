// ===== API: Auth (Login, Accounts) =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

async function getAccountsFromDB() {
    if (hasPostgres()) {
        const { sql } = await import('@vercel/postgres');
        const { rows } = await sql`
            SELECT id, username, role, display_name AS "displayName",
                   student_id AS "studentId", team
            FROM accounts ORDER BY role, username
        `;
        return rows;
    }
    return Object.values(getStore().accounts).map(({ password, ...rest }) => rest);
}

export async function GET() {
    try {
        const accounts = await getAccountsFromDB();
        return NextResponse.json(accounts);
    } catch (error) {
        console.error('GET /api/auth error:', error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'login') {
            const { username, password } = body;

            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                const { rows } = await sql`
                    SELECT id, username, password, role, display_name AS "displayName",
                           student_id AS "studentId", team
                    FROM accounts
                    WHERE LOWER(username) = LOWER(${username})
                `;
                const user = rows[0];
                if (!user || user.password !== password) {
                    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
                }
                const { password: _, ...safeUser } = user;
                return NextResponse.json({ user: safeUser });
            }

            // In-memory fallback
            const store = getStore();
            const user = Object.values(store.accounts).find(
                (a: any) => a.username.toLowerCase() === username.toLowerCase()
            ) as any;
            if (!user || user.password !== password) {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }
            const { password: _, ...safeUser } = user;
            return NextResponse.json({ user: safeUser });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('POST /api/auth error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, id } = body;

        if (action === 'updateRole') {
            const { role } = body;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                await sql`UPDATE accounts SET role = ${role} WHERE id = ${id}`;
            } else {
                const store = getStore();
                if (store.accounts[id]) store.accounts[id].role = role;
            }
            return NextResponse.json({ success: true });
        }

        if (action === 'resetPassword') {
            const { password } = body;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                await sql`UPDATE accounts SET password = ${password} WHERE id = ${id}`;
            } else {
                const store = getStore();
                if (store.accounts[id]) store.accounts[id].password = password;
            }
            return NextResponse.json({ success: true });
        }

        if (action === 'changePassword') {
            const { oldPassword, newPassword } = body;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                const { rows } = await sql`SELECT password FROM accounts WHERE id = ${id}`;
                if (!rows[0] || rows[0].password !== oldPassword) {
                    return NextResponse.json({ error: 'Wrong old password' }, { status: 400 });
                }
                await sql`UPDATE accounts SET password = ${newPassword} WHERE id = ${id}`;
            } else {
                const store = getStore();
                if (!store.accounts[id] || store.accounts[id].password !== oldPassword) {
                    return NextResponse.json({ error: 'Wrong old password' }, { status: 400 });
                }
                store.accounts[id].password = newPassword;
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('PUT /api/auth error:', error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
