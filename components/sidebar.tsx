"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, PlusCircle, FileText, Settings, X, BookOpen, ClipboardCheck, LogOut, Key, Check, AlertCircle, PanelLeftClose, PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { changePassword } from "@/lib/auth"
import { getClassInfo } from "@/lib/storage"
import { ROLE_LABELS, ROLE_SHORT_LABELS, UserRole, ClassInfo } from "@/types"

interface NavItem {
    name: string
    href: string
    icon: typeof Home
    requiredRoles?: UserRole[] // If empty, all roles can see
}

const navigation: NavItem[] = [
    { name: 'Tổng quan', href: '/', icon: Home },
    { name: 'Danh sách lớp', href: '/students', icon: Users },
    { name: 'Chấm nề nếp', href: '/log', icon: PlusCircle, requiredRoles: ['team_leader', 'class_leader', 'teacher'] },
    { name: 'Điểm danh', href: '/attendance', icon: ClipboardCheck, requiredRoles: ['team_leader', 'class_leader', 'teacher'] },
    { name: 'Báo cáo', href: '/report', icon: FileText },
    { name: 'Cài đặt', href: '/settings', icon: Settings, requiredRoles: ['teacher'] },
]

interface SidebarProps {
    mobile?: boolean
    onClose?: () => void
}

