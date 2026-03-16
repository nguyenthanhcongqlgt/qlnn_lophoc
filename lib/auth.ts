// ===== Authentication & Authorization (API-based) =====

import { UserAccount, UserRole, AuthSession } from '@/types';

const SESSION_KEY = 'nenep_session';

// ── Session (still localStorage — just the session token) ──

function getSessionFromStorage(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
        return null;
    }
}

function saveSessionToStorage(session: AuthSession): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ── Account operations (via API) ──

export async function getAccounts(): Promise<UserAccount[]> {
    try {
        const res = await fetch('/api/auth');
        return await res.json();
    } catch {
        return [];
    }
}

export async function updateAccount(id: string, updates: Partial<UserAccount>): Promise<void> {
    if (updates.role) {
        await fetch('/api/auth', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateRole', id, role: updates.role }),
        });
    }
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
    await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resetPassword', id, password: newPassword }),
    });
}

export async function changePassword(id: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePassword', id, oldPassword, newPassword }),
    });
    return res.ok;
}

export async function changeUsername(id: string, newUsername: string): Promise<boolean> {
    const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changeUsername', id, newUsername }),
    });
    return res.ok;
}

export async function changeAvatar(id: string, avatar: string | null): Promise<boolean> {
    const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changeAvatar', id, avatar }),
    });
    return res.ok;
}

// ── Session management ──

export async function login(username: string, password: string): Promise<AuthSession | null> {
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username, password }),
        });
        if (!res.ok) return null;

        const data = await res.json();
        const session: AuthSession = {
            user: data.user,
            loggedInAt: new Date().toISOString(),
        };
        saveSessionToStorage(session);
        return session;
    } catch {
        return null;
    }
}

export function logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
}

export function getCurrentSession(): AuthSession | null {
    return getSessionFromStorage();
}

// ── Permission checks (unchanged) ──

type Action =
    | 'view_dashboard'
    | 'view_students'
    | 'add_student'
    | 'edit_student'
    | 'delete_student'
    | 'view_log'
    | 'create_log'
    | 'edit_log'
    | 'delete_log'
    | 'view_attendance'
    | 'mark_attendance'
    | 'view_report'
    | 'export_report'
    | 'print_report'
    | 'view_settings'
    | 'manage_accounts';

const PERMISSIONS: Record<UserRole, Action[]> = {
    student: ['view_dashboard', 'view_students', 'view_report'],
    team_leader: [
        'view_dashboard', 'view_students',
        'view_log', 'create_log',
        'view_attendance', 'mark_attendance',
        'view_report',
    ],
    class_leader: [
        'view_dashboard', 'view_students',
        'view_log', 'create_log',
        'view_attendance', 'mark_attendance',
        'view_report', 'export_report', 'print_report',
    ],
    teacher: [
        'view_dashboard', 'view_students', 'add_student', 'edit_student', 'delete_student',
        'view_log', 'create_log', 'edit_log', 'delete_log',
        'view_attendance', 'mark_attendance',
        'view_report', 'export_report', 'print_report',
        'view_settings', 'manage_accounts',
    ],
};

export function hasPermission(role: UserRole, action: Action): boolean {
    return PERMISSIONS[role]?.includes(action) ?? false;
}

// ── Initialize accounts (no-op — seed data is in schema.sql) ──

export function initializeAccounts(): void {
    // Accounts are seeded by schema.sql — nothing to do here
}
