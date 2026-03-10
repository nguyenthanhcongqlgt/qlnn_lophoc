fetch('http://localhost:3000/api/students')
    .then(res => res.json())
    .then(data => {
        const student = data.find(s => s.name && s.name.toLowerCase() === 'mai tuấn anh');
        if (student) {
            console.log('Found Student:', student.name);
            console.log('Username:', student.username);
        } else {
            console.log('Student not found exactly. Searching partial matches:');
            const matches = data.filter(s => s.name && s.name.toLowerCase().includes('mai tuấn anh') || s.name.toLowerCase().includes('mai tuan anh'));
            matches.forEach(m => {
                console.log('Match:', m.name, '-> Username:', m.username);
            });
        }
    })
    .catch(err => console.error(err));
