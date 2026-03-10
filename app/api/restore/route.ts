import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();

        // Basic validation
        if (!payload.metadata || !payload.metadata.version) {
            return NextResponse.json({ error: 'File sao lưu không hợp lệ.' }, { status: 400 });
        }

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');

            // 1. Wipe current standard tables
            await sql`DELETE FROM log_entries`;
            await sql`DELETE FROM attendance`;
            await sql`DELETE FROM students`;
            await sql`DELETE FROM accounts`;
            await sql`DELETE FROM incident_types`;
            await sql`DELETE FROM subjects`;
            await sql`DELETE FROM class_info`;
            await sql`DELETE FROM grade_thresholds`;

            // 2. Re-insert backup data
            // Since we can't easily bulk insert heterogeneous objects cleanly without an ORM,
            // we will iterate and insert. (This is a simplified approach, suitable for small DBs)

            // Class Info
            for (const row of payload.class_info || []) {
                await sql`INSERT INTO class_info (id, name, school_year, teacher_name, semesters, print_logo, authorized_students) 
                          VALUES (${row.id}, ${row.name}, ${row.school_year}, ${row.teacher_name}, ${row.semesters}, ${row.print_logo}, ${row.authorized_students})`;
            }

            // Grade Thresholds
            for (const row of payload.grade_thresholds || []) {
                await sql`INSERT INTO grade_thresholds (id, weekly_tot, weekly_kha, weekly_dat, monthly_tot, monthly_kha, monthly_dat, semester_tot, semester_kha, semester_dat)
                          VALUES (${row.id}, ${row.weekly_tot}, ${row.weekly_kha}, ${row.weekly_dat}, ${row.monthly_tot}, ${row.monthly_kha}, ${row.monthly_dat}, ${row.semester_tot}, ${row.semester_kha}, ${row.semester_dat})`;
            }

            // Subjects
            for (const row of payload.subjects || []) {
                await sql`INSERT INTO subjects (id, name) VALUES (${row.id}, ${row.name})`;
            }

            // Incident Types
            for (const row of payload.incident_types || []) {
                await sql`INSERT INTO incident_types (id, content, point, type) VALUES (${row.id}, ${row.content}, ${row.point}, ${row.type})`;
            }

            // Students
            for (const row of payload.students || []) {
                await sql`INSERT INTO students (id, name, team, position, initial_score, note, status, dropout_date, date_of_birth) 
                          VALUES (${row.id}, ${row.name}, ${row.team}, ${row.position}, ${row.initial_score}, ${row.note}, ${row.status}, ${row.dropout_date}, ${row.date_of_birth})`;
            }

            // Accounts
            for (const row of payload.accounts || []) {
                await sql`INSERT INTO accounts (id, username, password, role, display_name, student_id, team)
                          VALUES (${row.id}, ${row.username}, ${row.password}, ${row.role}, ${row.display_name}, ${row.student_id}, ${row.team})`;
            }

            // Attendance
            for (const row of payload.attendance || []) {
                await sql`INSERT INTO attendance (id, student_id, date, status, note) 
                          VALUES (${row.id}, ${row.student_id}, ${row.date}, ${row.status}, ${row.note})`;
            }

            // Logs
            for (const row of payload.log_entries || []) {
                await sql`INSERT INTO log_entries (id, student_id, type, content, point, timestamp, status, author_id, approver_id, note)
                          VALUES (${row.id}, ${row.student_id}, ${row.type}, ${row.content}, ${row.point}, ${row.timestamp}, ${row.status}, ${row.author_id}, ${row.approver_id}, ${row.note})`;
            }

        } else {
            const store = getStore();
            // Completely override memory store dictionaries
            store.students = payload.students || {};
            store.log_entries = payload.log_entries || {};
            store.incident_types = payload.incident_types || {};
            store.attendance = payload.attendance || {};
            store.accounts = payload.accounts || {};
            store.class_info = payload.class_info || { name: '10A1', schoolYear: '2025 - 2026', teacherName: '', semesters: [] };
            store.grade_thresholds = payload.grade_thresholds || {
                weekly: { tot: 90, kha: 70, dat: 50 },
                monthly: { tot: 360, kha: 280, dat: 200 },
                semester: { tot: 1440, kha: 1120, dat: 800 },
            };
            store.subjects = payload.subjects || {};
        }

        revalidatePath('/', 'layout');
        return NextResponse.json({ success: true, message: 'Phục hồi thành công' });
    } catch (error: any) {
        console.error('Lỗi khi phục hồi dữ liệu:', error);
        return NextResponse.json({ error: 'Quá trình phục hồi thất bại. Vui lòng kiểm tra lại file.', details: error.message }, { status: 500 });
    }
}
