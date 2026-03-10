// ===== API: Class Info & Grade Thresholds & School Year =====
// Dual mode: Vercel Postgres (production) / In-memory (local dev)

import { NextRequest, NextResponse } from 'next/server';
import { hasPostgres, getStore, resetStoreForNewYear } from '@/lib/memory-store';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');
            const classResult = await sql`
                SELECT name, school_year AS "schoolYear", teacher_name AS "teacherName",
                       COALESCE(semesters, '[]') AS semesters, logo, print_logo AS "printLogo", COALESCE(authorized_students, '[]') AS authorized_students
                FROM class_info WHERE id = 1
            `;
            const thresholdResult = await sql`
                SELECT 
                    weekly_tot, weekly_kha, weekly_dat,
                    monthly_tot, monthly_kha, monthly_dat,
                    semester_tot, semester_kha, semester_dat
                FROM grade_thresholds WHERE id = 1
            `;

            const raw = classResult.rows[0];
            const classInfo = raw
                ? { name: raw.name, schoolYear: raw.schoolYear, teacherName: raw.teacherName, semesters: typeof raw.semesters === 'string' ? JSON.parse(raw.semesters) : raw.semesters, logo: raw.logo, printLogo: raw.printLogo ?? true, authorizedStudents: typeof raw.authorized_students === 'string' ? JSON.parse(raw.authorized_students) : raw.authorized_students }
                : { name: '', schoolYear: '', teacherName: '', semesters: [], logo: null, printLogo: true, authorizedStudents: [] };

            const tr = thresholdResult.rows[0];
            const thresholds = tr ? {
                weekly: { tot: tr.weekly_tot, kha: tr.weekly_kha, dat: tr.weekly_dat },
                monthly: { tot: tr.monthly_tot, kha: tr.monthly_kha, dat: tr.monthly_dat },
                semester: { tot: tr.semester_tot, kha: tr.semester_kha, dat: tr.semester_dat }
            } : {
                weekly: { tot: 90, kha: 70, dat: 50 },
                monthly: { tot: 360, kha: 280, dat: 200 },
                semester: { tot: 1440, kha: 1120, dat: 800 }
            };

            return NextResponse.json({ classInfo, thresholds });
        }

        const store = getStore();
        return NextResponse.json({
            classInfo: store.class_info,
            thresholds: store.grade_thresholds,
        });
    } catch (error) {
        console.error('GET /api/settings error:', error);
        return NextResponse.json({
            classInfo: { name: '', schoolYear: '', teacherName: '', semesters: [], logo: null, printLogo: true, authorizedStudents: [] },
            thresholds: {
                weekly: { tot: 90, kha: 70, dat: 50 },
                monthly: { tot: 360, kha: 280, dat: 200 },
                semester: { tot: 1440, kha: 1120, dat: 800 }
            }
        }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { type } = body;

        if (type === 'classInfo') {
            const { name, schoolName, schoolYear, teacherName, semesters, logo, printLogo, authorizedStudents } = body.data;
            const semestersJson = JSON.stringify(semesters || []);
            const authJson = JSON.stringify(authorizedStudents || []);
            const printLogoVal = printLogo ?? true;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                await sql`
                    INSERT INTO class_info (id, name, school_name, school_year, teacher_name, semesters, logo, print_logo, authorized_students)
                    VALUES (1, ${name}, ${schoolName || ''}, ${schoolYear}, ${teacherName}, ${semestersJson}, ${logo || null}, ${printLogoVal}, ${authJson})
                    ON CONFLICT (id) DO UPDATE SET
                        name = ${name}, school_name = ${schoolName || ''}, school_year = ${schoolYear},
                        teacher_name = ${teacherName}, semesters = ${semestersJson}, logo = ${logo || null}, print_logo = ${printLogoVal}, authorized_students = ${authJson}
                `;
            } else {
                getStore().class_info = { name, schoolName: schoolName || '', schoolYear, teacherName, semesters, logo, printLogo: printLogoVal, authorizedStudents };
            }
        } else if (type === 'thresholds') {
            const { weekly, monthly, semester } = body.data;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                await sql`
                    INSERT INTO grade_thresholds (id, weekly_tot, weekly_kha, weekly_dat, monthly_tot, monthly_kha, monthly_dat, semester_tot, semester_kha, semester_dat)
                    VALUES (1, ${weekly.tot}, ${weekly.kha}, ${weekly.dat}, ${monthly.tot}, ${monthly.kha}, ${monthly.dat}, ${semester.tot}, ${semester.kha}, ${semester.dat})
                    ON CONFLICT (id) DO UPDATE SET
                        weekly_tot = ${weekly.tot}, weekly_kha = ${weekly.kha}, weekly_dat = ${weekly.dat},
                        monthly_tot = ${monthly.tot}, monthly_kha = ${monthly.kha}, monthly_dat = ${monthly.dat},
                        semester_tot = ${semester.tot}, semester_kha = ${semester.kha}, semester_dat = ${semester.dat}
                `;
            } else {
                getStore().grade_thresholds = { weekly, monthly, semester };
            }
        } else if (type === 'newSchoolYear') {
            const { schoolYear } = body.data;
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                // Reset: clear logs, attendance; keep students but reset scores
                await sql`DELETE FROM log_entries`;
                await sql`DELETE FROM attendance`;
                await sql`UPDATE students SET initial_score = 100, note = NULL`;
                const parts = schoolYear.split(' - ');
                const startYear = parts[0] || String(new Date().getFullYear());
                const endYear = parts.length > 1 ? parts[1] : String(parseInt(startYear) + 1);
                const defaultSemesters = [
                    { id: `sem_1_${startYear}`, name: 'Học kỳ I', startDate: `${startYear}-09-05`, endDate: `${startYear}-12-31` },
                    { id: `sem_2_${endYear}`, name: 'Học kỳ II', startDate: `${endYear}-01-01`, endDate: `${endYear}-05-30` }
                ];

                await sql`
                    UPDATE class_info SET school_year = ${schoolYear}, semesters = ${JSON.stringify(defaultSemesters)} WHERE id = 1
                `;
                await sql`UPDATE grade_thresholds SET 
                    weekly_tot = 90, weekly_kha = 70, weekly_dat = 50,
                    monthly_tot = 360, monthly_kha = 280, monthly_dat = 200,
                    semester_tot = 1440, semester_kha = 1120, semester_dat = 800
                WHERE id = 1`;
                // Reset student account passwords
                await sql`UPDATE accounts SET password = '123456' WHERE role != 'teacher'`;
            } else {
                resetStoreForNewYear(schoolYear, true);
            }
        } else if (type === 'resetAllData') {
            console.log('--- API: Received resetAllData request ---');
            if (hasPostgres()) {
                const { sql } = await import('@vercel/postgres');
                try {
                    console.log('--- STARTING DANGER WIPE (Postgres) ---');
                    await sql`DELETE FROM log_entries`;
                    console.log('log_entries cleared');
                    await sql`DELETE FROM attendance`;
                    console.log('attendance cleared');
                    await sql`DELETE FROM accounts WHERE role != 'teacher'`;
                    console.log('accounts cleared');
                    await sql`DELETE FROM students`;
                    console.log('students cleared');
                    await sql`DELETE FROM incident_types`;
                    console.log('incident_types cleared');
                    await sql`DELETE FROM subjects`;
                    console.log('subjects cleared');
                    await sql`DELETE FROM positions`;
                    console.log('positions cleared');
                } catch (e) {
                    console.error('DANGER WIPE FAILED AT SOME POINT:', e);
                    throw e;
                }

                // Re-seed default subjects
                console.log('Re-seeding subjects...');
                await sql`INSERT INTO subjects (id, name) VALUES
                    ('SUB_01', 'Ngữ văn'), ('SUB_02', 'Toán'), ('SUB_03', 'Lịch sử'), ('SUB_04', 'Địa lý'),
                    ('SUB_05', 'GDKTPL'), ('SUB_06', 'GDTC'), ('SUB_07', 'Vật lý'), ('SUB_08', 'Hóa học'),
                    ('SUB_09', 'Sinh học'), ('SUB_10', 'Tin học'), ('SUB_11', 'Công nghệ'), ('SUB_12', 'Ngoại ngữ')
                `;

                // Re-seed default incidents
                console.log('Re-seeding incidents...');
                await sql`INSERT INTO incident_types (id, content, point, type) VALUES
                    ('V01', 'Đi học muộn', -2, 'violation'), ('V02', 'Không thuộc bài', -5, 'violation'),
                    ('V03', 'Mất trật tự trong lớp', -2, 'violation'), ('V04', 'Không mặc đồng phục', -2, 'violation'),
                    ('V05', 'Vệ sinh lớp kém', -3, 'violation'), ('V06', 'Sử dụng điện thoại', -5, 'violation'),
                    ('V07', 'Nói tục, chửi bậy', -5, 'violation'), ('V08', 'Không làm bài tập', -3, 'violation'),
                    ('A01', 'Phát biểu xây dựng bài', 2, 'achievement'), ('A02', 'Nhặt được của rơi', 10, 'achievement'),
                    ('A03', 'Giúp đỡ bạn bè', 5, 'achievement'), ('A04', 'Điểm kiểm tra giỏi (9-10)', 5, 'achievement'),
                    ('A05', 'Tham gia hoạt động phong trào', 3, 'achievement'), ('A06', 'Vệ sinh lớp tốt', 2, 'achievement')
                `;

                // Re-seed default positions
                console.log('Re-seeding positions...');
                await sql`INSERT INTO positions (id, name, can_create_log) VALUES
                    ('pos_lt', 'Lớp trưởng', true), ('pos_bt', 'Bí thư', true),
                    ('pos_lpht', 'Lớp phó học tập', true), ('pos_lptm', 'Lớp phó thẩm mỹ', true),
                    ('pos_lpld', 'Lớp phó lao động', true), ('pos_lpxd', 'Lớp phó văn thể mỹ', true),
                    ('pos_tt', 'Tổ trưởng', true), ('pos_hs', 'Học sinh', false)
                `;

                // Keep the default teacher account
                const resetYear = '2025 - 2026';
                const defaultSemesters = [
                    { id: 'sem_1_2025', name: 'Học kỳ I', startDate: '2025-09-05', endDate: '2025-12-31' },
                    { id: 'sem_2_2026', name: 'Học kỳ II', startDate: '2026-01-01', endDate: '2026-05-30' }
                ];
                await sql`UPDATE class_info SET authorized_students = '[]', school_year = ${resetYear}, semesters = ${JSON.stringify(defaultSemesters)} WHERE id = 1`;
                console.log('Class info updated');
            } else {
                console.log('--- STARTING DANGER WIPE (Memory) ---');
                const store = getStore();
                // Reset standard elements
                resetStoreForNewYear('2025 - 2026', false);
                // Hard reset the subjects and incidents for memory-store
                store.subjects = {
                    'SUB_01': { id: 'SUB_01', name: 'Ngữ văn' },
                    'SUB_02': { id: 'SUB_02', name: 'Toán' },
                    'SUB_03': { id: 'SUB_03', name: 'Lịch sử' },
                    'SUB_04': { id: 'SUB_04', name: 'Địa lý' },
                    'SUB_05': { id: 'SUB_05', name: 'GDKTPL' },
                    'SUB_06': { id: 'SUB_06', name: 'GDTC' },
                    'SUB_07': { id: 'SUB_07', name: 'Vật lý' },
                    'SUB_08': { id: 'SUB_08', name: 'Hóa học' },
                    'SUB_09': { id: 'SUB_09', name: 'Sinh học' },
                    'SUB_10': { id: 'SUB_10', name: 'Tin học' },
                    'SUB_11': { id: 'SUB_11', name: 'Công nghệ' },
                    'SUB_12': { id: 'SUB_12', name: 'Ngoại ngữ' },
                };
                store.incident_types = {
                    'V01': { id: 'V01', content: 'Đi học muộn', point: -2, type: 'violation' },
                    'V02': { id: 'V02', content: 'Không thuộc bài', point: -5, type: 'violation' },
                    'V03': { id: 'V03', content: 'Mất trật tự trong lớp', point: -2, type: 'violation' },
                    'V04': { id: 'V04', content: 'Không mặc đồng phục', point: -2, type: 'violation' },
                    'V05': { id: 'V05', content: 'Vệ sinh lớp kém', point: -3, type: 'violation' },
                    'V06': { id: 'V06', content: 'Sử dụng điện thoại', point: -5, type: 'violation' },
                    'V07': { id: 'V07', content: 'Nói tục, chửi bậy', point: -5, type: 'violation' },
                    'V08': { id: 'V08', content: 'Không làm bài tập', point: -3, type: 'violation' },
                    'A01': { id: 'A01', content: 'Phát biểu xây dựng bài', point: 2, type: 'achievement' },
                    'A02': { id: 'A02', content: 'Nhặt được của rơi', point: 10, type: 'achievement' },
                    'A03': { id: 'A03', content: 'Giúp đỡ bạn bè', point: 5, type: 'achievement' },
                    'A04': { id: 'A04', content: 'Điểm kiểm tra giỏi (9-10)', point: 5, type: 'achievement' },
                    'A05': { id: 'A05', content: 'Tham gia hoạt động phong trào', point: 3, type: 'achievement' },
                    'A06': { id: 'A06', content: 'Vệ sinh lớp tốt', point: 2, type: 'achievement' }
                };
                store.positions = {
                    'pos_lt': { id: 'pos_lt', name: 'Lớp trưởng', canCreateLog: true },
                    'pos_bt': { id: 'pos_bt', name: 'Bí thư', canCreateLog: true },
                    'pos_lpht': { id: 'pos_lpht', name: 'Lớp phó học tập', canCreateLog: true },
                    'pos_tt': { id: 'pos_tt', name: 'Tổ trưởng', canCreateLog: true },
                    'pos_hs': { id: 'pos_hs', name: 'Học sinh', canCreateLog: false },
                };
                console.log('--- DANGER WIPE COMPLETE (Memory) ---');
            }
            // revalidate the cache heavily for Next.js to drop previous static states
            revalidatePath('/', 'layout');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/settings error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
