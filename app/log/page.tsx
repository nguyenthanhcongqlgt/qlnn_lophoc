"use client"

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
    initializeData, getStudents, getViolationTypes, getAchievementTypes,
    addLog, getLogs, updateLog, deleteLog, getSubjects, getClassInfo
} from '@/lib/storage'
import { Student, IncidentType, LogEntry, Subject, SESSIONS, PERIODS } from '@/types'
import {
    AlertTriangle, Award, Check, Calendar, Users, Zap, BookOpen,
    Clock, Hash, Pencil, Trash2, History, Save, X
} from 'lucide-react'
import { sortByName } from '@/lib/utils'
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

export default function LogPage() {
    const [students, setStudents] = useState<Student[]>([])
    const [violations, setViolations] = useState<IncidentType[]>([])
    const [achievements, setAchievements] = useState<IncidentType[]>([])
    const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [authorizedStudents, setAuthorizedStudents] = useState<string[]>([])
    const [ready, setReady] = useState(false)

    // Form state
    const [logType, setLogType] = useState<'violation' | 'achievement'>('violation')
    const [selectedStudents, setSelectedStudents] = useState<string[]>([])
    const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [selectAll, setSelectAll] = useState(false)
    const [viewMode, setViewMode] = useState<'create' | 'search'>('create')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResult, setSearchResult] = useState<LogEntry | null>(null)

    // Metadata fields
    const [subject, setSubject] = useState('')
    const [session, setSession] = useState<string>('Sáng')
    const [period, setPeriod] = useState<number>(1)

    // Edit dialog state
    const [editingLog, setEditingLog] = useState<LogEntry | null>(null)
    const [editContent, setEditContent] = useState('')
    const [editPoint, setEditPoint] = useState(0)
    const [editDate, setEditDate] = useState('')
    const [editSubject, setEditSubject] = useState('')
    const [editSession, setEditSession] = useState('Sáng')
    const [editPeriod, setEditPeriod] = useState(1)
    const [editStudentId, setEditStudentId] = useState('')
    const [editType, setEditType] = useState<'violation' | 'achievement'>('violation')

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<LogEntry | null>(null)

    // Reject confirm
    const [rejectTarget, setRejectTarget] = useState<LogEntry | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    const { showToast, ToastComponent } = useToast()
    const { user, can } = useAuth()

    useEffect(() => {
        initializeData()
        refresh()
    }, [])

    const refresh = async () => {
        const [studentsData, violationsData, achievementsData, allLogs, subjectsData, classData] = await Promise.all([
            getStudents(),
            getViolationTypes(),
            getAchievementTypes(),
            getLogs(),
            getSubjects(),
            getClassInfo()
        ])
        setStudents(studentsData.filter(s => s.status !== 'dropped_out'))
        setViolations(violationsData)
        setAchievements(achievementsData)
        setSubjects(subjectsData)
        setAuthorizedStudents(classData.authorizedStudents || [])
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setRecentLogs(allLogs.slice(0, 20))
        setReady(true)
        window.dispatchEvent(new Event('conduct-logs-changed'))
    }

    const isAuthorizedRole = user?.role === 'teacher';
    const isAuthorizedStudent = user?.studentId && authorizedStudents.includes(user.studentId);
    const canApprove = isAuthorizedRole || isAuthorizedStudent;

    const incidentList = logType === 'violation' ? violations : achievements

    const visibleStudents = useMemo(() => {
        let filtered = students;
        if (user?.role === 'team_leader') {
            filtered = students.filter(s => s.team === user.team)
        }
        return [...filtered].sort(sortByName)
    }, [students, user])

    const getStudentName = (id: string) =>
        students.find(s => s.id === id)?.name || 'Không rõ'

    const toggleStudent = (id: string) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedStudents([])
        } else {
            setSelectedStudents(visibleStudents.map(s => s.id))
        }
        setSelectAll(!selectAll)
    }

    const handleSave = async () => {
        if (selectedStudents.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 học sinh!', 'error')
            return
        }
        if (!selectedIncident) {
            showToast('Vui lòng chọn nội dung!', 'error')
            return
        }

        const statusStr = canApprove ? 'approved' : 'pending'

        for (const studentId of selectedStudents) {
            await addLog({
                studentId,
                type: logType,
                content: selectedIncident.content,
                point: selectedIncident.point,
                date,
                subject: subject || undefined,
                session,
                period,
                status: statusStr,
                createdBy: user?.displayName || user?.username,
            })
        }

        const count = selectedStudents.length
        const pointText = selectedIncident.point > 0 ? `+${selectedIncident.point}` : selectedIncident.point
        showToast(`Đã ghi nhận (${statusStr === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}) "${selectedIncident.content}" (${pointText}đ) cho ${count} học sinh!`)

        setSelectedStudents([])
        setSelectedIncident(null)
        setSelectAll(false)
        refresh()
    }

    const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
        if (status === 'rejected') {
            const logToReject = recentLogs.find(l => l.id === id) || searchResult;
            if (logToReject && logToReject.id === id) {
                setRejectTarget(logToReject)
                setRejectReason('')
            }
            return
        }

        await updateLog(id, { status })
        showToast(`Đã duyệt phiếu thành công!`)

        // Update searchResult locally if it matches
        if (searchResult && searchResult.id === id) {
            setSearchResult({ ...searchResult, status: 'approved' });
        }
        refresh()
    }

    const confirmReject = async () => {
        if (!rejectTarget) return;
        if (!rejectReason.trim()) {
            showToast('Vui lòng nhập lý do từ chối!', 'error')
            return;
        }

        await updateLog(rejectTarget.id, { status: 'rejected', rejectReason: rejectReason.trim() })
        showToast('Đã từ chối phiếu!')

        // Update searchResult locally if it matches
        if (searchResult && searchResult.id === rejectTarget.id) {
            setSearchResult({ ...searchResult, status: 'rejected', rejectReason: rejectReason.trim() });
        }

        setRejectTarget(null)
        setRejectReason('')
        refresh()
    }

    // ── Edit handlers ──
    const openEdit = (log: LogEntry) => {
        setEditingLog(log)
        setEditContent(log.content)
        setEditPoint(log.point)
        setEditDate(log.date)
        setEditSubject(log.subject || '')
        setEditSession(log.session || 'Sáng')
        setEditPeriod(log.period || 1)
        setEditStudentId(log.studentId)
        setEditType(log.type)
    }

    const handleUpdate = async () => {
        if (!editingLog) return
        await updateLog(editingLog.id, {
            studentId: editStudentId,
            type: editType,
            content: editContent,
            point: editPoint,
            date: editDate,
            subject: editSubject || undefined,
            session: editSession,
            period: editPeriod,
        })
        showToast('Đã cập nhật bản ghi!')

        // Cập nhật lại searchResult nếu đang xem mục tìm kiếm
        if (searchResult && searchResult.id === editingLog.id) {
            setSearchResult({
                ...editingLog,
                studentId: editStudentId,
                type: editType,
                content: editContent,
                point: editPoint,
                date: editDate,
                subject: editSubject || undefined,
                session: editSession,
                period: editPeriod,
            });
        }
        setEditingLog(null)
        refresh()
    }

    const handleSearch = () => {
        const query = searchQuery.trim().toUpperCase()
        if (!query) {
            setSearchResult(null)
            return
        }
        const found = recentLogs.find(l => l.id.toUpperCase() === query)
        if (found) {
            setSearchResult(found)
        } else {
            showToast('Không tìm thấy mã phiếu này!', 'error')
            setSearchResult(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        await deleteLog(deleteTarget.id)
        showToast('Đã xoá bản ghi!', 'info')
        setDeleteTarget(null)
        refresh()
    }

    if (!ready) return null

    // Block students from accessing this page
    if (!can('create_log')) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-400 mb-3" />
                <p className="text-slate-500 text-lg font-medium">Bạn không có quyền truy cập trang này</p>
                <p className="text-slate-400 text-sm mt-1">Chỉ tổ trưởng, lớp trưởng và GVCN mới được chấm nề nếp</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {ToastComponent}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Nề nếp</h1>
                    <p className="text-slate-500 text-sm mt-1">Ghi nhận vi phạm, việc tốt và quản lý phiếu</p>
                </div>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setViewMode('create')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${viewMode === 'create' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Gắn Phiếu Mới
                    </button>
                    <button
                        onClick={() => setViewMode('search')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${viewMode === 'search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Tra Cứu / Sửa
                    </button>
                </div>
            </div>

            {viewMode === 'create' ? (
                <div className="grid gap-6 lg:grid-cols-5">
                    {/* Left: Controls + Incident types */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Type toggle + Date */}
                        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
                            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                                <button
                                    onClick={() => { setLogType('violation'); setSelectedIncident(null) }}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${logType === 'violation'
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    Vi phạm
                                </button>
                                <button
                                    onClick={() => { setLogType('achievement'); setSelectedIncident(null) }}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${logType === 'achievement'
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Award className="h-4 w-4" />
                                    Việc tốt
                                </button>
                            </div>
                            <div className="relative flex-1 sm:max-w-[200px]">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>

                        {/* Subject / Session / Period selectors */}
                        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                            <CardContent className="pt-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="input-label flex items-center gap-1.5">
                                            <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                                            Môn học
                                        </label>
                                        <select value={subject} onChange={e => setSubject(e.target.value)} className="input-field">
                                            <option value="">-- Chọn môn --</option>
                                            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="input-label flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                                            Buổi học
                                        </label>
                                        <div className="flex bg-white rounded-lg border border-slate-200 p-1 h-[42px]">
                                            {SESSIONS.map(s => (
                                                <button key={s} type="button" onClick={() => setSession(s)}
                                                    className={`flex-1 text-sm font-medium rounded-md transition-all ${session === s
                                                        ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="input-label flex items-center gap-1.5">
                                            <Hash className="h-3.5 w-3.5 text-cyan-500" />
                                            Tiết học
                                        </label>
                                        <div className="flex bg-white rounded-lg border border-slate-200 p-1 h-[42px] gap-0.5">
                                            {PERIODS.map(p => (
                                                <button key={p} type="button" onClick={() => setPeriod(p)}
                                                    className={`flex-1 text-sm font-medium rounded-md transition-all ${period === p
                                                        ? 'bg-cyan-100 text-cyan-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick action grid */}
                        <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    Chọn nội dung {logType === 'violation' ? 'vi phạm' : 'việc tốt'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {incidentList.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedIncident(selectedIncident?.id === item.id ? null : item)}
                                            className={`quick-action-btn text-left p-4 rounded-xl bg-white border-2 ${selectedIncident?.id === item.id
                                                ? logType === 'violation'
                                                    ? 'border-red-400 bg-red-50 shadow-md'
                                                    : 'border-emerald-400 bg-emerald-50 shadow-md'
                                                : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <p className="font-medium text-sm text-slate-800">{item.content}</p>
                                                <Badge variant={logType === 'violation' ? 'danger' : 'success'}>
                                                    {item.point > 0 ? '+' : ''}{item.point}đ
                                                </Badge>
                                            </div>
                                            {selectedIncident?.id === item.id && (
                                                <div className="mt-2 flex items-center gap-1 text-xs text-indigo-600 font-medium">
                                                    <Check className="h-3.5 w-3.5" /> Đã chọn
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Student selection */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="animate-slide-in-right" style={{ animationDelay: '300ms' }}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Users className="h-4 w-4 text-indigo-500" />
                                        Chọn học sinh
                                    </CardTitle>
                                    <button onClick={toggleSelectAll}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                                        {selectAll ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                    </button>
                                </div>
                                {selectedStudents.length > 0 && (
                                    <Badge variant="info" className="mt-2">
                                        Đã chọn {selectedStudents.length} học sinh
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                                    {visibleStudents.map(student => {
                                        const isSelected = selectedStudents.includes(student.id)
                                        return (
                                            <button key={student.id} onClick={() => toggleStudent(student.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${isSelected
                                                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                                                    : 'bg-white border border-transparent hover:bg-slate-50 text-slate-700'}`}>
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                                </div>
                                                <span className="flex-1 text-left font-medium">{student.name}</span>
                                                <span className="text-xs text-slate-400">{student.team}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={selectedStudents.length === 0 || !selectedIncident}
                                    className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors shadow-sm animate-fade-in"
                                >
                                    <Save className="h-4 w-4" />
                                    Lưu Phiếu Nề Nếp
                                </button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6">
                    <Card className="animate-fade-in border-indigo-200">
                        <CardHeader>
                            <CardTitle className="text-base text-indigo-700 flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Theo dõi và Cập nhật Phiếu
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Nhập Mã phiếu (VD: P-A1B2C3)..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="input-field max-w-sm uppercase"
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
                                >
                                    Tìm kiếm
                                </button>
                            </div>

                            {searchResult && (
                                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-slide-up space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                        <div>
                                            <p className="font-semibold text-slate-800 text-lg">{getStudentName(searchResult.studentId)}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={searchResult.type === 'violation' ? 'danger' : 'success'}>
                                                    Mã: {searchResult.id} • {searchResult.type === 'violation' ? 'Vi phạm' : 'Việc tốt'} ({searchResult.point > 0 ? '+' : ''}{searchResult.point}đ)
                                                </Badge>
                                                {searchResult.status === 'pending' && <Badge variant="warning" className="py-0 h-5">Chờ duyệt</Badge>}
                                                {searchResult.status === 'rejected' && (
                                                    <Badge variant="default" title={searchResult.rejectReason ? `Lý do: ${searchResult.rejectReason}` : 'Đã bị từ chối'} className="py-0 h-5 bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-help">
                                                        Từ chối
                                                    </Badge>
                                                )}
                                                {searchResult.status === 'approved' && <Badge variant="success" className="py-0 h-5 bg-emerald-100/50 text-emerald-600 hover:bg-emerald-100/80">Đã duyệt</Badge>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <p className="text-sm text-slate-500">{formatDate(searchResult.date)}</p>
                                            <div className="flex gap-2">
                                                {canApprove && searchResult.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => { handleApprove(searchResult.id, 'approved'); setSearchResult({ ...searchResult, status: 'approved' }) }} className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-medium transition-colors flex items-center gap-1.5">
                                                            <Check className="w-3.5 h-3.5" /> Duyệt
                                                        </button>
                                                        <button onClick={() => { handleApprove(searchResult.id, 'rejected'); setSearchResult({ ...searchResult, status: 'rejected' }) }} className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-medium transition-colors flex items-center gap-1.5">
                                                            <X className="w-3.5 h-3.5" /> Từ chối
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => openEdit(searchResult)} className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs font-medium transition-colors flex items-center gap-1.5">
                                                    <Pencil className="w-3.5 h-3.5" /> Sửa
                                                </button>
                                                <button onClick={() => setDeleteTarget(searchResult)} className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-medium transition-colors flex items-center gap-1.5">
                                                    <Trash2 className="w-3.5 h-3.5" /> Xoá
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4 pt-2 text-sm text-slate-600">
                                        <div><strong>Nội dung:</strong> {searchResult.content}</div>
                                        <div><strong>Buổi/Tiết:</strong> {searchResult.session} - Tiết {searchResult.period} {searchResult.subject && `(${searchResult.subject})`}</div>
                                        {searchResult.createdBy && (
                                            <div className="sm:col-span-2 text-xs text-slate-400 mt-1">
                                                Người tạo: <span className="font-medium text-slate-600">{searchResult.createdBy}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )
            }

            {/* ── Recent Logs with Edit ── */}
            {
                recentLogs.length > 0 && (
                    <Card className="animate-slide-up" style={{ animationDelay: '400ms' }}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="h-4 w-4 text-indigo-500" />
                                Phiếu nề nếp gần đây ({recentLogs.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {recentLogs.map(log => (
                                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/80 transition-colors group">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant={log.type === 'violation' ? 'danger' : 'success'} className="text-[10px]">
                                                    {log.type === 'violation' ? 'VP' : 'VT'}
                                                </Badge>
                                                <span className="text-xs text-indigo-600 font-semibold truncate bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    {log.id}
                                                </span>
                                                <span className="text-sm font-medium text-slate-800 truncate">
                                                    {getStudentName(log.studentId)}
                                                </span>
                                                {log.status === 'pending' && <Badge variant="warning" className="text-[10px] py-0 h-4">Chờ duyệt</Badge>}
                                                {log.status === 'rejected' && (
                                                    <Badge variant="default" title={log.rejectReason ? `Lý do: ${log.rejectReason}` : 'Đã bị từ chối'} className="text-[10px] py-0 h-4 bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-help">
                                                        Từ chối
                                                    </Badge>
                                                )}
                                                {log.status === 'approved' && <Badge variant="success" className="text-[10px] py-0 h-4 bg-emerald-100/50 text-emerald-600 hover:bg-emerald-100/80">Đã duyệt</Badge>}
                                                <span className="text-xs text-slate-400 hidden sm:inline">—</span>
                                                <span className="text-sm text-slate-600 truncate hidden sm:inline">{log.content}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 truncate sm:hidden mt-1">{log.content}</p>
                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                                <span>{formatDate(log.date)}</span>
                                                {log.subject && <span>• {log.subject}</span>}
                                                {log.session && <span>• {log.session} T{log.period}</span>}
                                                {log.createdBy && <span className="hidden sm:inline">• Tạo bởi: {log.createdBy}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                            <span className={`text-sm font-bold shrink-0 ${log.point < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {log.point > 0 ? '+' : ''}{log.point}đ
                                            </span>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                {canApprove && log.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => handleApprove(log.id, 'approved')}
                                                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                                                            title="Duyệt">
                                                            <Check className="h-3.5 w-3.5" />
                                                            <span className="hidden sm:inline">Duyệt</span>
                                                        </button>
                                                        <button onClick={() => handleApprove(log.id, 'rejected')}
                                                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors"
                                                            title="Từ chối">
                                                            <X className="h-3.5 w-3.5" />
                                                            <span className="hidden sm:inline">Từ chối</span>
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => openEdit(log)}
                                                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                                    title="Sửa">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Sửa</span>
                                                </button>
                                                <button onClick={() => setDeleteTarget(log)}
                                                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                                                    title="Xoá">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Xoá</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* ── Edit Dialog ── */}
            <Dialog
                open={!!editingLog}
                onClose={() => setEditingLog(null)}
                title="Chỉnh sửa phiếu nề nếp"
                maxWidth="max-w-lg"
            >
                {editingLog && (
                    <div className="space-y-4">
                        {/* Student */}
                        <div>
                            <label className="input-label">Học sinh</label>
                            <select value={editStudentId} onChange={e => setEditStudentId(e.target.value)} className="input-field">
                                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.team})</option>)}
                            </select>
                        </div>

                        {/* Type */}
                        <div>
                            <label className="input-label">Loại</label>
                            <div className="flex bg-white rounded-lg border border-slate-200 p-1 h-[42px]">
                                <button type="button" onClick={() => setEditType('violation')}
                                    className={`flex-1 text-sm font-medium rounded-md transition-all ${editType === 'violation'
                                        ? 'bg-red-100 text-red-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    Vi phạm
                                </button>
                                <button type="button" onClick={() => setEditType('achievement')}
                                    className={`flex-1 text-sm font-medium rounded-md transition-all ${editType === 'achievement'
                                        ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    Việc tốt
                                </button>
                            </div>
                        </div>

                        {/* Content + Point */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="input-label">Nội dung</label>
                                <input type="text" value={editContent} onChange={e => setEditContent(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label className="input-label">Điểm</label>
                                <input type="number" value={editPoint} onChange={e => setEditPoint(Number(e.target.value))} className="input-field" />
                            </div>
                        </div>

                        {/* Date + Subject */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="input-label">Ngày</label>
                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label className="input-label">Môn học</label>
                                <select value={editSubject} onChange={e => setEditSubject(e.target.value)} className="input-field">
                                    <option value="">-- Không chọn --</option>
                                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Session + Period */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="input-label">Buổi</label>
                                <div className="flex bg-white rounded-lg border border-slate-200 p-1 h-[42px]">
                                    {SESSIONS.map(s => (
                                        <button key={s} type="button" onClick={() => setEditSession(s)}
                                            className={`flex-1 text-sm font-medium rounded-md transition-all ${editSession === s
                                                ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Tiết</label>
                                <div className="flex bg-white rounded-lg border border-slate-200 p-1 h-[42px] gap-0.5">
                                    {PERIODS.map(p => (
                                        <button key={p} type="button" onClick={() => setEditPeriod(p)}
                                            className={`flex-1 text-sm font-medium rounded-md transition-all ${editPeriod === p
                                                ? 'bg-cyan-100 text-cyan-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setEditingLog(null)}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                Huỷ
                            </button>
                            <button onClick={handleUpdate}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                                <Save className="h-4 w-4" />
                                Lưu thay đổi
                            </button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Delete Confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Xoá phiếu nề nếp"
                message={`Bạn có chắc chắn muốn xoá "${deleteTarget?.content}" của ${deleteTarget ? getStudentName(deleteTarget.studentId) : ''}?`}
                confirmText="Xoá"
            />

            {/* Reject Dialog */}
            <Dialog
                open={!!rejectTarget}
                onClose={() => setRejectTarget(null)}
                title="Từ chối phiếu nề nếp"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Vui lòng nhập lý do từ chối phiếu <strong>"{rejectTarget?.content}"</strong> của học sinh <strong>{rejectTarget ? getStudentName(rejectTarget.studentId) : ''}</strong>:
                    </p>
                    <div>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do chi tiết..."
                            className="input-field min-h-[100px] resize-y"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setRejectTarget(null)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            Huỷ
                        </button>
                        <button onClick={confirmReject}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                            Xác nhận Từ chối
                        </button>
                    </div>
                </div>
            </Dialog>
        </div >
    )
}
