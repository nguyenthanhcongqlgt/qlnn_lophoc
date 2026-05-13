// ===== API: Seed Mock Data =====
// POST /api/seed — Inserts mock log entries + attendance for demonstration/testing.
// Protected: requires teacher auth or a seed secret.

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';
import { ensureLatestSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ── Seed Data Definitions ──

const violations = [
    { content: 'Đi học muộn', point: -2, type: 'violation' as const },
    { content: 'Không thuộc bài', point: -5, type: 'violation' as const },
    { content: 'Mất trật tự trong lớp', point: -2, type: 'violation' as const },
    { content: 'Không mặc đồng phục', point: -2, type: 'violation' as const },
    { content: 'Vệ sinh lớp kém', point: -3, type: 'violation' as const },
    { content: 'Sử dụng điện thoại', point: -5, type: 'violation' as const },
    { content: 'Nói tục, chửi bậy', point: -5, type: 'violation' as const },
    { content: 'Không làm bài tập', point: -3, type: 'violation' as const },
];

const achievements = [
    { content: 'Phát biểu xây dựng bài', point: 2, type: 'achievement' as const },
    { content: 'Nhặt được của rơi', point: 10, type: 'achievement' as const },
    { content: 'Giúp đỡ bạn bè', point: 5, type: 'achievement' as const },
    { content: 'Điểm kiểm tra giỏi (9-10)', point: 5, type: 'achievement' as const },
    { content: 'Tham gia hoạt động phong trào', point: 3, type: 'achievement' as const },
    { content: 'Vệ sinh lớp tốt', point: 2, type: 'achievement' as const },
];

const subjects = ['Ngữ văn', 'Toán', 'Lịch sử', 'Địa lý', 'GDKTPL', 'GDTC', 'Vật lý', 'Hóa học', 'Sinh học', 'Tin học', 'Công nghệ', 'Ngoại ngữ'];

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(arr: T[]): T {
    return arr[getRandomInt(0, arr.length - 1)];
}

function generateDate(start: Date, end: Date): Date {
    const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    return d;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const logCount = body.logCount || 100;
        const attendanceCount = body.attendanceCount || 20;
        const clearExisting = body.clearExisting !== false;

        // Date range: March 2026 → current date
        const startDate = new Date('2026-03-01T00:00:00Z');
        const endDate = new Date();

        // Dynamically fetch student IDs if Postgres exists, otherwise use hardcoded.
        let students = Array.from({ length: 15 }, (_, i) => `HS${String(i + 1).padStart(3, '0')}`);

        if (hasPostgres()) {
            await ensureLatestSchema();
            const { sql } = await import('@vercel/postgres');

            // Fetch real student IDs from the database
            let dbStudents = await sql`SELECT id FROM students`;
            
            // If no students exist, auto-create 42 mock students to allow seeding to proceed smoothly
            if (dbStudents.rows.length === 0) {
                const mockStudents = Array.from({ length: 42 }, (_, i) => {
                    const num = String(i + 1).padStart(3, '0');
                    return {
                        id: `HS${num}`,
                        name: `Học sinh Mẫu ${i + 1}`,
                        team: `Tổ ${Math.floor(i / 10) + 1}`
                    };
                });
                
                for (const s of mockStudents) {
                    await sql`
                        INSERT INTO students (id, name, team, position, initial_score) 
                        VALUES (${s.id}, ${s.name}, ${s.team}, 'Học sinh', 100)
                        ON CONFLICT (id) DO NOTHING
                    `;
                }
                
                // Re-query
                dbStudents = await sql`SELECT id FROM students`;
            }

            // Ensure the requested special accounts exist (and their correct student linkages)
            const ensureSpecialAccounts = async () => {
                // 1. Lớp trưởng (HS001)
                await sql`
                    INSERT INTO accounts (id, username, password, role, display_name, student_id)
                    VALUES ('acc_loptruong', 'loptruong', '123456', 'class_leader', 'Lớp Trưởng Mẫu', 'HS001')
                    ON CONFLICT (username) DO UPDATE SET 
                        password = '123456', 
                        role = 'class_leader',
                        student_id = 'HS001'
                `;
                await sql`UPDATE students SET position = 'Lớp trưởng' WHERE id = 'HS001'`;

                // 2. Tổ trưởng Tổ 1 (HS002)
                await sql`
                    INSERT INTO accounts (id, username, password, role, display_name, student_id, team)
                    VALUES ('acc_totruong_to1', 'totruong_to1', '123456', 'team_leader', 'Tổ Trưởng 1 Mẫu', 'HS002', 'Tổ 1')
                    ON CONFLICT (username) DO UPDATE SET 
                        password = '123456', 
                        role = 'team_leader',
                        student_id = 'HS002',
                        team = 'Tổ 1'
                `;
                await sql`UPDATE students SET position = 'Tổ trưởng', team = 'Tổ 1' WHERE id = 'HS002'`;
            };

            await ensureSpecialAccounts();

            students = dbStudents.rows.map(r => r.id);

            // Wipe options
            if (body.wipeAll === true) {
                await sql`DELETE FROM log_entries`;
                await sql`DELETE FROM attendance`;
            } else if (clearExisting) {
                await sql`DELETE FROM log_entries WHERE id LIKE 'LOG_MOCK_%'`;
                await sql`DELETE FROM attendance WHERE id LIKE 'ATT_MOCK_%'`;
            }

            // Insert logs in batches of 25 (to stay within Vercel limits)
            let insertedLogs = 0;
            for (let batch = 0; batch < Math.ceil(logCount / 25); batch++) {
                const batchSize = Math.min(25, logCount - batch * 25);
                for (let j = 0; j < batchSize; j++) {
                    const i = batch * 25 + j + 1;
                    const id = `LOG_MOCK_${String(i).padStart(4, '0')}`;
                    const studentId = getRandomItem(students);
                    const isViolation = Math.random() < 0.7;
                    const incident = isViolation ? getRandomItem(violations) : getRandomItem(achievements);

                    const d = generateDate(startDate, endDate);
                    const dateStr = d.toISOString().split('T')[0];
                    const timestampStr = d.toISOString();

                    const subject = getRandomItem(subjects);
                    const session = Math.random() < 0.8 ? 'morning' : 'afternoon';
                    const period = getRandomInt(1, 5);

                    let status = 'approved';
                    let rejectReason: string | null = null;
                    const randStatus = Math.random();
                    if (randStatus < 0.05) {
                        status = 'rejected';
                        rejectReason = 'Không đúng sự thật';
                    } else if (randStatus < 0.1) {
                        status = 'pending';
                    }

                    const createdBy = Math.random() < 0.2 ? 'teacher_001' : 'acc_HS001';

                    await sql`
                        INSERT INTO log_entries (id, student_id, type, content, point, date, timestamp, subject, session, period, status, reject_reason, created_by)
                        VALUES (${id}, ${studentId}, ${incident.type}, ${incident.content}, ${incident.point}, ${dateStr}, ${timestampStr}, ${subject}, ${session}, ${period}, ${status}, ${rejectReason}, ${createdBy})
                        ON CONFLICT (id) DO NOTHING
                    `;
                    insertedLogs++;
                }
            }

            // Insert attendance
            let insertedAttendance = 0;
            for (let i = 1; i <= attendanceCount; i++) {
                const id = `ATT_MOCK_${i}`;
                const d = generateDate(startDate, endDate);
                const dateStr = d.toISOString().split('T')[0];
                const session = Math.random() < 0.8 ? 'morning' : 'afternoon';
                const studentId = getRandomItem(students);
                const status = getRandomItem(['absent_excused', 'absent_unexcused']);

                await sql`
                    INSERT INTO attendance (id, student_id, date, session, status, note)
                    VALUES (${id}, ${studentId}, ${dateStr}, ${session}, ${status}, NULL)
                    ON CONFLICT (student_id, date, session) DO NOTHING
                `;
                insertedAttendance++;
            }

            return NextResponse.json({
                success: true,
                mode: 'postgres',
                inserted: { logs: insertedLogs, attendance: insertedAttendance },
            });
        } else {
            // Local mode — write to memory store
            const store = getStore();

            // Ensure requested accounts exist locally
            store.accounts = store.accounts || {};
            store.accounts['acc_loptruong'] = {
                id: 'acc_loptruong',
                username: 'loptruong',
                password: '123456',
                role: 'class_leader',
                displayName: 'Lớp Trưởng Mẫu',
                studentId: 'HS001'
            };
            if (store.students && store.students['HS001']) store.students['HS001'].position = 'Lớp trưởng';

            store.accounts['acc_totruong_to1'] = {
                id: 'acc_totruong_to1',
                username: 'totruong_to1',
                password: '123456',
                role: 'team_leader',
                displayName: 'Tổ Trưởng 1 Mẫu',
                studentId: 'HS002',
                team: 'Tổ 1'
            };
            if (store.students && store.students['HS002']) {
                store.students['HS002'].position = 'Tổ trưởng';
                store.students['HS002'].team = 'Tổ 1';
            }

            if (body.wipeAll === true) {
                store.log_entries = {};
                store.attendance = {};
            } else if (clearExisting) {
                // Remove mock entries
                for (const key of Object.keys(store.log_entries)) {
                    if (key.startsWith('LOG_MOCK_')) delete store.log_entries[key];
                }
                for (const key of Object.keys(store.attendance)) {
                    if (key.startsWith('ATT_MOCK_')) delete store.attendance[key];
                }
            }

            let insertedLogs = 0;
            for (let i = 1; i <= logCount; i++) {
                const id = `LOG_MOCK_${String(i).padStart(4, '0')}`;
                const studentId = getRandomItem(students);
                const isViolation = Math.random() < 0.7;
                const incident = isViolation ? getRandomItem(violations) : getRandomItem(achievements);

                const d = generateDate(startDate, endDate);
                const dateStr = d.toISOString().split('T')[0];
                const timestampStr = d.toISOString();

                const subject = getRandomItem(subjects);
                const session = Math.random() < 0.8 ? 'morning' : 'afternoon';
                const period = getRandomInt(1, 5);

                let status = 'approved';
                let rejectReason: string | undefined;
                const randStatus = Math.random();
                if (randStatus < 0.05) {
                    status = 'rejected';
                    rejectReason = 'Không đúng sự thật';
                } else if (randStatus < 0.1) {
                    status = 'pending';
                }

                const createdBy = Math.random() < 0.2 ? 'teacher_001' : 'acc_HS001';

                store.log_entries[id] = {
                    id, studentId, type: incident.type, content: incident.content,
                    point: incident.point, date: dateStr, timestamp: timestampStr,
                    subject, session, period, status, rejectReason, createdBy,
                };
                insertedLogs++;
            }

            let insertedAttendance = 0;
            for (let i = 1; i <= attendanceCount; i++) {
                const id = `ATT_MOCK_${i}`;
                const d = generateDate(startDate, endDate);
                const dateStr = d.toISOString().split('T')[0];
                const session = Math.random() < 0.8 ? 'morning' : 'afternoon';
                const studentId = getRandomItem(students);
                const status = getRandomItem(['absent_excused', 'absent_unexcused']);
                const uniqueKey = `${studentId}_${dateStr}_${session}`;

                store.attendance[uniqueKey] = {
                    id, studentId, date: dateStr, session, status, note: null,
                };
                insertedAttendance++;
            }

            return NextResponse.json({
                success: true,
                mode: 'local',
                inserted: { logs: insertedLogs, attendance: insertedAttendance },
            });
        }
    } catch (error) {
        console.error('POST /api/seed error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// DELETE /api/seed — Remove all mock data
export async function DELETE() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            await sql`DELETE FROM log_entries WHERE id LIKE 'LOG_MOCK_%'`;
            await sql`DELETE FROM attendance WHERE id LIKE 'ATT_MOCK_%'`;
            return NextResponse.json({ success: true, mode: 'postgres' });
        } else {
            const store = getStore();
            for (const key of Object.keys(store.log_entries)) {
                if (key.startsWith('LOG_MOCK_')) delete store.log_entries[key];
            }
            for (const key of Object.keys(store.attendance)) {
                if (key.startsWith('ATT_MOCK_')) delete store.attendance[key];
            }
            return NextResponse.json({ success: true, mode: 'local' });
        }
    } catch (error) {
        console.error('DELETE /api/seed error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