export function Sidebar({ mobile, onClose }: SidebarProps) {
    const pathname = usePathname()
    const { user, logout } = useAuth()

    // Sidebar state
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Change password dialog state
    const [showChangePw, setShowChangePw] = useState(false)
    const [oldPw, setOldPw] = useState('')
    const [newPw, setNewPw] = useState('')
    const [confirmPw, setConfirmPw] = useState('')
    const [pwError, setPwError] = useState('')
    const [pwSuccess, setPwSuccess] = useState(false)

    // Class Info state
    const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)

    const userRole = user?.role ?? 'student'

    useEffect(() => {
        getClassInfo().then(info => setClassInfo(info)).catch(() => { })
    }, [])

    // Filter navigation items based on user role
    const visibleNav = navigation.filter(item => {
        if (!item.requiredRoles) return true
        return item.requiredRoles.includes(userRole)
    })

    const handleLogout = () => {
        logout()
        window.location.href = '/login'
    }

    const handleChangePassword = () => {
        setPwError('')
        setPwSuccess(false)
        if (!oldPw || !newPw || !confirmPw) {
            setPwError('Vui lòng nhập đầy đủ thông tin')
            return
        }
        if (newPw.length < 4) {
            setPwError('Mật khẩu mới phải có ít nhất 4 ký tự')
            return
        }
        if (newPw !== confirmPw) {
            setPwError('Mật khẩu xác nhận không khớp')
            return
        }
        if (!user) return
        const ok = changePassword(user.id, oldPw, newPw)
        if (!ok) {
            setPwError('Mật khẩu hiện tại không đúng')
            return
        }
        setPwSuccess(true)
        setTimeout(() => {
            setShowChangePw(false)
            setOldPw('')
            setNewPw('')
            setConfirmPw('')
            setPwSuccess(false)
        }, 1500)
    }

    const openChangePw = () => {
        setOldPw('')
        setNewPw('')
        setConfirmPw('')
        setPwError('')
        setPwSuccess(false)
        setShowChangePw(true)
    }

    // Role badge colors
    const roleBadgeColors: Record<UserRole, string> = {
        teacher: 'from-emerald-400 to-teal-500',
        class_leader: 'from-indigo-400 to-purple-500',
        team_leader: 'from-amber-400 to-orange-500',
        student: 'from-slate-400 to-slate-500',
    }

    const sidebarRef = useRef<HTMLDivElement>(null)

    // Handle click outside to collapse
    useEffect(() => {
        if (isCollapsed) return

        function handleClickOutside(event: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                // If clicked outside the sidebar, collapse it
                setIsCollapsed(true)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isCollapsed])

    return (
        <div
            ref={sidebarRef}
            onMouseEnter={() => !mobile && setIsCollapsed(false)}
            className={cn(
                "flex h-screen flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out z-40 relative shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)]",
                isCollapsed ? "w-[72px]" : "w-72",
                mobile ? "fixed inset-y-0 left-0" : ""
            )}
        >
            {/* Toggle Button (Desktop only) */}
            {!mobile && (
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-6 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-full p-1 shadow-sm z-50 transition-colors"
                >
                    {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
            )}

            {/* Logo / Brand */}
            <div className={cn("flex h-16 items-center px-4 border-b border-slate-100", isCollapsed ? "justify-center" : "justify-between")}>
                <div className="flex items-center gap-3 overflow-hidden">
                    {classInfo?.logo ? (
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 p-0.5 shadow-sm flex items-center justify-center shrink-0">
                            <img src={classInfo.logo} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-sm">
                            <BookOpen className="h-5 w-5 text-white" />
                        </div>
                    )}
                    {!isCollapsed && (
                        <div className="flex flex-col min-w-0 animate-fade-in py-1">
                            <span className="text-base font-bold tracking-normal bg-gradient-to-r from-indigo-700 to-cyan-700 bg-clip-text text-transparent truncate leading-normal uppercase pb-1">
                                SỔ NỀ NẾP ĐIỆN TỬ
                            </span>
                            {classInfo?.name && (
                                <p className="text-[11px] text-slate-500 font-medium tracking-wide leading-tight uppercase truncate">
                                    LỚP {classInfo.name}
                                </p>
                            )}
                        </div>
                    )}
                </div>
                {mobile && (
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0">
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 px-3 py-4 overflow-y-auto">
                {visibleNav.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={mobile ? onClose : undefined}
                            title={isCollapsed ? item.name : undefined}
                            className={cn(
                                "group flex items-center transition-all duration-200",
                                isCollapsed
                                    ? "justify-center"
                                    : "px-3 py-3 rounded-xl hover:bg-slate-50",
                                !isCollapsed && isActive && "bg-indigo-50/60"
                            )}
                        >
                            <div className={cn(
                                "flex items-center justify-center transition-all duration-300",
                                isCollapsed ? "h-12 w-12 rounded-2xl" : "mr-3 h-8 w-8 rounded-lg",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                    : "bg-slate-50/80 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-700"
                            )}>
                                <item.icon className={cn("transition-transform", isCollapsed ? "h-5 w-5 group-hover:scale-110" : "h-4 w-4")} />
                            </div>

                            {!isCollapsed && (
                                <span className={cn(
                                    "text-[13px] tracking-wide font-medium",
                                    isActive ? "text-indigo-700 font-semibold" : "text-slate-600"
                                )}>
                                    {item.name}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer: User Info + Actions */}
            <div className="border-t border-slate-100 p-3 bg-slate-50/50">
                {!isCollapsed ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 px-1">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleBadgeColors[userRole]} flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0`}>
                                {ROLE_SHORT_LABELS[userRole]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-700 truncate">{user?.displayName || 'Người dùng'}</p>
                                <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[userRole]}</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                onClick={openChangePw}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
                            >
                                <Key className="h-3.5 w-3.5" />
                                Đổi MK
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Thoát
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 py-1">
                        <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleBadgeColors[userRole]} flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-help`}
                            title={`${user?.displayName} - ${ROLE_LABELS[userRole]}`}
                        >
                            {ROLE_SHORT_LABELS[userRole]}
                        </div>
                        <button
                            onClick={openChangePw}
                            title="Đổi mật khẩu"
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                        >
                            <Key className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleLogout}
                            title="Đăng xuất"
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-rose-50 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Change Password Dialog */}
            {showChangePw && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowChangePw(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Key className="h-5 w-5 text-indigo-500" />
                                Đổi mật khẩu
                            </h3>
                            <button onClick={() => setShowChangePw(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {pwSuccess ? (
                            <div className="flex flex-col items-center py-6 text-center animate-fade-in">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                    <Check className="h-6 w-6 text-emerald-600" />
                                </div>
                                <p className="text-sm font-medium text-emerald-700">Đổi mật khẩu thành công!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Mật khẩu hiện tại</label>
                                    <input
                                        type="password"
                                        value={oldPw}
                                        onChange={e => { setOldPw(e.target.value); setPwError('') }}
                                        className="input-field"
                                        placeholder="••••••"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Mật khẩu mới</label>
                                    <input
                                        type="password"
                                        value={newPw}
                                        onChange={e => { setNewPw(e.target.value); setPwError('') }}
                                        className="input-field"
                                        placeholder="Ít nhất 4 ký tự"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Xác nhận mật khẩu mới</label>
                                    <input
                                        type="password"
                                        value={confirmPw}
                                        onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
                                        className="input-field"
                                        placeholder="Nhập lại mật khẩu mới"
                                    />
                                </div>
                                {pwError && (
                                    <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2 animate-fade-in">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                        {pwError}
                                    </div>
                                )}
                                <button
                                    onClick={handleChangePassword}
                                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                                >
                                    Xác nhận đổi mật khẩu
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
