import { sql } from '@vercel/postgres';

export { sql };

/**
 * Ensures the database schema is up-to-date.
 * Since we are in a serverless environment, we'll run "light" migrations 
 * (adding missing columns) at the start of critical API requests.
 */
export async function ensureLatestSchema() {
    try {
        // 1. Ensure attendance has 'session' column
        await sql`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='session') THEN
                    ALTER TABLE attendance ADD COLUMN session TEXT NOT NULL DEFAULT 'morning' CHECK (session IN ('morning', 'afternoon'));
                END IF;
            END $$;
        `;

        // 2. Ensure attendance unique constraint includes session
        await sql`
            DO $$
            BEGIN
                -- Drop old constraint if it exists (usually named attendance_student_id_date_key or similar)
                ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
                -- Add new one
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_id_date_session_key') THEN
                    ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_date_session_key UNIQUE (student_id, date, session);
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL; 
            END $$;
        `;

        // 3. Ensure log_entries has 'session' column
        await sql`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='log_entries' AND column_name='session') THEN
                    ALTER TABLE log_entries ADD COLUMN session TEXT;
                END IF;
            END $$;
        `;

        // 4. Ensure all basic tables exist
        await sql`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT NOT NULL, team TEXT NOT NULL, position TEXT, initial_score INTEGER NOT NULL DEFAULT 100, note TEXT, status VARCHAR(20) DEFAULT 'active', dropout_date VARCHAR(20), date_of_birth VARCHAR(20))`;
        await sql`CREATE TABLE IF NOT EXISTS log_entries (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, point INTEGER NOT NULL, date TEXT NOT NULL, timestamp TEXT NOT NULL, subject TEXT, session TEXT, period INTEGER, status TEXT DEFAULT 'pending', reject_reason TEXT, created_by TEXT)`;
        await sql`CREATE TABLE IF NOT EXISTS incident_types (id TEXT PRIMARY KEY, content TEXT NOT NULL, point INTEGER NOT NULL, type TEXT NOT NULL)`;
        await sql`CREATE TABLE IF NOT EXISTS class_info (id INTEGER PRIMARY KEY DEFAULT 1, name TEXT NOT NULL DEFAULT '', school_name TEXT NOT NULL DEFAULT '', school_year TEXT NOT NULL DEFAULT '', teacher_name TEXT NOT NULL DEFAULT '', semesters TEXT NOT NULL DEFAULT '[]', logo TEXT, print_logo BOOLEAN DEFAULT true, authorized_students TEXT DEFAULT '[]', CONSTRAINT one_row CHECK (id = 1))`;
        await sql`CREATE TABLE IF NOT EXISTS grade_thresholds (id INTEGER PRIMARY KEY DEFAULT 1, weekly_tot INTEGER NOT NULL DEFAULT 90, weekly_kha INTEGER NOT NULL DEFAULT 70, weekly_dat INTEGER NOT NULL DEFAULT 50, monthly_tot INTEGER NOT NULL DEFAULT 360, monthly_kha INTEGER NOT NULL DEFAULT 280, monthly_dat INTEGER NOT NULL DEFAULT 200, semester_tot INTEGER NOT NULL DEFAULT 1440, semester_kha INTEGER NOT NULL DEFAULT 1120, semester_dat INTEGER NOT NULL DEFAULT 800, CONSTRAINT one_row CHECK (id = 1))`;
        await sql`CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, date TEXT NOT NULL, session TEXT NOT NULL DEFAULT 'morning', status TEXT NOT NULL, note TEXT, UNIQUE(student_id, date, session))`;
        await sql`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE)`;
        await sql`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, display_name TEXT NOT NULL, student_id TEXT, team TEXT)`;
        await sql`CREATE TABLE IF NOT EXISTS positions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, can_create_log BOOLEAN NOT NULL DEFAULT false)`;

        // 5. Ensure default teacher account exists
        await sql`
            INSERT INTO accounts (id, username, password, role, display_name)
            VALUES ('teacher_001', 'gvcnql', 'thptql', 'teacher', 'Nguyễn Thanh Cong')
            ON CONFLICT (id) DO NOTHING
        `;

        // 6. Ensure default settings exist
        await sql`INSERT INTO class_info (id, name, school_year, teacher_name) VALUES (1, '10A1', '2025 - 2026', 'Nguyễn Thanh Cong') ON CONFLICT (id) DO NOTHING`;
        await sql`INSERT INTO grade_thresholds (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

        console.log('[Database] Schema and seed verification completed.');
    } catch (error) {
        console.error('[Database] Migration failed:', error);
        // We don't throw here to avoid blocking the whole app if one minor check fails
    }
}
