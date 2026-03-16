"use client"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Settings, ShieldAlert, BookOpen, Database, ChevronRight, UserCheck, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { AlertTriangle } from 'lucide-react'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { can } = useAuth()

    const navItems = [
        { name: 'Thông tin chung', href: '/settings/general', icon: Settings },
        { name: 'Danh sách lớp', href: '/settings/students', icon: Users },
        { name: 'Danh mục nề nếp', href: '/settings/incidents', icon: ShieldAlert },
        { name: 'Chức vụ', href: '/settings/positions', icon: UserCheck },
        { name: 'Môn học', href: '/settings/subjects', icon: BookOpen },
        { name: 'Dữ liệu', href: '/settings/data', icon: Database },
    ]

    // Block non-teachers at the layout level for all settings
    if (!can('view_settings')) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-400 mb-3" />
                <p className="text-slate-500 text-lg font-medium">Chỉ GVCN mới có quyền truy cập Cài đặt</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Cài đặt</h1>
                <p className="text-slate-500 text-sm mt-1">Quản lý toàn bộ thông tin hệ thống</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar Navigation */}
                <Card className="w-full md:w-64 shrink-0 h-fit animate-slide-up border-slate-200">
                    <CardContent className="p-3 space-y-1">
                        {navItems.map(item => {
                            const active = pathname.includes(item.href)
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        {item.name}
                                    </div>
                                    {active && <ChevronRight className="h-4 w-4 text-indigo-400" />}
                                </Link>
                            )
                        })}
                    </CardContent>
                </Card>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    )
}
