"use client"

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { Menu, BookOpen } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { getClassInfo } from '@/lib/storage'
import { ClassInfo } from '@/types'

const inter = Inter({
    subsets: ['latin', 'vietnamese'],
    display: 'swap',
    variable: '--font-inter',
})

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="vi" suppressHydrationWarning>
            <head>
                <title>Sổ Nề Nếp Điện Tử</title>
                <meta name="description" content="Hệ thống quản lý nề nếp học sinh dành cho giáo viên chủ nhiệm" />
            </head>
            <body className={inter.variable} suppressHydrationWarning>
                <AuthProvider>
                    <LayoutShell>{children}</LayoutShell>
                </AuthProvider>
            </body>
        </html>
    )
}

function LayoutShell({ children }: { children: React.ReactNode }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const { user, loading } = useAuth()
    const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)

    useEffect(() => {
        if (user) {
            getClassInfo().then(info => setClassInfo(info)).catch(() => { })
        }
    }, [user])

    // Show loading spinner while auth is initializing
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ background: '#f1f5f9' }}>
                <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        )
    }

    // Login page — no sidebar, no header
    if (pathname === '/login') {
        return <>{children}</>
    }

    // Not logged in — redirect to login
    if (!user) {
        return (
            <meta httpEquiv="refresh" content="0;url=/login" />
        )
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#f1f5f9' }}>
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <>
                    <div className="sidebar-overlay lg:hidden" onClick={() => setMobileMenuOpen(false)} />
                    <div className="lg:hidden">
                        <Sidebar mobile onClose={() => setMobileMenuOpen(false)} />
                    </div>
                </>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden flex h-14 items-center gap-3 border-b bg-white px-4 shadow-sm z-40 sticky top-0 print:hidden">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {classInfo?.logo ? (
                            <div className="w-7 h-7 rounded-md bg-white p-0.5 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                <img src={classInfo.logo} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                        ) : (
                            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0">
                                <BookOpen className="h-4 w-4 text-white" />
                            </div>
                        )}
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold bg-gradient-to-r from-indigo-700 to-cyan-700 bg-clip-text text-transparent truncate leading-tight uppercase">
                                SỔ NỀ NẾP ĐIỆN TỬ
                            </span>
                            {classInfo?.name && (
                                <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase leading-tight truncate">
                                    LỚP {classInfo.name}
                                </p>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
