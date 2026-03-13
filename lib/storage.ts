// ===== API-based storage helpers (replaces localStorage) =====

import { Student, LogEntry, IncidentType, ClassInfo, StudentWithScore, GradeThresholds, DEFAULT_GRADE_THRESHOLDS, AttendanceRecord, Semester } from '@/types';

// ── Client-side Cache ──
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 30_000; // 30 seconds

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (entry && Date.now() < entry.expiry) return entry.data;
    cache.delete(key);
    return null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export function invalidateCache(key?: string) {
    if (key) cache.delete(key);
    else cache.clear();
}

// ── Students ──

export async function getStudents(): Promise<Student[]> {
    const cached = getCached<Student[]>('students');
    if (cached) return cached;
    try {
        const res = await fetch('/api/students', { cache: 'no-store' });
        const data = await res.json();
        setCache('students', data);
        return data;
    } catch {
        return [];
    }
}

export async function addStudent(student: Omit<Student, 'id'>): Promise<Student> {
    invalidateCache('students');
    invalidateCache('studentsWithScores');
    const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
    });
    return await res.json();
}

export async function updateStudent(id: string, data: Partial<Omit<Student, 'id'>>): Promise<void> {
    invalidateCache('students');
    invalidateCache('studentsWithScores');
    await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
    });
}

export async function deleteStudent(id: string): Promise<void> {
    invalidateCache('students');
    invalidateCache('studentsWithScores');
    invalidateCache('logs');
    invalidateCache('attendance');
    await fetch(`/api/students?id=${id}`, { method: 'DELETE' });
}

export async function deleteAllStudents(): Promise<void> {
    invalidateCache();
    await fetch(`/api/students?deleteAll=true`, { method: 'DELETE' });
}

// ── Log Entries ──

export async function getLogs(): Promise<LogEntry[]> {
    const cached = getCached<LogEntry[]>('logs');
    if (cached) return cached;
    try {
        const res = await fetch('/api/logs', { cache: 'no-store' });
        const data = await res.json();
        setCache('logs', data);
        return data;
    } catch {
        return [];
    }
}

export async function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry> {
    invalidateCache('logs');
    invalidateCache('studentsWithScores');
    const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
    });
    return await res.json();
}

export async function deleteLog(id: string): Promise<void> {
    invalidateCache('logs');
    invalidateCache('studentsWithScores');
    await fetch(`/api/logs?id=${id}`, { method: 'DELETE' });
}

export async function updateLog(id: string, data: Partial<Omit<LogEntry, 'id' | 'timestamp'>>): Promise<void> {
    invalidateCache('logs');
    invalidateCache('studentsWithScores');
    await fetch('/api/logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
    });
}

// ── Incident Types (Violations / Achievements) ──

export async function getViolationTypes(): Promise<IncidentType[]> {
    const cached = getCached<IncidentType[]>('violationTypes');
    if (cached) return cached;
    try {
        const res = await fetch('/api/incidents?type=violation', { cache: 'no-store' });
        const data = await res.json();
        setCache('violationTypes', data);
        return data;
    } catch {
        return [];
    }
}

export async function getAchievementTypes(): Promise<IncidentType[]> {
    const cached = getCached<IncidentType[]>('achievementTypes');
    if (cached) return cached;
    try {
        const res = await fetch('/api/incidents?type=achievement', { cache: 'no-store' });
        const data = await res.json();
        setCache('achievementTypes', data);
        return data;
    } catch {
        return [];
    }
}

export async function saveViolationTypes(types: IncidentType[]): Promise<void> {
    invalidateCache('violationTypes');
    await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'violation',
            items: types,
        }),
    });
}

export async function saveAchievementTypes(types: IncidentType[]): Promise<void> {
    invalidateCache('achievementTypes');
    await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'achievement',
            items: types,
        }),
    });
}

export async function addIncidentType(item: IncidentType): Promise<void> {
    invalidateCache(item.type === 'violation' ? 'violationTypes' : 'achievementTypes');
    await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
    });
}

export async function updateIncidentType(id: string, content: string, point: number): Promise<void> {
    invalidateCache('violationTypes');
    invalidateCache('achievementTypes');
    await fetch('/api/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content, point }),
    });
}

export async function deleteIncidentType(id: string): Promise<void> {
    invalidateCache('violationTypes');
    invalidateCache('achievementTypes');
    await fetch(`/api/incidents?id=${id}`, { method: 'DELETE' });
}

export async function deleteIncidentTypesByType(type: 'violation' | 'achievement'): Promise<void> {
    invalidateCache(type === 'violation' ? 'violationTypes' : 'achievementTypes');
    await fetch(`/api/incidents?type=${type}&deleteAll=true`, { method: 'DELETE' });
}

// ── Subjects (Môn học) ──

export async function getSubjects(): Promise<{ id: string, name: string }[]> {
    const cached = getCached<{ id: string, name: string }[]>('subjects');
    if (cached) return cached;
    try {
        const res = await fetch('/api/subjects', { cache: 'no-store' });
        const data = await res.json();
        setCache('subjects', data);
        return data;
    } catch {
        return [];
    }
}

export async function addSubject(id: string, name: string): Promise<void> {
    invalidateCache('subjects');
    await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
    });
}

