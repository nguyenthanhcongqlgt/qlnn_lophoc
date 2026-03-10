require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
async function checkUsers() {
    try {
        console.log("Connecting...");
        const { rows } = await sql`SELECT username, password FROM accounts ORDER BY username desc limit 20`;
        console.log("Accounts:");
        rows.forEach(r => console.log(r));
    } catch (e) {
        console.error(e);
    }
}
checkUsers();
