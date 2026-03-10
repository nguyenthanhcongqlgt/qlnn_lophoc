// ===== In-Memory Data Store for Local Development =====
// Used as fallback when POSTGRES_URL is not configured (no Vercel Postgres)

export interface MemoryStore {
    students: Record<string, any>;
    log_entries: Record<string, any>;
    incident_types: Record<string, any>;
    attendance: Record<string, any>;
    accounts: Record<string, any>;
    class_info: any;
    grade_thresholds: any;
    subjects: Record<string, any>;
}

const store: MemoryStore = {
    students: {
        'HS001': { id: 'HS001', name: 'Nguyễn Văn An', team: 'Tổ 1', initialScore: 100, note: null },
        'HS002': { id: 'HS002', name: 'Trần Thị Bình', team: 'Tổ 1', initialScore: 100, note: null },
        'HS003': { id: 'HS003', name: 'Lê Văn Cường', team: 'Tổ 1', initialScore: 100, note: null },
        'HS004': { id: 'HS004', name: 'Phạm Thị Dung', team: 'Tổ 2', initialScore: 100, note: null },
        'HS005': { id: 'HS005', name: 'Hoàng Văn Em', team: 'Tổ 2', initialScore: 100, note: null },
        'HS006': { id: 'HS006', name: 'Võ Thị Phương', team: 'Tổ 2', initialScore: 100, note: null },
        'HS007': { id: 'HS007', name: 'Đặng Quốc Hùng', team: 'Tổ 3', initialScore: 100, note: null },
        'HS008': { id: 'HS008', name: 'Bùi Thị Hoa', team: 'Tổ 3', initialScore: 100, note: null },
        'HS009': { id: 'HS009', name: 'Ngô Thanh Tùng', team: 'Tổ 3', initialScore: 100, note: null },
        'HS010': { id: 'HS010', name: 'Lý Thị Kim', team: 'Tổ 4', initialScore: 100, note: null },
        'HS011': { id: 'HS011', name: 'Trịnh Minh Đức', team: 'Tổ 4', initialScore: 100, note: null },
        'HS012': { id: 'HS012', name: 'Huỳnh Thị Lan', team: 'Tổ 4', initialScore: 100, note: null },
        'HS013': { id: 'HS013', name: 'Mai Xuân Trường', team: 'Tổ 1', initialScore: 100, note: null },
        'HS014': { id: 'HS014', name: 'Đỗ Thị Ngọc', team: 'Tổ 2', initialScore: 100, note: null },
        'HS015': { id: 'HS015', name: 'Phan Văn Khải', team: 'Tổ 3', initialScore: 100, note: null },
    },
    log_entries: {},
    incident_types: {
        'V01': { id: 'V01', content: 'Đi học muộn', point: -2, type: 'violation' },
        'V02': { id: 'V02', content: 'Không thuộc bài', point: -5, type: 'violation' },
        'V03': { id: 'V03', content: 'Mất trật tự trong lớp', point: -2, type: 'violation' },
        'V04': { id: 'V04', content: 'Không mặc đồng phục', point: -2, type: 'violation' },
        'V05': { id: 'V05', content: 'Vệ sinh lớp kém', point: -3, type: 'violation' },
        'V06': { id: 'V06', content: 'Sử dụng điện thoại', point: -5, type: 'violation' },
        'V07': { id: 'V07', content: 'Nói tục, chửi bậy', point: -5, type: 'violation' },
        'V08': { id: 'V08', content: 'Không làm bài tập', point: -3, type: 'violation' },
        'A01': { id: 'A01', content: 'Phát biểu xây dựng bài', point: 2, type: 'achievement' },
        'A02': { id: 'A02', content: 'Nhặt được của rơi', point: 10, type: 'achievement' },
        'A03': { id: 'A03', content: 'Giúp đỡ bạn bè', point: 5, type: 'achievement' },
        'A04': { id: 'A04', content: 'Điểm kiểm tra giỏi (9-10)', point: 5, type: 'achievement' },
        'A05': { id: 'A05', content: 'Tham gia hoạt động phong trào', point: 3, type: 'achievement' },
        'A06': { id: 'A06', content: 'Vệ sinh lớp tốt', point: 2, type: 'achievement' },
    },
    attendance: {},
    accounts: {
        'teacher_001': { id: 'teacher_001', username: 'gvcnql', password: 'thptql', role: 'teacher', displayName: 'Nguyễn Thanh Cong', studentId: null, team: null },
        'acc_HS001': { id: 'acc_HS001', username: 'HS001', password: '123456', role: 'student', displayName: 'Nguyễn Văn An', studentId: 'HS001', team: 'Tổ 1' },
        'acc_HS002': { id: 'acc_HS002', username: 'HS002', password: '123456', role: 'student', displayName: 'Trần Thị Bình', studentId: 'HS002', team: 'Tổ 1' },
        'acc_HS003': { id: 'acc_HS003', username: 'HS003', password: '123456', role: 'student', displayName: 'Lê Văn Cường', studentId: 'HS003', team: 'Tổ 1' },
        'acc_HS004': { id: 'acc_HS004', username: 'HS004', password: '123456', role: 'student', displayName: 'Phạm Thị Dung', studentId: 'HS004', team: 'Tổ 2' },
        'acc_HS005': { id: 'acc_HS005', username: 'HS005', password: '123456', role: 'student', displayName: 'Hoàng Văn Em', studentId: 'HS005', team: 'Tổ 2' },
        'acc_HS006': { id: 'acc_HS006', username: 'HS006', password: '123456', role: 'student', displayName: 'Võ Thị Phương', studentId: 'HS006', team: 'Tổ 2' },
        'acc_HS007': { id: 'acc_HS007', username: 'HS007', password: '123456', role: 'student', displayName: 'Đặng Quốc Hùng', studentId: 'HS007', team: 'Tổ 3' },
        'acc_HS008': { id: 'acc_HS008', username: 'HS008', password: '123456', role: 'student', displayName: 'Bùi Thị Hoa', studentId: 'HS008', team: 'Tổ 3' },
        'acc_HS009': { id: 'acc_HS009', username: 'HS009', password: '123456', role: 'student', displayName: 'Ngô Thanh Tùng', studentId: 'HS009', team: 'Tổ 3' },
        'acc_HS010': { id: 'acc_HS010', username: 'HS010', password: '123456', role: 'student', displayName: 'Lý Thị Kim', studentId: 'HS010', team: 'Tổ 4' },
        'acc_HS011': { id: 'acc_HS011', username: 'HS011', password: '123456', role: 'student', displayName: 'Trịnh Minh Đức', studentId: 'HS011', team: 'Tổ 4' },
        'acc_HS012': { id: 'acc_HS012', username: 'HS012', password: '123456', role: 'student', displayName: 'Huỳnh Thị Lan', studentId: 'HS012', team: 'Tổ 4' },
        'acc_HS013': { id: 'acc_HS013', username: 'HS013', password: '123456', role: 'student', displayName: 'Mai Xuân Trường', studentId: 'HS013', team: 'Tổ 1' },
        'acc_HS014': { id: 'acc_HS014', username: 'HS014', password: '123456', role: 'student', displayName: 'Đỗ Thị Ngọc', studentId: 'HS014', team: 'Tổ 2' },
        'acc_HS015': { id: 'acc_HS015', username: 'HS015', password: '123456', role: 'student', displayName: 'Phan Văn Khải', studentId: 'HS015', team: 'Tổ 3' },
    },
    class_info: { name: '10A1', schoolYear: '2025 - 2026', teacherName: 'Nguyễn Thanh Cong', semesters: [], logo: null },
    grade_thresholds: {
        weekly: { tot: 90, kha: 70, dat: 50 },
        monthly: { tot: 360, kha: 280, dat: 200 },
        semester: { tot: 1440, kha: 1120, dat: 800 },
    },
    subjects: {
        'SUB_01': { id: 'SUB_01', name: 'Ngữ văn' },
        'SUB_02': { id: 'SUB_02', name: 'Toán' },
        'SUB_03': { id: 'SUB_03', name: 'Lịch sử' },
        'SUB_04': { id: 'SUB_04', name: 'Địa lý' },
        'SUB_05': { id: 'SUB_05', name: 'GDKTPL' },
        'SUB_06': { id: 'SUB_06', name: 'GDTC' },
        'SUB_07': { id: 'SUB_07', name: 'Vật lý' },
        'SUB_08': { id: 'SUB_08', name: 'Hóa học' },
        'SUB_09': { id: 'SUB_09', name: 'Sinh học' },
        'SUB_10': { id: 'SUB_10', name: 'Tin học' },
        'SUB_11': { id: 'SUB_11', name: 'Công nghệ' },
        'SUB_12': { id: 'SUB_12', name: 'Ngoại ngữ' },
    },
};

