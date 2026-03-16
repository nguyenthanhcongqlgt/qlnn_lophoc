// ===== API: Auth (Login, Accounts) =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';
import { ensureLatestSchema } from '@/lib/db';

async function getAccountsFromDB() {
    if (hasPostgres()) {
        const { sql } = await import('@vercel/postgres');
        const { rows } = await sql`
            SELECT id, username, role, display_name AS "displayName",
                   student_id AS "studentId", team, avatar
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

            // Ensure DB is initialized before checking credentials
            if (hasPostgres()) {
                await ensureLatestSchema();
            }

            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                const { rows } = await sql`
                    SELECT id, username, password, role, display_name AS "displayName",
                           student_id AS "studentId", team, avatar
                    FROM accounts
                    WHERE LOWER(username) = LOWER(${username})
                `;
                const user = rows[0];
                if (!user || user.password !== password) {
                    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
                }
                const { password: _, ...safeUser } = user;

                // Resolve canCreateLog and positionName from position
                let canCreateLog = false;
                let positionName: string | undefined = undefined;
                if (safeUser.studentId) {
                    try {
                        const { rows: students } = await sql`SELECT position FROM students WHERE id = ${safeUser.studentId}`;
                        const position = students[0]?.position;
                        if (position) {
                            positionName = position;
                            const { rows: pos } = await sql`SELECT can_create_log FROM positions WHERE name = ${position}`;
                            canCreateLog = pos[0]?.can_create_log ?? false;
                        }
                    } catch { /* positions table may not exist */ }
                }

                return NextResponse.json({ user: { ...safeUser, canCreateLog, positionName } });
            }

            // In-memory fallback
            const store = getStore();
            const account = Object.values(store.accounts).find(a => String(a.username).toLowerCase() === username.toLowerCase());

            if (!account || account.password !== password) {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }

            const { password: _, ...safeUser } = account as any;

            let canCreateLog = false;
            let positionName: string | undefined = undefined;
            if (safeUser.studentId && store.students[safeUser.studentId]) {
                const position = store.students[safeUser.studentId].position;
                if (position) {
                    positionName = position;
                    const posDef = Object.values(store.positions || {}).find((p: any) => p.name === position);
                    canCreateLog = posDef?.canCreateLog ?? false;
                }
            }

            return NextResponse.json({ user: { ...safeUser, canCreateLog, positionName } });
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

        if (action === 'changeUsername') {
            const { newUsername } = body;
            if (!newUsername || newUsername.trim() === '') {
                return NextResponse.json({ error: 'Tên đăng nhập không được để trống' }, { status: 400 });
            }
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                const existing = await sql`SELECT id FROM accounts WHERE username = ${newUsername}`;
                if ((existing.rowCount ?? 0) > 0) {
                    return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại trong hệ thống' }, { status: 400 });
                }
                await sql`UPDATE accounts SET username = ${newUsername} WHERE id = ${id}`;
            } else {
                const store = getStore();
                const exists = Object.values(store.accounts).some(acc => acc.username === newUsername);
                if (exists) {
                    return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại trong hệ thống' }, { status: 400 });
                }
                if (store.accounts[id]) {
                    store.accounts[id].username = newUsername;
                }
            }
            return NextResponse.json({ success: true });
        }

        if (action === 'changeAvatar') {
            const { avatar } = body;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                await sql`UPDATE accounts SET avatar = ${avatar} WHERE id = ${id}`;
            } else {
                const store = getStore();
                if (store.accounts[id]) {
                    store.accounts[id].avatar = avatar;
                }
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('PUT /api/auth error:', error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
