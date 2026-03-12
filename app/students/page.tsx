"use client"

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
    initializeData, getStudentsWithScores, addStudent, updateStudent, deleteStudent as removeStudent,
    getGradeThresholds, resetStudentPassword, updateStudentStatus, deleteAllStudents, getPositions
} from '@/lib/storage'
import { Student, StudentWithScore, GradeThresholds, getConductGrade, DEFAULT_GRADE_THRESHOLDS, Position } from '@/types'
import { Search, Plus, Pencil, Trash2, ArrowUpDown, Filter, ChevronLeft, ChevronRight, KeyRound, UserMinus, UserCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function StudentsPage() {
    const [students, setStudents] = useState<StudentWithScore[]>([])
    const [search, setSearch] = useState('')
    const [teamFilter, setTeamFilter] = useState('')
    const [sortAsc, setSortAsc] = useState(true)
    const [gradeThresholds, setGradeThresholds] = useState<GradeThresholds>(DEFAULT_GRADE_THRESHOLDS)
    const [positions, setPositions] = useState<Position[]>([])
    const [ready, setReady] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20

    // Dialog states
    const [showAddEdit, setShowAddEdit] = useState(false)
    const [editingStudent, setEditingStudent] = useState<Student | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
    const [resetPwTarget, setResetPwTarget] = useState<Student | null>(null)
    const [dropoutTarget, setDropoutTarget] = useState<Student | null>(null)

    // Form state
    const [formName, setFormName] = useState('')
    const [formDob, setFormDob] = useState('')
    const [formTeam, setFormTeam] = useState('Tổ 1')
    const [formPosition, setFormPosition] = useState('')
    const [formScore, setFormScore] = useState(100)
    const [dropoutDate, setDropoutDate] = useState(() => new Date().toISOString().split('T')[0])

    const { showToast, ToastComponent } = useToast()
    const { user, can, isRole } = useAuth()

    useEffect(() => {
        initializeData()
        refresh()
    }, [])

    const refresh = async () => {
        const [swScores, thresholds, posData] = await Promise.all([
            getStudentsWithScores(),
            getGradeThresholds(),
            getPositions(),
        ])
        setStudents(swScores)
        setGradeThresholds(thresholds)
        setPositions(posData)
        setReady(true)
    }

    const teams = useMemo(() => {
        const t = new Set(students.map(s => s.team))
        return Array.from(t).sort()
    }, [students])

    const filtered = useMemo(() => {
        let list = students
        // Role-based filtering
        if (user?.role === 'student') {
            list = list.filter(s => s.id === user.studentId)
        } else if (user?.role === 'team_leader') {
            list = list.filter(s => s.team === user.team)
        }
        return list
            .filter(s => {
                const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                    s.id.toLowerCase().includes(search.toLowerCase())
                const matchTeam = !teamFilter || s.team === teamFilter
                return matchSearch && matchTeam
            })
            .sort((a, b) => sortAsc ? a.currentScore - b.currentScore : b.currentScore - a.currentScore)
    }, [students, search, teamFilter, sortAsc, user])

    const openAdd = () => {
        setEditingStudent(null)
        setFormName('')
        setFormDob('')
        setFormTeam('Tổ 1')
        setFormPosition('')
        setFormScore(100)
        setShowAddEdit(true)
    }

    const openEdit = (s: StudentWithScore) => {
        setEditingStudent(s)
        setFormName(s.name)
        setFormDob(s.dateOfBirth || '')
        setFormTeam(s.team)
        setFormPosition(s.position || '')
        setFormScore(s.initialScore)
        setShowAddEdit(true)
    }

    const handleSave = async () => {
        if (!formName.trim()) return
        // position: gửi null khi rỗng để API xóa chức vụ, không gửi undefined (sẽ bị bỏ qua)
        const positionValue = formPosition.trim() || null
        if (editingStudent) {
            await updateStudent(editingStudent.id, { name: formName.trim(), dateOfBirth: formDob.trim(), team: formTeam, position: positionValue as any, initialScore: formScore })
            showToast('Đã cập nhật học sinh!')
        } else {
            await addStudent({ name: formName.trim(), dateOfBirth: formDob.trim(), team: formTeam, position: positionValue || undefined, initialScore: formScore })
            showToast('Đã thêm học sinh mới!')
        }
        setShowAddEdit(false)
        refresh()
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        await removeStudent(deleteTarget.id)
        showToast('Đã xoá học sinh!', 'info')
        setDeleteTarget(null)
        refresh()
    }

    const handleDeleteAll = async () => {
        try {
            await deleteAllStudents()
            showToast('Đã xoá toàn bộ học sinh!', 'success')
            setShowDeleteAllConfirm(false)
            setTimeout(() => {
                window.location.reload()
            }, 1000)
        } catch (e) {
            console.error('Lỗi khi xoá toàn bộ học sinh:', e)
            showToast('Đã xảy ra lỗi khi xoá toàn bộ học sinh', 'error')
        }
    }

    const handleResetPw = async () => {
        if (!resetPwTarget) return
        await resetStudentPassword(resetPwTarget.id)
        showToast(`Đã cấp lại mật khẩu cho ${resetPwTarget.name} về mặc định (123456)`)
        setResetPwTarget(null)
    }

    const handleDropoutToggle = async () => {
        if (!dropoutTarget) return
        if (dropoutTarget.status === 'dropped_out') {
            await updateStudentStatus(dropoutTarget.id, 'active')
            showToast(`Đã phục hồi học sinh ${dropoutTarget.name}`)
        } else {
            await updateStudentStatus(dropoutTarget.id, 'dropped_out', dropoutDate)
            showToast(`Đã ghi nhận thôi học cho ${dropoutTarget.name}`)
        }
        setDropoutTarget(null)
        refresh()
    }

    // Pagination calculations
    const totalPages = Math.ceil(filtered.length / itemsPerPage)
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filtered.slice(start, start + itemsPerPage)
    }, [filtered, currentPage])

    useEffect(() => {
        setCurrentPage(1)
    }, [search, teamFilter])

    if (!ready) return null

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {ToastComponent}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Danh sách lớp</h1>
                    <p className="text-slate-500 text-sm mt-1">{students.length} học sinh</p>
                </div>
                <div className="flex gap-2">
                    {can('add_student') && (
                        <Button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl">
                            <Plus className="h-4 w-4" />
                            Thêm học sinh
                        </Button>
                    )}
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên hoặc mã HS..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input-field pl-10"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={teamFilter}
                        onChange={e => setTeamFilter(e.target.value)}
                        className="input-field pl-10 pr-8 appearance-none bg-white min-w-[140px]"
                    >
                        <option value="">Tất cả tổ</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <CardContent className="p-0">
                    <div className="table-responsive">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px] hidden sm:table-cell">STT</TableHead>
                                    <TableHead>Tài khoản</TableHead>
                                    <TableHead>Họ và Tên</TableHead>
                                    <TableHead className="hidden sm:table-cell">Ngày sinh</TableHead>
                                    <TableHead className="hidden md:table-cell">Chức vụ</TableHead>
                                    <TableHead className="hidden md:table-cell">Tổ</TableHead>
                                    <TableHead className="w-[180px] text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                                            Không tìm thấy học sinh nào
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedStudents.map((student, idx) => (
                                        <TableRow key={student.id} className={`transition-colors ${student.status === 'dropped_out' ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50/80'}`}>
                                            <TableCell className="font-mono text-xs text-slate-400 hidden sm:table-cell">
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-slate-600 font-medium whitespace-nowrap">
                                                {student.username || student.id}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/students/${student.id}`} className={`font-medium transition-colors block shrink-0 max-w-[200px] sm:max-w-[250px] truncate ${student.status === 'dropped_out' ? 'text-red-600 line-through opacity-70' : 'text-indigo-600 hover:text-indigo-800 hover:underline'}`}>
                                                        {student.name}
                                                    </Link>
                                                    {student.status === 'dropped_out' && (
                                                        <Badge variant="danger" className="py-0 px-1.5 text-[10px] whitespace-nowrap">Thôi học</Badge>
                                                    )}
                                                </div>
                                                {student.note && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{student.note}</p>}
                                                {student.status === 'dropped_out' && student.dropoutDate && (
                                                    <p className="text-[10px] text-red-500 mt-0.5">Ngày nghỉ: {student.dropoutDate}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell text-sm text-slate-600 font-medium">
                                                {student.dateOfBirth || <span className="text-slate-300 italic">Trống</span>}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {student.position ? (
                                                    <Badge variant="default" className="bg-slate-100 text-slate-600 hover:bg-slate-200">{student.position}</Badge>
                                                ) : <span className="text-slate-300">—</span>}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <Badge variant="info">{student.team}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {can('edit_student') && (
                                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => openEdit(student)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                            title="Sửa thông tin"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setResetPwTarget(student)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                            title="Cấp lại mật khẩu"
                                                        >
                                                            <KeyRound className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDropoutTarget(student)}
                                                            className={`p-1.5 rounded-lg text-slate-400 transition-colors ${student.status === 'dropped_out' ? 'hover:text-emerald-600 hover:bg-emerald-50' : 'hover:text-red-600 hover:bg-red-50'}`}
                                                            title={student.status === 'dropped_out' ? 'Phục hồi học sinh' : 'Cho thôi học'}
                                                        >
                                                            {student.status === 'dropped_out' ? <UserCheck className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(student)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-100 transition-colors"
                                                            title="Xoá vĩnh viễn"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                            <span className="text-xs text-slate-500">
                                Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} / {filtered.length} học sinh
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <span className="text-xs font-medium text-slate-600 px-2 min-w-[3rem] text-center">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog
                open={showAddEdit}
                onClose={() => setShowAddEdit(false)}
                title={editingStudent ? 'Sửa thông tin học sinh' : 'Thêm học sinh mới'}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Họ và Tên</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                className="input-field"
                                placeholder="Nguyễn Văn A"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="input-label">Ngày sinh (dd/mm/yyyy)</label>
                            <input
                                type="text"
                                value={formDob}
                                onChange={e => setFormDob(e.target.value)}
                                className="input-field"
                                placeholder="01/01/2010"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Tổ</label>
                            <select
                                value={formTeam}
                                onChange={e => setFormTeam(e.target.value)}
                                className="input-field"
                            >
                                {['Tổ 1', 'Tổ 2', 'Tổ 3', 'Tổ 4'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="input-label">Chức vụ</label>
                            <select
                                value={formPosition}
                                onChange={e => setFormPosition(e.target.value)}
                                className="input-field"
                            >
                                <option value="">Không có</option>
                                {positions.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="input-label">Điểm khởi đầu</label>
                        <input
                            type="number"
                            value={formScore}
                            onChange={e => setFormScore(Number(e.target.value))}
                            className="input-field"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={() => setShowAddEdit(false)}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                        {editingStudent ? 'Cập nhật' : 'Thêm'}
                    </button>
                </div>
            </Dialog>

            <ConfirmDialog
                open={showDeleteAllConfirm}
                onClose={() => setShowDeleteAllConfirm(false)}
                onConfirm={handleDeleteAll}
                title="Cảnh báo Nguy Hiểm: Xóa Toàn Bộ Học Sinh"
                message="Thao tác này sẽ xoá vĩnh viễn TẤT CẢ học sinh trong danh sách lớp, cùng với mọi dữ liệu điểm danh, vi phạm và việc tốt liên quan. Bạn có chắc chắn muốn thực hiện?"
                confirmText="Xóa tất cả (Không thể hoàn tác)"
                variant="danger"
            />

            {/* Reset Password Confirm */}
            <ConfirmDialog
                open={!!resetPwTarget}
                onClose={() => setResetPwTarget(null)}
                onConfirm={handleResetPw}
                title="Cấp lại mật khẩu"
                message={`Mật khẩu đăng nhập của học sinh "${resetPwTarget?.name}" (Tài khoản: ${resetPwTarget?.username || resetPwTarget?.id}) sẽ được đặt lại thành mặc định "123456". Bạn có chắc chắn không?`}
                confirmText="Xác nhận cấp lại"
                variant="danger"
            />

            {/* Dropout Dialog */}
            <Dialog
                open={!!dropoutTarget}
                onClose={() => setDropoutTarget(null)}
                title={dropoutTarget?.status === 'dropped_out' ? 'Phục hồi học sinh' : 'Xác nhận thôi học'}
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        {dropoutTarget?.status === 'dropped_out'
                            ? `Bạn đang phục hồi học sinh "${dropoutTarget?.name}". Dữ liệu của học sinh này sẽ hiển thị lại trong các trang báo cáo.`
                            : `Học sinh "${dropoutTarget?.name}" (Tài khoản: ${dropoutTarget?.id}) sẽ được đánh dấu là "Thôi học". Các vi phạm và số liệu của học sinh này sẽ bị loại bỏ khỏi bảng xếp hạng và các trang báo cáo, nhưng vẫn hiển thị ở trang Danh sách lớp này.`}
                    </p>

                    {dropoutTarget?.status !== 'dropped_out' && (
                        <div>
                            <label className="input-label">Ngày thôi học (ghi nhận)</label>
                            <input
                                type="date"
                                value={dropoutDate}
                                onChange={e => setDropoutDate(e.target.value)}
                                className="input-field"
                            />
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        onClick={() => setDropoutTarget(null)}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={handleDropoutToggle}
                        className={`px-5 py-2 text-sm font-medium rounded-lg text-white transition-colors ${dropoutTarget?.status === 'dropped_out' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {dropoutTarget?.status === 'dropped_out' ? 'Phục hồi' : 'Xác nhận thôi học'}
                    </button>
                </div>
            </Dialog>

            {/* Delete Confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Xoá vĩnh viễn học sinh"
                message={`Bạn có chắc chắn muốn xoá vĩnh viễn "${deleteTarget?.name}"? TẤT CẢ dữ liệu vi phạm/thành tích của học sinh này cũng sẽ bị xoá khỏi hệ thống.`}
                confirmText="Xoá vĩnh viễn"
                variant="danger"
            />
        </div>
    )
}
