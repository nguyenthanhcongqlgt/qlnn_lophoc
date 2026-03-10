const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), '.local-db.json');
if (!fs.existsSync(dbPath)) {
    console.error('.local-db.json not found');
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const searchName = 'Mai Tuấn Anh'.toLowerCase();
const searchNameNoAccent = 'Mai Tuan Anh'.toLowerCase();

let foundStudentId = null;

for (const id in db.students) {
    const s = db.students[id];
    const sName = s.name.toLowerCase();
    if (sName === searchName || sName === searchNameNoAccent || sName.includes('mai tuấn anh') || sName.includes('mai tuan anh')) {
        console.log('Found student:', s);
        foundStudentId = id;
    }
}

if (foundStudentId) {
    for (const accId in db.accounts) {
        const acc = db.accounts[accId];
        if (acc.studentId === foundStudentId || acc.displayName.toLowerCase().includes('mai tuấn anh') || acc.displayName.toLowerCase().includes('mai tuan anh')) {
            console.log('Found account:', acc);
        }
    }
} else {
    console.log('Student not found in memory store. Checking accounts directly...');
    for (const accId in db.accounts) {
        const acc = db.accounts[accId];
        if (acc.displayName && (acc.displayName.toLowerCase().includes('mai tuấn anh') || acc.displayName.toLowerCase().includes('mai tuan anh'))) {
            console.log('Found account directly:', acc);
        }
    }
}
