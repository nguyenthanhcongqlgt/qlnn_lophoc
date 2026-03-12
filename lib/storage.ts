// ===== API-based storage helpers (replaces localStorage) =====

import { Student, LogEntry, IncidentType, ClassInfo, StudentWithScore, GradeThresholds, DEFAULT_GRADE_THRESHOLDS, AttendanceRecord, Semester } from '@/types';

// ── Students ──

export async function getStudents(): Promise<Student[]> {
    try {
        const res = await fetch('/api/students', { cache: 'no-store' });
        return await res.json();
    } catch {
        return [];
    }
}

export async function addStudent(student: Omit<Student, 'id'>): Promise<Student> {
    const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
    });
    return await res.json();
}

export async function updateStudent(id: string, data: Partial<Omit<Student, 'id'>>): Promise<void> {
    await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
    });
}

export async function deleteStudent(id: string): Promise<void> {
    await fetch(`/api/students?id=${id}`, { method: 'DELETE' });
}

export async function deleteAllStudents(): Promise<void> {
    await fetch(`/api/students?deleteAll=true`, { method: 'DELETE' });
}

// ── Log Entries ──

export async function getLogs(): Promise<LogEntry[]> {
    try {
        const res = await fetch('/api/logs', { cache: 'no-store' });
        return await res.json();
    } catch {
        return [];
    }
}

export async function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry> {
    const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
    });
    return await res.json();
}

export async function deleteLog(id: string): Promise<void> {
    await fetch(`/api/logs?id=${id}`, { method: 'DELETE' });
}

export async function updateLog(id: string, data: Partial<Omit<LogEntry, 'id' | 'timestamp'>>): Promise<void> {
    await fetch('/api/logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
    });
}

// ── Incident Types (Violations / Achievements) ──

export async function getViolationTypes(): Promise<IncidentType[]> {
    try {
        const res = await fetch('/api/incidents?type=violation', { cache: 'no-store' });
        return await res.json();
    } catch {
        return [];
    }
}

export async function getAchievementTypes(): Promise<IncidentType[]> {
    try {
        const res = await fetch('/api/incidents?type=achievement', { cache: 'no-store' });
        return await res.json();
    } catch {
        return [];
    }
}

export async function saveViolationTypes(types: IncidentType[]): Promise<void> {
    // Delete all existing violations and re-insert
    const existing = await getViolationTypes();
    for (const t of existing) {
        await fetch(`/api/incidents?id=${t.id}`, { method: 'DELETE' });
    }
    for (const t of types) {
        await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t),
        });
    }
}

export async function saveAchievementTypes(types: IncidentType[]): Promise<void> {
    const existing = await getAchievementTypes();
    for (const t of existing) {
        await fetch(`/api/incidents?id=${t.id}`, { method: 'DELETE' });
    }
    for (const t of types) {
        await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t),
        });
    }
}

export async function addIncidentType(item: IncidentType): Promise<void> {
    await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
    });
}

export async function updateIncidentType(id: string, content: string, point: number): Promise<void> {
    await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content, point }),
    });
}

export async function deleteIncidentType(id: string): Promise<void> {
    await fetch(`/api/incidents?id=${id}`, { method: 'DELETE' });
}

export async function deleteIncidentTypesByType(type: 'violation' | 'achievement'): Promise<void> {
    await fetch(`/api/incidents?deleteAllByType=${type}`, { method: 'DELETE' });
}

// ── Subjects (Môn học) ──

export async function getSubjects(): Promise<{ id: string, name: string }[]> {
    try {
        const res = await fetch('/api/subjects', { cache: 'no-store' });
        return await res.json();
    } catch {
        return [];
    }
}

export async function addSubject(id: string, name: string): Promise<void> {
    await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
    });
}

export async function updateSubject(id: string, name: string): Promise<void> {
    await fetch('/api/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
    });
}

export async function deleteSubject(id: string): Promise<void> {
    const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
    }
}

// ── Class Info ──

export async function getClassInfo(): Promise<ClassInfo> {
    try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const data = await res.json();
        return data.classInfo || { schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [] };
    } catch {
        return { schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [] };
    }
}

export async function saveClassInfo(info: ClassInfo): Promise<void> {
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'classInfo', data: info }),
    });
}

// ── Grade Thresholds ──

export async function getGradeThresholds(): Promise<GradeThresholds> {
    try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const data = await res.json();
        return data.thresholds || DEFAULT_GRADE_THRESHOLDS;
    } catch {
        return DEFAULT_GRADE_THRESHOLDS;
    }
}

export async function saveGradeThresholds(thresholds: GradeThresholds): Promise<void> {
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'thresholds', data: thresholds }),
    });
}

// ── Attendance ──

export async function getAttendance(): Promise<AttendanceRecord[]> {
    try {
        const res = await fetch('/api/attendance', { cache: 'no-store' });
        return await res.json();
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
    await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id: studentId, status, dropoutDate }),
    });
}

// ── Computed: Students with scores ──

export async function getStudentsWithScores(): Promise<StudentWithScore[]> {
    const [students, logs] = await Promise.all([getStudents(), getLogs()]);

    return students.map(student => {
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
}

// ── Initialization (no-op — seed data is in schema.sql) ──

export function initializeData(): void {
    // Data is seeded by schema.sql — nothing to do here
}

// ── Reset all data ──

export async function resetAllData(): Promise<void> {
    const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'resetAllData' }),
    });
    if (!res.ok) throw new Error('API resetAllData failed');
}

// ── New School Year ──

export async function createNewSchoolYear(schoolYear: string): Promise<void> {
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'newSchoolYear', data: { schoolYear } }),
    });
}

// ── Positions (Chức vụ) ──

export async function getPositions(): Promise<{ id: string; name: string; canCreateLog: boolean }[]> {
    try {
        const res = await fetch('/api/positions', { cache: 'no-store' });
        return await res.json();
    } catch {
        return [];
    }
}

export async function addPosition(id: string, name: string, canCreateLog: boolean): Promise<void> {
    await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, canCreateLog }),
    });
}

export async function updatePosition(id: string, name: string, canCreateLog: boolean): Promise<void> {
    await fetch('/api/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, canCreateLog }),
    });
}

export async function deletePosition(id: string): Promise<void> {
    await fetch(`/api/positions?id=${id}`, { method: 'DELETE' });
}

// ── Batch Import ──

export async function importStudents(batch: Omit<Student, 'note'>[]): Promise<Student[]> {
    const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
    });
    return await res.json();
}

export async function importIncidentTypes(batch: IncidentType[]): Promise<IncidentType[]> {
    const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
    });
    return await res.json();
}