export function hasPostgres(): boolean {
    return !!process.env.POSTGRES_URL;
}

export function getStore(): MemoryStore {
    return store;
}

export function resetStoreForNewYear(newYear: string, keepStudents: boolean) {
    // Keep students but reset scores/notes
    if (keepStudents) {
        for (const id in store.students) {
            store.students[id].initialScore = 100;
            store.students[id].note = null;
        }
    } else {
        store.students = {};
    }
    // Clear transient data
    store.log_entries = {};
    store.attendance = {};

    const parts = newYear.split(' - ');
    const startYear = parts[0] || String(new Date().getFullYear());
    const endYear = parts.length > 1 ? parts[1] : String(parseInt(startYear) + 1);

    const defaultSemesters = [
        { id: `sem_1_${startYear}`, name: 'Học kỳ I', startDate: `${startYear}-09-05`, endDate: `${startYear}-12-31` },
        { id: `sem_2_${endYear}`, name: 'Học kỳ II', startDate: `${endYear}-01-01`, endDate: `${endYear}-05-30` }
    ];

    // Reset class info
    store.class_info = { ...store.class_info, schoolYear: newYear, semesters: defaultSemesters, logo: store.class_info.logo || null };
    store.grade_thresholds = {
        weekly: { tot: 90, kha: 70, dat: 50 },
        monthly: { tot: 360, kha: 280, dat: 200 },
        semester: { tot: 1440, kha: 1120, dat: 800 },
    };
    // Reset student accounts (keep teacher)
    const teacherAccounts: Record<string, any> = {};
    for (const id in store.accounts) {
        if (store.accounts[id].role === 'teacher') {
            teacherAccounts[id] = store.accounts[id];
        }
    }

    // Re-create student accounts from remaining students (if any)
    for (const sId in store.students) {
        const s = store.students[sId];
        const accId = `acc_${sId}`;
        teacherAccounts[accId] = {
            id: accId, username: sId, password: '123456',
            role: 'student', displayName: s.name,
            studentId: sId, team: s.team,
        };
    }
    store.accounts = teacherAccounts;
}
