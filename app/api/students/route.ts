// ===== API: Students CRUD =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

const getRoleFromPosition = (pos: string | null) => {
    if (['Lớp trưởng', 'Bí thư', 'Lớp phó học tập', 'Lớp phó lao động'].includes(pos || '')) return 'class_leader';
    if (pos === 'Tổ trưởng') return 'team_leader';
    return 'student';
};

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');

            // Lazy migrations to ensure columns exist before reading
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`;
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS dropout_date VARCHAR(20)`;
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(20)`;

            const { rows } = await sql`
                SELECT id, name, team, position, initial_score AS "initialScore", note, status, dropout_date AS "dropoutDate", date_of_birth AS "dateOfBirth"
                FROM students ORDER BY id
            `;
            return NextResponse.json(rows);
        }
        return NextResponse.json(Object.values(getStore().students));
    } catch (error) {
        console.error('GET /api/students error:', error);
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
                const id = item.id || `HS${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
                const { name, team, position = null, initialScore = 100 } = item;
                if (hasPostgres()) {
                    const { sql } = await import('@vercel/postgres');
                    await sql`
                        INSERT INTO students (id, name, team, position, initial_score)
                        VALUES (${id}, ${name}, ${team}, ${position}, ${initialScore})
                        ON CONFLICT (id) DO UPDATE SET name = ${name}, team = ${team}, position = ${position}, initial_score = ${initialScore}
                    `;
                    // Auto-create student account
                    const accId = `acc_${id}`;
                    const derivedRole = getRoleFromPosition(position);
                    await sql`
                        INSERT INTO accounts (id, username, password, role, display_name, student_id, team)
                        VALUES (${accId}, ${id}, '123456', ${derivedRole}, ${name}, ${id}, ${team})
                        ON CONFLICT (id) DO UPDATE SET display_name = ${name}, team = ${team}, role = ${derivedRole}
                    `;
                } else {
                    const store = getStore();
                    store.students[id] = { id, name, team, position, initialScore, note: null, status: 'active' };
                    store.accounts[`acc_${id}`] = {
                        id: `acc_${id}`, username: id, password: '123456',
                        role: getRoleFromPosition(position) as any, displayName: name, studentId: id, team,
                    };
                }
                results.push({ id, name, team, position, initialScore });
            }
            return NextResponse.json(results);
        }

        // Single add
        const { name, team, position, initialScore = 100, note, dateOfBirth } = body;
        const id = `HS${Date.now()}`;

        // Validate Unique Position
        if (position) {
            const isClassUnique = ['Lớp trưởng', 'Bí thư', 'Lớp phó học tập', 'Lớp phó lao động'].includes(position);
            const isTeamUnique = position === 'Tổ trưởng';

            if (isClassUnique || isTeamUnique) {
                let isDuplicate = false;
                if (hasPostgres()) {
                    const { sql } = await import('@vercel/postgres');
                    if (isClassUnique) {
                        const { rowCount } = await sql`SELECT id FROM students WHERE position = ${position} LIMIT 1`;
                        isDuplicate = (rowCount ?? 0) > 0;
                    } else if (isTeamUnique) {
                        const { rowCount } = await sql`SELECT id FROM students WHERE position = ${position} AND team = ${team} LIMIT 1`;
                        isDuplicate = (rowCount ?? 0) > 0;
                    }
                } else {
                    const store = getStore();
                    const studentsList = Object.values(store.students);
                    if (isClassUnique) {
                        isDuplicate = studentsList.some(s => s.position === position);
                    } else if (isTeamUnique) {
                        isDuplicate = studentsList.some(s => s.position === position && s.team === team);
                    }
                }

                if (isDuplicate) {
                    const scopeMsg = isClassUnique ? "trong lớp" : "trong tổ này";
                    return NextResponse.json({ error: `Đã có học sinh giữ chức vụ ${position} ${scopeMsg}. Vui lòng kiểm tra lại!` }, { status: 400 });
                }
            }
        }

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`
                INSERT INTO students (id, name, team, position, initial_score, note, date_of_birth)
                VALUES (${id}, ${name}, ${team}, ${position || null}, ${initialScore}, ${note || null}, ${dateOfBirth || null})
            `;
            const accId = `acc_${id}`;
            const derivedRole = getRoleFromPosition(position || null);
            await sql`
                INSERT INTO accounts (id, username, password, role, display_name, student_id, team)
                VALUES (${accId}, ${id}, '123456', ${derivedRole}, ${name}, ${id}, ${team})
                ON CONFLICT (id) DO UPDATE SET display_name = ${name}, team = ${team}, role = ${derivedRole}
            `;
        } else {
            const store = getStore();
            store.students[id] = { id, name, team, position: position || null, initialScore, note: note || null, dateOfBirth: dateOfBirth || undefined };
            store.accounts[`acc_${id}`] = {
                id: `acc_${id}`, username: id, password: '123456',
                role: getRoleFromPosition(position || null) as any, displayName: name, studentId: id, team,
            };
        }
        return NextResponse.json({ id, name, team, position, initialScore, note });
    } catch (error) {
        console.error('POST /api/students error:', error);
        return NextResponse.json({ error: 'Failed to add student' }, { status: 500 });
    }
}


