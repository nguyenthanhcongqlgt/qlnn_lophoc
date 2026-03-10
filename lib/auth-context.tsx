"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserAccount, UserRole, AuthSession } from '@/types'
import { login as authLogin, logout as authLogout, getCurrentSession, hasPermission, getAccounts } from '@/lib/auth'
import { initializeData, getClassInfo } from '@/lib/storage'

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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserAccount | null>(null)
    const [loading, setLoading] = useState(true)
    const [authorizedStudents, setAuthorizedStudents] = useState<string[]>([])

    useEffect(() => {
        // Initialize (no-op for DB version — data is seeded by schema.sql)
        initializeData()

        // Restore session from localStorage
        const session = getCurrentSession()
        if (session) {
            // Refresh user data from API
            getAccounts().then(accounts => {
                const freshUser = accounts.find(a => a.id === session.user.id)
                setUser(freshUser || session.user)
                setLoading(false)
            }).catch(() => {
                setUser(session.user)
                setLoading(false)
            })
        } else {
            setLoading(false)
        }

        // Fetch authorized students for permissions
        getClassInfo().then(info => {
            setAuthorizedStudents(info.authorizedStudents || [])
        }).catch(() => { })
    }, [])

    const handleLogin = async (username: string, password: string): Promise<boolean> => {
        const session = await authLogin(username, password)
        if (session) {
            setUser(session.user)
            return true
        }
        return false
    }

    const handleLogout = () => {
        authLogout()
        setUser(null)
    }

    const can = (action: Action): boolean => {
        if (!user) return false
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
