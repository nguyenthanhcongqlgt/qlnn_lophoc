function generateBaseUsername(fullName) {
    if (!fullName) return '';
    const noAccents = fullName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/\s+/g, '')
        // Add replace command to strip all non alphabetic/numeric characters
        .replace(/[^a-z0-9]/g, '');
    return 'hs_' + noAccents;
}

const tests = [
    "Trần Thị B",
    "Nguyễn Văn A",
    "Lê Văn C",
    "Nguyễn-Thị Quỳnh",
    "Trần Văn D'Artagnan",
    " Phạm    Văn   E ",
    "Nguyễn \t Thị \n F"
];

for (const name of tests) {
    console.log(`"${name}" -> "${generateBaseUsername(name)}"`);
}