export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...data } = body;

        // Validate Unique Position for PUT
        if (data.position && data.position !== '') {
            const position = data.position;
            const isClassUnique = ['Lớp trưởng', 'Bí thư', 'Lớp phó học tập', 'Lớp phó lao động'].includes(position);
            const isTeamUnique = position === 'Tổ trưởng';

            if (isClassUnique || isTeamUnique) {
                let isDuplicate = false;

                if (hasPostgres()) {
                    const { sql } = await import('@vercel/postgres');
                    if (isClassUnique) {
                        const { rowCount } = await sql`SELECT id FROM students WHERE position = ${position} AND id != ${id} LIMIT 1`;
                        isDuplicate = (rowCount ?? 0) > 0;
                    } else if (isTeamUnique) {
                        // Check team: if not updating team, we need to find current team first
                        let currentTeam = data.team;
                        if (!currentTeam) {
                            const teamRes = await sql`SELECT team FROM students WHERE id = ${id}`;
                            if (teamRes.rowCount && teamRes.rowCount > 0) {
                                currentTeam = teamRes.rows[0].team;
                            }
                        }
                        const { rowCount } = await sql`SELECT id FROM students WHERE position = ${position} AND team = ${currentTeam} AND id != ${id} LIMIT 1`;
                        isDuplicate = (rowCount ?? 0) > 0;
                    }
                } else {
                    const store = getStore();
                    const studentsList = Object.values(store.students);
                    if (isClassUnique) {
                        isDuplicate = studentsList.some(s => s.position === position && s.id !== id);
                    } else if (isTeamUnique) {
                        const currentTeam = data.team || (store.students[id] ? store.students[id].team : undefined);
                        isDuplicate = studentsList.some(s => s.position === position && s.team === currentTeam && s.id !== id);
                    }
                }

                if (isDuplicate) {
                    const scopeMsg = isClassUnique ? "trong lớp" : "trong tổ này";
                    return NextResponse.json({ error: `Đã có học sinh giữ chức vụ ${position} ${scopeMsg}. Vui lòng kiểm tra lại!` }, { status: 400 });
                }
            }
        }

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            if (data.name !== undefined) await sql`UPDATE students SET name = ${data.name} WHERE id = ${id}`;
            if (data.team !== undefined) await sql`UPDATE students SET team = ${data.team} WHERE id = ${id}`;
            if (data.position !== undefined) await sql`UPDATE students SET position = ${data.position} WHERE id = ${id}`;
            if (data.initialScore !== undefined) await sql`UPDATE students SET initial_score = ${data.initialScore} WHERE id = ${id}`;
            if (data.note !== undefined) await sql`UPDATE students SET note = ${data.note} WHERE id = ${id}`;
            if (data.dateOfBirth !== undefined) await sql`UPDATE students SET date_of_birth = ${data.dateOfBirth} WHERE id = ${id}`;

            // Sync account role & team & name
            if (data.position !== undefined || data.team !== undefined || data.name !== undefined) {
                const accId = `acc_${id}`;
                if (data.position !== undefined) {
                    const derivedRole = getRoleFromPosition(data.position);
                    await sql`UPDATE accounts SET role = ${derivedRole} WHERE id = ${accId}`;
                }
                if (data.team !== undefined) {
                    await sql`UPDATE accounts SET team = ${data.team} WHERE id = ${accId}`;
                }
                if (data.name !== undefined) {
                    await sql`UPDATE accounts SET display_name = ${data.name} WHERE id = ${accId}`;
                }
            }
        } else {
            const store = getStore();
            if (store.students[id]) {
                Object.assign(store.students[id], data);
            }
            if (store.accounts[`acc_${id}`]) {
                if (data.position !== undefined) {
                    store.accounts[`acc_${id}`].role = getRoleFromPosition(data.position) as any;
                }
                if (data.team !== undefined) {
                    store.accounts[`acc_${id}`].team = data.team;
                }
                if (data.name !== undefined) {
                    store.accounts[`acc_${id}`].displayName = data.name;
                }
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/students error:', error);
        return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const deleteAll = searchParams.get('deleteAll');
        const id = searchParams.get('id');

        if (deleteAll === 'true') {
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                await sql`DELETE FROM students`;
                await sql`DELETE FROM accounts WHERE role != 'teacher'`;
                await sql`DELETE FROM log_entries`;
                await sql`DELETE FROM attendance`;
            } else {
                const store = getStore();
                store.students = {};
                store.log_entries = {};
                store.attendance = {};
                // Wipe student accounts
                const teacherAccounts: Record<string, any> = {};
                for (const accId in store.accounts) {
                    if (store.accounts[accId].role === 'teacher') {
                        teacherAccounts[accId] = store.accounts[accId];
                    }
                }
                store.accounts = teacherAccounts;
            }
            return NextResponse.json({ success: true });
        }

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`DELETE FROM students WHERE id = ${id}`;
        } else {
            const store = getStore();
            delete store.students[id];
            // Cascade: delete related log entries and attendance
            for (const key in store.log_entries) {
                if (store.log_entries[key].studentId === id) delete store.log_entries[key];
            }
            for (const key in store.attendance) {
                if (store.attendance[key].studentId === id) delete store.attendance[key];
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/students error:', error);
        return NextResponse.json({ error: 'Failed to delete student(s)' }, { status: 500 });
    }
}
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, id, status, dropoutDate } = body;

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');

            // Ensure columns exist (lazy migration)
            try {
                await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`;
                await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS dropout_date TEXT`;
            } catch (e) {
                console.log('Migration failed, columns might exist', e);
            }

            if (action === 'reset_password') {
                await sql`UPDATE accounts SET password = '123456' WHERE student_id = ${id}`;
            } else if (action === 'update_status') {
                await sql`UPDATE students SET status = ${status}, dropout_date = ${dropoutDate || null} WHERE id = ${id}`;
            }
        } else {
            const store = getStore();
            if (action === 'reset_password') {
                const accId = `acc_${id}`;
                if (store.accounts[accId]) {
                    store.accounts[accId].password = '123456';
                }
            } else if (action === 'update_status') {
                if (store.students[id]) {
                    store.students[id].status = status;
                    store.students[id].dropoutDate = dropoutDate;
                }
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/students error:', error);
        return NextResponse.json({ error: 'Failed to apply action' }, { status: 500 });
    }
}
