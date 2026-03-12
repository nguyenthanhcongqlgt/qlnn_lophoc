// ===== File-Based Data Store for Local Development =====
// Used as fallback when POSTGRES_URL is not configured (no Vercel Postgres).
// Uses a JSON file on disk so data persists across hot-reloads and server restarts,
// and is shared between all Next.js worker processes.

import fs from 'fs';
import path from 'path';

export interface MemoryStore {
    students: Record<string, any>;
    log_entries: Record<string, any>;
    incident_types: Record<string, any>;
    attendance: Record<string, any>;
    accounts: Record<string, any>;
    class_info: any;
    grade_thresholds: any;
    subjects: Record<string, any>;
    positions: Record<string, any>;
}

const DB_PATH = path.join(process.cwd(), '.local-db.json');

const DEFAULT_STORE: MemoryStore = {
    students: {},
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
    },
    class_info: { name: '10A1', schoolYear: '2025 - 2026', teacherName: 'Nguyễn Thanh Cong', semesters: [], logo: null, authorizedStudents: [] },
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
    positions: {
        'pos_lt': { id: 'pos_lt', name: 'Lớp trưởng', canCreateLog: true },
        'pos_lp': { id: 'pos_lp', name: 'Lớp phó', canCreateLog: true },
        'pos_bt': { id: 'pos_bt', name: 'Bí thư', canCreateLog: true },
        'pos_tt': { id: 'pos_tt', name: 'Tổ trưởng', canCreateLog: true },
        'pos_cd': { id: 'pos_cd', name: 'Cờ đỏ', canCreateLog: true },
        'pos_dv': { id: 'pos_dv', name: 'Đội viên', canCreateLog: false },
        'pos_hs': { id: 'pos_hs', name: 'Học sinh', canCreateLog: false },
    },
};

// ── File I/O helpers ──

function loadFromFile(): MemoryStore {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            // Merge with defaults to ensure all keys exist (for migrations)
            return {
                ...DEFAULT_STORE,
                ...parsed,
            };
        }
    } catch (e) {
        console.warn('[local-db] Failed to load, using defaults:', e);
    }
    return { ...DEFAULT_STORE };
}

function saveToFile(data: MemoryStore): void {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[local-db] Failed to save:', e);
    }
}

// ── Proxy store: reads from file on every access, writes back on mutation ──
// This ensures all worker processes see the same data.

function createDeepProxy(target: any, onChange: () => void): any {
    if (target === null || typeof target !== 'object') {
        return target;
    }
    return new Proxy(target, {
        get(t, p) {
            // Optimization: don't proxy Date or other built-in objects if needed, 
            // but standard JSON parse yields plain objects and arrays
            return createDeepProxy(t[p], onChange);
        },
        set(t, p, val) {
            t[p] = val;
            onChange();
            return true;
        },
        deleteProperty(t, p) {
            delete t[p];
            onChange();
            return true;
        }
    });
}

function createFileBackedStore(): MemoryStore {
    return new Proxy({} as MemoryStore, {
        get(_target: any, prop: string | symbol): any {
            const data = loadFromFile();
            const value = (data as any)[prop];
            return createDeepProxy(value, () => {
                saveToFile(data);
            });
        },
        set(_target: any, prop: string | symbol, value: any) {
            const data = loadFromFile();
            (data as any)[prop] = value;
            saveToFile(data);
            return true;
        },
    });
}

const store: MemoryStore = createFileBackedStore();

export function hasPostgres(): boolean {
    if (process.env.STORAGE_URL && !process.env.POSTGRES_URL) {
        process.env.POSTGRES_URL = process.env.STORAGE_URL;
    }
    return !!process.env.POSTGRES_URL;
}

export function getStore(): MemoryStore {
    return store;
}

// ── Save the store explicitly (call this after batch mutations) ──
export function saveStore(): void {
    // No-op: the proxy saves on every set automatically.
    // This is a compatibility shim for any code that calls saveStore() directly.
}

export function resetStoreForNewYear(newYear: string, keepStudents: boolean) {
    console.log('--- File Store: Resetting Data ---')
    const data = loadFromFile();

    if (keepStudents) {
        for (const id in data.students) {
            data.students[id].initialScore = 100;
            data.students[id].note = null;
        }
    } else {
        data.students = {};
    }

    data.log_entries = {};
    data.attendance = {};
    data.positions = {
        'pos_lt': { id: 'pos_lt', name: 'Lớp trưởng', canCreateLog: true },
        'pos_lp': { id: 'pos_lp', name: 'Lớp phó', canCreateLog: true },
        'pos_bt': { id: 'pos_bt', name: 'Bí thư', canCreateLog: true },
        'pos_tt': { id: 'pos_tt', name: 'Tổ trưởng', canCreateLog: true },
        'pos_cd': { id: 'pos_cd', name: 'Cờ đỏ', canCreateLog: true },
        'pos_hs': { id: 'pos_hs', name: 'Học sinh', canCreateLog: false },
    };

    const parts = newYear.split(' - ');
    const startYear = parts[0] || String(new Date().getFullYear());
    const endYear = parts.length > 1 ? parts[1] : String(parseInt(startYear) + 1);

    const defaultSemesters = [
        { id: `sem_1_${startYear}`, name: 'Học kỳ I', startDate: `${startYear}-09-05`, endDate: `${startYear}-12-31` },
        { id: `sem_2_${endYear}`, name: 'Học kỳ II', startDate: `${endYear}-01-01`, endDate: `${endYear}-05-30` }
    ];

    data.class_info = {
        ...data.class_info,
        schoolYear: newYear,
        semesters: defaultSemesters,
        logo: data.class_info?.logo || null,
        authorizedStudents: [],
    };

    data.grade_thresholds = {
        weekly: { tot: 90, kha: 70, dat: 50 },
        monthly: { tot: 360, kha: 280, dat: 200 },
        semester: { tot: 1440, kha: 1120, dat: 800 },
    };

    // Keep only teacher accounts
    const teacherAccounts: Record<string, any> = {};
    for (const id in data.accounts) {
        if (data.accounts[id].role === 'teacher') {
            teacherAccounts[id] = data.accounts[id];
        }
    }

    // Re-create student accounts from remaining students
    for (const sId in data.students) {
        const s = data.students[sId];
        const accId = `acc_${sId}`;
        const username = generateBaseUsername(s.name) || sId;
        teacherAccounts[accId] = {
            id: accId,
            username,
            password: '123456',
            role: 'student',
            displayName: s.name,
            studentId: sId,
            team: s.team,
        };
    }
    data.accounts = teacherAccounts;

    saveToFile(data);
    console.log('--- File Store: Reset Complete ---');
}

// Helper to generate base username consistent with lib/utils.ts
function generateBaseUsername(name: string): string {
    const noAccents = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
    return 'hs_' + noAccents;
}
