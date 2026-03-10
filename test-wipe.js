require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function testWipe() {
    console.log("Attempting Wipe...");
    try {
        await sql`DELETE FROM log_entries`;
        await sql`DELETE FROM attendance`;
        await sql`DELETE FROM students`;
        await sql`DELETE FROM accounts WHERE role != 'teacher'`;
        await sql`DELETE FROM incident_types`;
        await sql`DELETE FROM subjects`;
        console.log("Wipe Success");
    } catch (e) {
        console.error("Caught error:", e);
    }
}
testWipe();