export async function updateSubject(id: string, name: string): Promise<void> {
    invalidateCache('subjects');
    await fetch('/api/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
    });
}

export async function deleteSubject(id: string): Promise<void> {
    invalidateCache('subjects');
    await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
}

// ── Class Info ──

export async function getClassInfo(): Promise<ClassInfo> {
    const cached = getCached<ClassInfo>('classInfo');
    if (cached) return cached;
    try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const data = await res.json();
        const result = data.classInfo || { schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [] };
        setCache('classInfo', result);
        return result;
    } catch {
        return { schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [] };
    }
}

export async function saveClassInfo(info: ClassInfo): Promise<void> {
    invalidateCache('classInfo');
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'classInfo', data: info }),
    });
}

// ── Grade Thresholds ──

export async function getGradeThresholds(): Promise<GradeThresholds> {
    const cached = getCached<GradeThresholds>('thresholds');
    if (cached) return cached;
    try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const data = await res.json();
        const result = data.thresholds || DEFAULT_GRADE_THRESHOLDS;
        setCache('thresholds', result);
        return result;
    } catch {
        return DEFAULT_GRADE_THRESHOLDS;
    }
}

export async function saveGradeThresholds(thresholds: GradeThresholds): Promise<void> {
    invalidateCache('thresholds');
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'thresholds', data: thresholds }),
    });
}

// ── Attendance ──

export async function getAttendance(): Promise<AttendanceRecord[]> {
    const cached = getCached<AttendanceRecord[]>('attendance');
    if (cached) return cached;
    try {
        const res = await fetch('/api/attendance', { cache: 'no-store' });
        const data = await res.json();
        setCache('attendance', data);
        return data;
    } catch {
        return [];
    }
}

export async function setAttendanceForDate(
    studentId: string,
    date: string,
    status: AttendanceRecord['status'],
    note?: string,
    session: 'morning' | 'afternoon' = 'morning'
): Promise<void> {
    invalidateCache('attendance');
    await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, session, status, note }),
    });
}

// ── Student Notes ──

export async function saveStudentNote(studentId: string, note: string): Promise<void> {
    await updateStudent(studentId, { note });
}

export async function resetStudentPassword(studentId: string): Promise<void> {
    await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', id: studentId }),
    });
}

export async function updateStudentStatus(studentId: string, status: 'active' | 'dropped_out', dropoutDate?: string): Promise<void> {
    invalidateCache('students');
    invalidateCache('studentsWithScores');
    await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id: studentId, status, dropoutDate }),
    });
}

// ── Computed: Students with scores ──

export async function getStudentsWithScores(): Promise<StudentWithScore[]> {
    const cached = getCached<StudentWithScore[]>('studentsWithScores');
    if (cached) return cached;

    const [students, logs] = await Promise.all([getStudents(), getLogs()]);

    const result = students.map(student => {
        const studentLogs = logs.filter(l => l.studentId === student.id && (l.status === 'approved' || l.status === undefined));
        const totalPoints = studentLogs.reduce((sum, l) => sum + l.point, 0);
        const violationCount = studentLogs.filter(l => l.type === 'violation').length;
        const achievementCount = studentLogs.filter(l => l.type === 'achievement').length;

        return {
            ...student,
            currentScore: student.initialScore + totalPoints,
            violationCount,
            achievementCount,
        };
    });

    setCache('studentsWithScores', result);
    return result;
}

// ── Initialization (no-op — seed data is in schema.sql) ──

export function initializeData(): void {
    // Data is seeded by schema.sql — nothing to do here
}

// ── Reset all data ──

export async function resetAllData(): Promise<void> {
    invalidateCache();
    const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'resetAllData' }),
    });
    if (!res.ok) throw new Error('API resetAllData failed');
}

// ── New School Year ──

export async function createNewSchoolYear(schoolYear: string): Promise<void> {
    invalidateCache();
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'newSchoolYear', data: { schoolYear } }),
    });
}

// ── Positions (Chức vụ) ──

export async function getPositions(): Promise<{ id: string; name: string; canCreateLog: boolean }[]> {
    const cached = getCached<{ id: string; name: string; canCreateLog: boolean }[]>('positions');
    if (cached) return cached;
    try {
        const res = await fetch('/api/positions', { cache: 'no-store' });
        const data = await res.json();
        setCache('positions', data);
        return data;
    } catch {
        return [];
    }
}

export async function addPosition(id: string, name: string, canCreateLog: boolean): Promise<void> {
    invalidateCache('positions');
    await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, canCreateLog }),
    });
}

export async function updatePosition(id: string, name: string, canCreateLog: boolean): Promise<void> {
    invalidateCache('positions');
    await fetch('/api/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, canCreateLog }),
    });
}

export async function deletePosition(id: string): Promise<void> {
    invalidateCache('positions');
    await fetch(`/api/positions?id=${id}`, { method: 'DELETE' });
}

// ── Batch Import ──

export async function importStudents(batch: Omit<Student, 'note'>[]): Promise<Student[]> {
    invalidateCache('students');
    invalidateCache('studentsWithScores');
    const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
    });
    return await res.json();
}

export async function importIncidentTypes(batch: IncidentType[]): Promise<IncidentType[]> {
    invalidateCache('violationTypes');
    invalidateCache('achievementTypes');
    const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
    });
    return await res.json();
}
