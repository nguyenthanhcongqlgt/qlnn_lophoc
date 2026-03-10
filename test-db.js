require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
console.log('POSTGRES_URL from env:', !!process.env.POSTGRES_URL);

if (process.env.POSTGRES_URL) {
    const { createClient } = require('@vercel/postgres');
    const client = createClient();
    client.connect()
        .then(() => client.query("SELECT username, password FROM accounts WHERE display_name ILIKE '%Mai Tuấn Anh%' OR display_name ILIKE '%Mai Tuan Anh%';"))
        .then(res => {
            console.log('Result:', res.rows);
            client.end();
        })
        .catch(err => {
            console.error('DB Error:', err);
            client.end();
        });
} else {
    console.log('No POSTGRES_URL found. Checking all process.env keys:');
    console.log(Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DB_')));
}
