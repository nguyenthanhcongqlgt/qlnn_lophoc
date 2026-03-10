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

        // 4. Ensure positions table exists
        await sql`
            CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                can_create_log BOOLEAN NOT NULL DEFAULT false
            );
        `;

        console.log('[Database] Schema verification/migration completed.');
    } catch (error) {
        console.error('[Database] Migration failed:', error);
        // We don't throw here to avoid blocking the whole app if one minor check fails
    }
}
