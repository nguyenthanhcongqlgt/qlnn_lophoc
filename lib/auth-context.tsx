"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserAccount, UserRole, AuthSession } from '@/types'
import { login as authLogin, logout as authLogout, getCurrentSession, hasPermission, getAccounts } from '@/lib/auth'
import { initializeData, getClassInfo, getPositions, getStudentsWithScores } from '@/lib/storage'

type Action = Parameters<typeof hasPermission>[1]

interface AuthContextType {
    user: UserAccount | null
    loading: boolean
    login: (username: string, password: string) => Promise<boolean>
    logout: () => void
    can: (action: Action) => boolean
    isRole: (...roles: UserRole[]) => boolean
    authorizedStudents: string[]
}

const AuthContext = createContext<AuthContextType | null>(null)

// Quyền bổ sung cho học sinh có chức vụ được phép lập phiếu
const CAN_CREATE_LOG_ACTIONS: Action[] = [
    'view_log', 'create_log',
    'view_attendance', 'mark_attendance',
]

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserAccount | null>(null)
    const [loading, setLoading] = useState(true)
    const [authorizedStudents, setAuthorizedStudents] = useState<string[]>([])

    useEffect(() => {
        initializeData()

        const session = getCurrentSession()
        if (session) {
            // Luôn re-resolve canCreateLog từ position hiện tại
            // (cần thiết vì memory-store reset sau mỗi lần restart, vị position tự thêm sẽ mất)
            if (session.user.role === 'student') {
                Promise.all([getAccounts(), getPositions(), getStudentsWithScores()]).then(async ([accounts, positions, allStudents]) => {
                    const freshUser = accounts.find(a => a.id === session.user.id) || session.user
                    let canCreateLog = false
                    let positionName: string | undefined = undefined;
                    if (freshUser.studentId) {
                        const student = allStudents.find(s => s.id === freshUser.studentId)
                        positionName = student?.position || undefined;
                        const pos = positions.find(p => p.name === student?.position)
                        canCreateLog = pos?.canCreateLog ?? false
                    }
                    setUser({ ...freshUser, canCreateLog, positionName })
                    setLoading(false)
                }).catch(() => {
                    setUser(session.user)
                    setLoading(false)
                })
            } else {
                getAccounts().then(accounts => {
                    const freshUser = accounts.find(a => a.id === session.user.id)
                    setUser(freshUser ? { ...freshUser, canCreateLog: session.user.canCreateLog, positionName: session.user.positionName } : session.user)
                    setLoading(false)
                }).catch(() => {
                    setUser(session.user)
                    setLoading(false)
                })
            }
        } else {
            setLoading(false)
        }

        getClassInfo().then(info => {
            setAuthorizedStudents(info.authorizedStudents || [])
        }).catch(() => { })
    }, [])

    const handleLogin = async (username: string, password: string): Promise<boolean> => {
        const session = await authLogin(username, password)
        if (!session) return false

        // Với học sinh, resolve canCreateLog ngay khi login
        if (session.user.role === 'student') {
            try {
                const [positions, allStudents] = await Promise.all([getPositions(), getStudentsWithScores()])
                const student = allStudents.find(s => s.id === session.user.studentId)
                const positionName = student?.position || undefined;
                const pos = positions.find(p => p.name === student?.position)
                const canCreateLog = pos?.canCreateLog ?? false
                setUser({ ...session.user, canCreateLog, positionName })
            } catch {
                setUser(session.user)
            }
        } else {
            setUser(session.user)
        }
        return true
    }

    const handleLogout = () => {
        authLogout()
        setUser(null)
    }

    const can = (action: Action): boolean => {
        if (!user) return false

        // Học sinh có chức vụ được phép lập phiếu → cấp thêm quyền
        if (user.role === 'student' && user.canCreateLog === true) {
            if (CAN_CREATE_LOG_ACTIONS.includes(action)) return true
        }

        return hasPermission(user.role, action)
    }

    const isRole = (...roles: UserRole[]): boolean => {
        if (!user) return false
        return roles.includes(user.role)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login: handleLogin, logout: handleLogout, can, isRole, authorizedStudents }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
