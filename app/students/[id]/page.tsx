"use client"

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
    initializeData, getStudents, getStudentsWithScores, getLogs,
    getGradeThresholds, getAttendance, saveStudentNote
} from '@/lib/storage'
import { LogEntry, StudentWithScore, GradeThresholds, getConductGrade, AttendanceRecord, DEFAULT_GRADE_THRESHOLDS } from '@/types'
import {
    ArrowLeft, AlertTriangle, Award, TrendingUp, Calendar,
    MessageSquare, Save, GraduationCap, ClipboardCheck
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

function formatDate(dateString: string): string {
    if (!dateString) return ''
    try {
        return format(parseISO(dateString), 'dd/MM/yyyy')
    } catch {
        return dateString
    }
}

export default function StudentProfilePage() {
    const params = useParams()
    const router = useRouter()
    const studentId = params.id as string

    const [student, setStudent] = useState<StudentWithScore | null>(null)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [thresholds, setThresholds] = useState<GradeThresholds>(DEFAULT_GRADE_THRESHOLDS)
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
    const [note, setNote] = useState('')
    const [ready, setReady] = useState(false)

    const { showToast, ToastComponent } = useToast()

    useEffect(() => {
        initializeData()
        async function loadData() {
            const [students, logsData, thresholdsData, attendanceData] = await Promise.all([
                getStudentsWithScores(),
                getLogs(),
                getGradeThresholds(),
                getAttendance(),
            ])
            const s = students.find(s => s.id === studentId)
            if (s) {
                setStudent(s)
                setNote(s.note || '')
            }
            setLogs(logsData.filter(l => l.studentId === studentId)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
            setThresholds(thresholdsData)
            setAttendanceRecords(attendanceData.filter(a => a.studentId === studentId))
            setReady(true)
        }
        loadData()
    }, [studentId])

    const handleSaveNote = async () => {
        await saveStudentNote(studentId, note)
        showToast('Đã lưu nhận xét!')
    }

    // Weekly score trend (last 8 weeks)
    const weeklyTrend = useMemo(() => {
        const weeks: { label: string; score: number }[] = []
        const now = new Date()
        for (let i = 7; i >= 0; i--) {
            const weekEnd = new Date(now)
            weekEnd.setDate(weekEnd.getDate() - i * 7)
            const weekStart = new Date(weekEnd)
            weekStart.setDate(weekStart.getDate() - 7)
            const endStr = weekEnd.toISOString().split('T')[0]

            const logsBeforeEnd = logs.filter(l => l.date <= endStr)
            const pts = logsBeforeEnd.reduce((s, l) => s + l.point, 0)
            const score = (student?.initialScore || 100) + pts

            weeks.push({
                label: `T${8 - i}`,
                score,
            })
        }
        return weeks
    }, [logs, student])

    const maxScore = Math.max(...weeklyTrend.map(w => w.score), 100)
    const minScore = Math.min(...weeklyTrend.map(w => w.score), 0)
    const range = maxScore - minScore || 1

    // Attendance stats
    const absExcused = attendanceRecords.filter(r => r.status === 'absent_excused').length
    const absUnexcused = attendanceRecords.filter(r => r.status === 'absent_unexcused').length

    if (!ready || !student) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-slate-400">{!ready ? 'Đang tải...' : 'Không tìm thấy học sinh'}</p>
            </div>
        )
    }

    const grade = getConductGrade(student.currentScore, thresholds.semester)

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {ToastComponent}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-in">
                <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => router.back()}
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors shrink-0">
                        <ArrowLeft className="h-5 w-5 text-slate-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 truncate">{student.name}</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{student.team} • Điểm khởi đầu: {student.initialScore}</p>
                    </div>
                </div>
                <div className={`px-4 py-2 rounded-xl border-2 self-start sm:self-auto ${grade.bgColor} ${grade.borderColor}`}>
                    <p className="text-xs text-slate-500">Xếp loại</p>
                    <p className={`text-lg font-bold ${grade.color}`}>{grade.name}</p>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <TrendingUp className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
                        <p className={`text-2xl font-bold ${student.currentScore >= thresholds.semester.dat ? 'text-indigo-600' : 'text-red-600'}`}>
                            {student.currentScore}đ
                        </p>
                        <p className="text-xs text-slate-400">Điểm hiện tại</p>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                        <p className="text-2xl font-bold text-red-600">{student.violationCount}</p>
                        <p className="text-xs text-slate-400">Vi phạm</p>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <Award className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                        <p className="text-2xl font-bold text-emerald-600">{student.achievementCount}</p>
                        <p className="text-xs text-slate-400">Việc tốt</p>
                    </CardContent>
                </Card>
                <Card className="card-hover">
                    <CardContent className="pt-4 text-center">
                        <ClipboardCheck className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                        <p className="text-2xl font-bold text-amber-600">{absExcused + absUnexcused}</p>
                        <p className="text-xs text-slate-400">Ngày vắng ({absExcused}P / {absUnexcused}K)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Score trend chart */}
            <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        Xu hướng điểm nề nếp
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-1.5 sm:gap-3 h-40">
                        {weeklyTrend.map((w, i) => {
                            const pct = Math.max(((w.score - minScore) / range) * 100, 5)
                            const g = getConductGrade(w.score, thresholds.semester)
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-500">{w.score}</span>
                                    <div className="w-full flex items-end" style={{ height: '120px' }}>
                                        <div
                                            className={`w-full rounded-t-md transition-all duration-500 ${g.bgColor.replace('bg-', 'bg-')}`}
                                            style={{
                                                height: `${pct}%`,
                                                background: g.name === 'Tốt' ? '#6ee7b7' : g.name === 'Khá' ? '#93c5fd' : g.name === 'Đạt' ? '#fcd34d' : '#fca5a5'
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-400">{w.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Teacher note */}
            <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-500" />
                        Nhận xét GVCN
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Ghi nhận xét cho học sinh này..."
                        className="input-field min-h-[100px] resize-y py-3"
                        style={{ height: 'auto' }}
                    />
                    <button onClick={handleSaveNote}
                        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
                        <Save className="h-4 w-4" />
                        Lưu nhận xét
                    </button>
                </CardContent>
            </Card>

            {/* Detailed log history */}
            <Card className="animate-slide-up" style={{ animationDelay: '250ms' }}>
                <CardHeader>
                    <CardTitle className="text-base">Lịch sử chi tiết ({logs.length} bản ghi)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {logs.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-400">
                            Chưa có bản ghi nào
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {logs.map(log => (
                                <div key={log.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-slate-50/80 transition-colors">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.type === 'violation' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {log.type === 'violation' ? <AlertTriangle className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800">{log.content}</p>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                            <span>{formatDate(log.date)}</span>
                                            {log.subject && <span>• {log.subject}</span>}
                                            {log.session && <span>• {log.session} T{log.period}</span>}
                                            {log.createdBy && <span>• Tạo bởi: {log.createdBy}</span>}
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold shrink-0 ${log.point < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {log.point > 0 ? '+' : ''}{log.point}đ
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
