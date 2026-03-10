import { NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let backupData: any = {};

        if (hasPostgres()) {
            const { sql } = await import('@vercel/postgres');

            const [
                classInfo, thresholds, students, accounts, incidents, subjects, logs, attendance
            ] = await Promise.all([
                sql`SELECT * FROM class_info`,
                sql`SELECT * FROM grade_thresholds`,
                sql`SELECT * FROM students`,
                sql`SELECT * FROM accounts`,
                sql`SELECT * FROM incident_types`,
                sql`SELECT * FROM subjects`,
                sql`SELECT * FROM log_entries`,
                sql`SELECT * FROM attendance`
            ]);

            backupData = {
                metadata: {
                    version: "1.0",
                    timestamp: new Date().toISOString(),
                    type: "postgres"
                },
                class_info: classInfo.rows,
                grade_thresholds: thresholds.rows,
                students: students.rows,
                accounts: accounts.rows,
                incident_types: incidents.rows,
                subjects: subjects.rows,
                log_entries: logs.rows,
                attendance: attendance.rows
            };
        } else {
            const store = getStore();
            backupData = {
                metadata: {
                    version: "1.0",
                    timestamp: new Date().toISOString(),
                    type: "memory"
                },
                ...store
            };
        }

        const jsonString = JSON.stringify(backupData, null, 2);
        const fileName = `csdl_backup_${new Date().toISOString().split('T')[0]}.json`;

        return new NextResponse(jsonString, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('Lỗi khi sao lưu dữ liệu:', error);
        return NextResponse.json({ error: 'Failed to backup database', details: error.message }, { status: 500 });
    }
}
