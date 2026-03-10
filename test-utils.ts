import { generateBaseUsername } from './lib/utils';

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
