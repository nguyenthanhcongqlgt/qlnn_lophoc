"use client"

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
    initializeData, getStudents, getAttendance, setAttendanceForDate
} from '@/lib/storage'
import { Student, AttendanceRecord, AttendanceStatus, AttendanceSession, ATTENDANCE_SESSION_LABELS } from '@/types'
import { ClipboardCheck, Calendar, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, AlertTriangle, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { format, parseISO } from 'date-fns'

function formatDate(dateString: string): string {
    if (!dateString) return ''
    try {
        return format(parseISO(dateString), 'dd/MM/yyyy')
    } catch {
        return dateString
    }
}

export default function AttendancePage() {
    const [students, setStudents] = useState<Student[]>([])
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [session, setSession] = useState<AttendanceSession>('morning')
    const [ready, setReady] = useState(false)

    const { showToast, ToastComponent } = useToast()
    const { user, can } = useAuth()

    useEffect(() => {
        initializeData()
        refresh()
    }, [])

    const refresh = async () => {
        const [studentsData, attendanceData] = await Promise.all([
            getStudents(),
            getAttendance(),
        ])
        setStudents(studentsData.filter(s => s.status !== 'dropped_out'))
        setAttendance(attendanceData)
        setReady(true)
    }

    // Get attendance map for current date + session
    const attendanceMap = useMemo(() => {
        const map = new Map<string, AttendanceStatus>()
        attendance
            .filter(r => r.date === date && (r.session || 'morning') === session)
            .forEach(r => map.set(r.studentId, r.status))
        return map
    }, [attendance, date, session])

    const getStatus = (studentId: string): AttendanceStatus => {
        return attendanceMap.get(studentId) || 'present'
    }

    const cycleStatus = async (studentId: string) => {
        const current = getStatus(studentId)
        let next: AttendanceStatus
        switch (current) {
            case 'present': next = 'absent_excused'; break
            case 'absent_excused': next = 'absent_unexcused'; break
            case 'absent_unexcused': next = 'present'; break
        }
        await setAttendanceForDate(studentId, date, next, undefined, session)
        refresh()
    }

    const changeDate = (delta: number) => {
        const d = new Date(date)
        d.setDate(d.getDate() + delta)
        setDate(d.toISOString().split('T')[0])
    }

    // Group students by team
    const teams = useMemo(() => {
        const map = new Map<string, Student[]>()
        students.forEach(s => {
            const arr = map.get(s.team) || []
            arr.push(s)
            map.set(s.team, arr)
        })
        return Array.from(map.entries())
            .filter(([team]) => {
                if (user?.role === 'team_leader') return team === user.team
                return true
            })
            .sort(([a], [b]) => a.localeCompare(b))
    }, [students, user])

    // Stats for current session
    const absentExcused = Array.from(attendanceMap.values()).filter(s => s === 'absent_excused').length
    const absentUnexcused = Array.from(attendanceMap.values()).filter(s => s === 'absent_unexcused').length
    const presentCount = students.length - absentExcused - absentUnexcused

    // Status UI
    const statusConfig: Record<AttendanceStatus, { icon: typeof CheckCircle; label: string; color: string; bg: string }> = {
        present: { icon: CheckCircle, label: 'Có mặt', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
        absent_excused: { icon: AlertCircle, label: 'Vắng (P)', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
        absent_unexcused: { icon: XCircle, label: 'Vắng (K)', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    }

    // Recent attendance history (last 5 dates that have records)
    const recentDates = useMemo(() => {
        const dates = new Set(attendance.map(a => a.date))
        return Array.from(dates).sort().reverse().slice(0, 5)
    }, [attendance])

    if (!ready) return null

    // Block students from accessing
    if (!can('mark_attendance')) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-400 mb-3" />
                <p className="text-slate-500 text-lg font-medium">Bạn không có quyền truy cập trang này</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {ToastComponent}

            {/* Header */}
            <div className="animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Điểm danh</h1>
                <p className="text-slate-500 text-sm mt-1">Ghi nhận tình hình đi học của học sinh</p>
            </div>

            {/* Date selector */}
            <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '50ms' }}>
                <button onClick={() => changeDate(-1)}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-slate-400" />
                </button>
                <div className="relative flex-1 max-w-[200px]">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="input-field pl-10 text-center"
                    />
                </div>
                <button onClick={() => changeDate(1)}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
                <span className="text-sm text-slate-500 font-medium">
                    {formatDate(date)}
                </span>
            </div>

            {/* Session selector (Sáng / Chiều) */}
            <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '80ms' }}>
                <button
                    onClick={() => setSession('morning')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 ${session === 'morning'
                        ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                >
                    <Sun className="h-4 w-4" />
                    Buổi Sáng
                </button>
                <button
                    onClick={() => setSession('afternoon')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 ${session === 'afternoon'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                >
                    <Moon className="h-4 w-4" />
                    Buổi Chiều
                </button>
                <span className="text-xs text-slate-400 ml-1">
                    Đang điểm danh: <strong className={session === 'morning' ? 'text-amber-600' : 'text-indigo-600'}>
                        {ATTENDANCE_SESSION_LABELS[session]}
                    </strong>
                </span>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 stagger-children">
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <CheckCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                        <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
                        <p className="text-xs text-slate-400">Có mặt</p>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <AlertCircle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                        <p className="text-2xl font-bold text-amber-600">{absentExcused}</p>
                        <p className="text-xs text-slate-400">Vắng có phép</p>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                        <p className="text-2xl font-bold text-red-600">{absentUnexcused}</p>
                        <p className="text-xs text-slate-400">Vắng không phép</p>
                    </CardContent>
                </Card>
            </div>

            {/* Attendance grid by team */}
            <div className="space-y-4">
                {teams.map(([team, members]) => (
                    <Card key={team} className="animate-slide-up">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-semibold text-slate-600">{team}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {members.map(student => {
                                    const status = getStatus(student.id)
                                    const cfg = statusConfig[status]
                                    const Icon = cfg.icon
                                    return (
                                        <button
                                            key={student.id}
                                            onClick={() => cycleStatus(student.id)}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all hover:shadow-sm active:scale-[0.98] ${cfg.bg}`}
                                        >
                                            <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                                            <span className="flex-1 text-left text-sm font-medium text-slate-800 truncate">
                                                {student.name}
                                            </span>
                                            <span className={`text-[10px] font-semibold ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-slate-400">
                <span>💡 Nhấn vào tên học sinh để thay đổi trạng thái: <strong className="text-emerald-600">Có mặt</strong> → <strong className="text-amber-600">Vắng (P)</strong> → <strong className="text-red-600">Vắng (K)</strong> → quay lại</span>
            </div>

            {/* Recent attendance history */}
            {recentDates.length > 0 && (
                <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                            Lịch sử điểm danh gần đây
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {recentDates.map(d => {
                                const dayRecords = attendance.filter(a => a.date === d)
                                // Total across both sessions
                                const excused = dayRecords.filter(r => r.status === 'absent_excused').length
                                const unexcused = dayRecords.filter(r => r.status === 'absent_unexcused').length
                                // Per-session breakdown
                                const morningAbsent = dayRecords.filter(r => (r.session || 'morning') === 'morning' && r.status !== 'present').length
                                const afternoonAbsent = dayRecords.filter(r => r.session === 'afternoon' && r.status !== 'present').length
                                const hasAfternoon = dayRecords.some(r => r.session === 'afternoon')
                                return (
                                    <button
                                        key={d}
                                        onClick={() => setDate(d)}
                                        className={`w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left ${d === date ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <span className="text-sm font-medium text-slate-700">
                                            {formatDate(d)}
                                        </span>
                                        <div className="flex items-center gap-3 text-xs">
                                            {hasAfternoon ? (
                                                <>
                                                    {morningAbsent > 0 && <span className="text-amber-600 font-medium flex items-center gap-1"><Sun className="h-3 w-3" />{morningAbsent} vắng</span>}
                                                    {afternoonAbsent > 0 && <span className="text-indigo-600 font-medium flex items-center gap-1"><Moon className="h-3 w-3" />{afternoonAbsent} vắng</span>}
                                                    {morningAbsent === 0 && afternoonAbsent === 0 && <span className="text-emerald-500">Đầy đủ</span>}
                                                </>
                                            ) : (
                                                <>
                                                    {excused > 0 && <span className="text-amber-600 font-medium">Vắng P: {excused}</span>}
                                                    {unexcused > 0 && <span className="text-red-600 font-medium">Vắng K: {unexcused}</span>}
                                                    {excused === 0 && unexcused === 0 && <span className="text-emerald-500">Đầy đủ</span>}
                                                </>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
