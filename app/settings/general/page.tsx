"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
    initializeData, getClassInfo, saveClassInfo,
    getGradeThresholds, saveGradeThresholds,
    createNewSchoolYear, getStudents
} from '@/lib/storage'
import { ClassInfo, Semester, GradeThresholds, DEFAULT_GRADE_THRESHOLDS, getConductGrade, Student, ThresholdSet } from '@/types'
import { Plus, Pencil, Trash2, School, Save, GraduationCap, Calendar, Upload, X, ShieldCheck, UserCog, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { changeUsername, changeAvatar } from '@/lib/auth'

// Helper function to read file as base64
const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export default function GeneralSettingsPage() {
    const [classInfo, setClassInfo] = useState<ClassInfo>({ schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [], authorizedStudents: [] })
    const [gradeThresholds, setGradeThresholds] = useState<GradeThresholds>(DEFAULT_GRADE_THRESHOLDS)
    const [students, setStudents] = useState<Student[]>([])
    const [ready, setReady] = useState(false)

    // New School Year
    const [showNewYearDialog, setShowNewYearDialog] = useState(false)
    const [newYearValue, setNewYearValue] = useState('')

    // Semester management
    const [showSemesterDialog, setShowSemesterDialog] = useState(false)
    const [editingSemester, setEditingSemester] = useState<Semester | null>(null)
    const [semesterForm, setSemesterForm] = useState({ name: '', startDate: '', endDate: '' })

    // Change Account Info
    const { user, logout } = useAuth()
    const [usernameForm, setUsernameForm] = useState('')
    const [avatarForm, setAvatarForm] = useState<string | null>(null)

    const { showToast, ToastComponent } = useToast()

    useEffect(() => {
        initializeData()
        refresh()
    }, [])

    const refresh = async () => {
        const [ci, gt, studentsData] = await Promise.all([
            getClassInfo(),
            getGradeThresholds(),
            getStudents(),
        ])
        if (!ci.authorizedStudents) ci.authorizedStudents = []
        setClassInfo(ci)
        setGradeThresholds(gt)
        setStudents(studentsData)
        setReady(true)
    }

    useEffect(() => {
        if (user) {
            setUsernameForm(user.username)
            setAvatarForm(user.avatar || null)
        }
    }, [user])

    const handleSaveClassInfo = async () => {
        await saveClassInfo(classInfo)
        showToast('Đã lưu thông tin lớp!')
    }

    const handleSaveThresholds = async () => {
        const { weekly, monthly, semester } = gradeThresholds;
        const isValid = (t: ThresholdSet) => t.tot > t.kha && t.kha > t.dat;

        if (!isValid(weekly) || !isValid(monthly) || !isValid(semester)) {
            showToast('Lỗi: Mức điểm Tốt phải lớn hơn Khá, và Khá phải lớn hơn Đạt ở tất cả các mục!', 'error')
            return
        }
        await saveGradeThresholds(gradeThresholds)
        showToast('Đã lưu mức xếp loại rèn luyện!')
    }

    const handleSaveAccount = async () => {
        if (!user) return;
        let usernameChanged = false;
        let avatarChanged = false;

        if (user.role === 'teacher' && usernameForm.trim() && usernameForm.trim() !== user.username) {
            const success = await changeUsername(user.id, usernameForm.trim());
            if (!success) {
                showToast('Đổi tên đăng nhập thất bại. Tên đăng nhập này có thể đã tồn tại!', 'error');
                return;
            }
            usernameChanged = true;
        }

        if (avatarForm !== (user.avatar || null)) {
            const success = await changeAvatar(user.id, avatarForm);
            if (!success) {
                showToast('Không thể cập nhật ảnh đại diện!', 'error');
                return;
            }
            avatarChanged = true;
        }

        if (usernameChanged || avatarChanged) {
            showToast('Đã cập nhật tài khoản thành công! Bạn sẽ bị đăng xuất để đăng nhập lại.');
            setTimeout(() => {
                logout();
                window.location.href = '/login';
            }, 3000);
        } else {
            showToast('Không có thay đổi nào.', 'info');
        }
    }

    const handleCreateNewYear = async () => {
        if (!newYearValue.trim()) return
        await createNewSchoolYear(newYearValue.trim())
        showToast(`Đã tạo năm học ${newYearValue.trim()}! Dữ liệu đã được khôi phục.`)
        setShowNewYearDialog(false)
        setNewYearValue('')
        refresh()
    }

    const openAddSemester = () => {
        setEditingSemester(null)
        setSemesterForm({ name: '', startDate: '', endDate: '' })
        setShowSemesterDialog(true)
    }

    const openEditSemester = (s: Semester) => {
        setEditingSemester(s)
        setSemesterForm({ name: s.name, startDate: s.startDate, endDate: s.endDate })
        setShowSemesterDialog(true)
    }

    const handleSaveSemester = async () => {
        if (!semesterForm.name || !semesterForm.startDate || !semesterForm.endDate) {
            showToast('Vui lòng điền đầy đủ thông tin!', 'error')
            return
        }
        const updated = [...(classInfo.semesters || [])]
        if (editingSemester) {
            const idx = updated.findIndex(s => s.id === editingSemester.id)
            if (idx >= 0) updated[idx] = { ...editingSemester, ...semesterForm }
        } else {
            updated.push({ id: `SEM${Date.now()}`, ...semesterForm })
        }
        const newInfo = { ...classInfo, semesters: updated }
        setClassInfo(newInfo)
        await saveClassInfo(newInfo)
        setShowSemesterDialog(false)
        showToast(editingSemester ? 'Đã cập nhật học kì!' : 'Đã thêm học kì!')
    }

    const handleDeleteSemester = async (id: string) => {
        const updated = (classInfo.semesters || []).filter(s => s.id !== id)
        const newInfo = { ...classInfo, semesters: updated }
        setClassInfo(newInfo)
        await saveClassInfo(newInfo)
        showToast('Đã xoá học kì!', 'info')
    }

    if (!ready) return null

    return (
        <div className="space-y-6">
            {ToastComponent}

            <Card className="animate-slide-up border-indigo-200">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-indigo-500" />
                            Năm học & Học kì
                        </CardTitle>
                        <button
                            onClick={() => {
                                const year = new Date().getFullYear()
                                setNewYearValue(`${year}-${year + 1}`)
                                setShowNewYearDialog(true)
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Tạo năm học mới
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                        <p className="text-sm font-medium text-indigo-800">
                            Năm học hiện tại: <span className="text-indigo-600 font-bold">{classInfo.schoolYear || '—'}</span>
                        </p>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700">Danh sách học kì</h3>
                        <button
                            onClick={openAddSemester}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                            <Plus className="h-3 w-3" />
                            Thêm HK
                        </button>
                    </div>

                    {(!classInfo.semesters || classInfo.semesters.length === 0) ? (
                        <p className="text-sm text-slate-400 italic">Chưa có học kì nào. Nhấn "Thêm HK" để tạo.</p>
                    ) : (
                        <div className="space-y-2">
                            {classInfo.semesters.map(sem => (
                                <div key={sem.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group">
                                    <div>
                                        <span className="text-sm font-medium text-slate-700">{sem.name}</span>
                                        <span className="text-xs text-slate-400 ml-2">
                                            {sem.startDate} → {sem.endDate}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditSemester(sem)} className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteSemester(sem.id)} className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-slate-400 mt-3 flex gap-1.5">💡 Tuần học bắt đầu từ thứ 2 đến chủ nhật</p>
                </CardContent>
            </Card>

            <Card className="animate-slide-up">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <School className="h-4 w-4 text-indigo-500" />
                        Thông tin lớp học
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="input-label">Tên trường</label>
                            <input
                                type="text"
                                value={classInfo.schoolName}
                                onChange={e => setClassInfo({ ...classInfo, schoolName: e.target.value })}
                                className="input-field"
                                placeholder="THPT Quất Lâm"
                            />
                        </div>
                        <div>
                            <label className="input-label">Tên lớp</label>
                            <input
                                type="text"
                                value={classInfo.name}
                                onChange={e => setClassInfo({ ...classInfo, name: e.target.value })}
                                className="input-field"
                                placeholder="10A1"
                            />
                        </div>
                        <div>
                            <label className="input-label">Năm học</label>
                            <input
                                type="text"
                                value={classInfo.schoolYear}
                                onChange={e => setClassInfo({ ...classInfo, schoolYear: e.target.value })}
                                className="input-field"
                                placeholder="2025 - 2026"
                            />
                        </div>
                        <div>
                            <label className="input-label">GVCN</label>
                            <input
                                type="text"
                                value={classInfo.teacherName}
                                onChange={e => setClassInfo({ ...classInfo, teacherName: e.target.value })}
                                className="input-field"
                                placeholder="Nguyễn Văn A"
                            />
                        </div>
                        <div>
                            <label className="input-label" title="Số lượng vi phạm trong 1 tuần để hiển thị cảnh báo ở trang chủ">Cảnh báo vi phạm tuần</label>
                            <input
                                type="number"
                                value={classInfo.alertThreshold ?? 2}
                                onChange={e => setClassInfo({ ...classInfo, alertThreshold: Number(e.target.value) })}
                                className="input-field"
                                placeholder="2"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Số vi phạm/tuần để hiện cảnh báo đỏ ngoài Bảng tin.</p>
                        </div>
                        <div>
                            <label className="input-label" title="3 mốc số lượng vi phạm để đổi màu heatmap (vd: 1,3,5)">Mốc Heatmap</label>
                            <input
                                type="text"
                                value={(classInfo.heatmapThresholds || [1, 3, 5]).join(',')}
                                onChange={e => {
                                    const parts = e.target.value.split(',').map(n => Number(n.trim())).filter(n => !isNaN(n));
                                    if (parts.length === 3) {
                                        setClassInfo({ ...classInfo, heatmapThresholds: parts });
                                    } else {
                                        setClassInfo({ ...classInfo, heatmapThresholds: classInfo.heatmapThresholds || [1, 3, 5] });
                                    }
                                }}
                                className="input-field"
                                placeholder="1,3,5"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                3 mốc vi phạm để đổi màu: <span className="text-emerald-500">Màu nhạt (1)</span>, <span className="text-emerald-600">Màu vừa (3)</span>, <span className="text-emerald-700">Màu đậm (5)</span>.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100">
                        <label className="input-label flex items-center gap-1.5 mb-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Học sinh được uỷ quyền duyệt phiếu (Ban Cán Sự)
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            Những học sinh được chọn ở đây sẽ có quyền xem nút "Duyệt" và "Từ chối" đối với các phiếu chờ duyệt của lớp, tương tự giáo viên chủ nhiệm.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-[160px] overflow-y-auto">
                            {students.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Chưa có danh sách học sinh</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {students.map(student => {
                                        const isAuth = classInfo.authorizedStudents?.includes(student.id) || false
                                        return (
                                            <label key={student.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isAuth ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isAuth}
                                                    onChange={(e) => {
                                                        const current = classInfo.authorizedStudents || []
                                                        const updated = e.target.checked
                                                            ? [...current, student.id]
                                                            : current.filter(id => id !== student.id)
                                                        setClassInfo({ ...classInfo, authorizedStudents: updated })
                                                    }}
                                                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isAuth ? 'text-emerald-800' : 'text-slate-700'}`}>{student.name}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{student.team} {student.position ? `• ${student.position}` : ''}</p>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100">
                        <label className="input-label">Logo của trường (Giới hạn 2MB)</label>
                        <div className="mt-1 flex items-end gap-4">
                            {classInfo.logo ? (
                                <div className="relative border border-slate-200 rounded-xl bg-slate-50 p-2 shrink-0">
                                    <img src={classInfo.logo} alt="Logo trường" className="w-[80px] h-[80px] object-contain rounded-lg bg-white" />
                                    <button
                                        onClick={() => setClassInfo({ ...classInfo, logo: null })}
                                        className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 rounded-full text-red-500 hover:bg-red-50 shadow-sm"
                                        title="Xoá Logo"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-[80px] h-[80px] border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                                    <School className="w-6 h-6 mb-1 opacity-50" />
                                    <span className="text-[10px] font-medium">Trống</span>
                                </div>
                            )}

                            <div>
                                <input
                                    type="file"
                                    id="logo-upload"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                                showToast('Kích thước ảnh không được vượt quá 2MB', 'error')
                                                return;
                                            }
                                            try {
                                                const b64 = await readFileAsBase64(file);
                                                setClassInfo({ ...classInfo, logo: b64, printLogo: true });
                                            } catch (error) {
                                                showToast('Không thể đọc file ảnh', 'error');
                                            }
                                        }
                                    }}
                                />
                                <div className="flex items-center gap-3">
                                    <label
                                        htmlFor="logo-upload"
                                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                                    >
                                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                                        Tải ảnh lên
                                    </label>

                                    {classInfo.logo && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={classInfo.printLogo !== false}
                                                onChange={e => setClassInfo({ ...classInfo, printLogo: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                            />
                                            <span className="text-sm font-medium text-slate-700">In logo lên báo cáo</span>
                                        </label>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2 max-w-[250px]">Đề xuất dùng ảnh dạng vuông (PNG có nền trong suốt). Tối đa: 2MB.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveClassInfo}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        Lưu thông tin
                    </button>
                </CardContent>
            </Card>

            {user && (
                <Card className="animate-slide-up" style={{ animationDelay: '25ms' }}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <UserCog className="h-4 w-4 text-indigo-500" />
                            Quản lý tài khoản
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500 mb-4">
                            Cập nhật ảnh đại diện (avatar) hoặc đổi tên đăng nhập của bạn. Ảnh này sẽ hiển thị trên thanh điều hướng và các phiếu đánh giá. (Sẽ cần đăng nhập lại sau khi lưu)
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            {/* Avatar Section */}
                            <div className="shrink-0">
                                <label className="input-label mb-2 block">Ảnh đại diện (Avatar)</label>
                                <div className="flex items-end gap-3">
                                    {avatarForm ? (
                                        <div className="relative border border-slate-200 rounded-full bg-slate-50 p-1 shrink-0 shadow-sm">
                                            <img src={avatarForm} alt="Avatar" className="w-[72px] h-[72px] object-cover rounded-full bg-white" />
                                            <button
                                                onClick={() => setAvatarForm(null)}
                                                className="absolute -top-1 -right-1 p-1 bg-white border border-slate-200 rounded-full text-red-500 hover:bg-red-50 shadow-sm"
                                                title="Xoá Avatar"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-[72px] h-[72px] border-2 border-dashed border-slate-300 rounded-full bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                                            <ImageIcon className="w-6 h-6 mb-0.5 opacity-50" />
                                        </div>
                                    )}

                                    <div>
                                        <input
                                            type="file"
                                            id="avatar-upload"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    if (file.size > 2 * 1024 * 1024) {
                                                        showToast('Kích thước ảnh không vượt quá 2MB', 'error')
                                                        return;
                                                    }
                                                    try {
                                                        const b64 = await readFileAsBase64(file);
                                                        setAvatarForm(b64);
                                                    } catch (error) {
                                                        showToast('Không thể đọc ảnh', 'error');
                                                    }
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="avatar-upload"
                                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                                        >
                                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                                            Tải ảnh lên
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Username Section */}
                            <div className="flex-1 max-w-sm mt-4 sm:mt-0">
                                {user.role === 'teacher' ? (
                                    <>
                                        <label className="input-label">Tên đăng nhập hiện tại: <span className="font-bold">{user.username}</span></label>
                                        <div className="mt-2">
                                            <input
                                                type="text"
                                                value={usernameForm}
                                                onChange={e => setUsernameForm(e.target.value)}
                                                className="input-field max-w-[200px]"
                                                placeholder="Tên đăng nhập mới"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-6">
                                        <span className="font-semibold text-slate-700 block mb-1">Tài khoản: {user.username}</span>
                                        Chỉ giáo viên chủ nhiệm mới có quyền thay đổi tên đăng nhập.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={handleSaveAccount}
                                disabled={(user.role === 'teacher' && (!usernameForm.trim() || usernameForm.trim() === user.username)) && avatarForm === (user.avatar || null)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cập nhật tài khoản
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-indigo-500" />
                        Xếp loại rèn luyện
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-500 mb-4">
                        Thiết lập các mốc điểm chuẩn để hệ thống tự động xếp loại nề nếp cho học sinh theo tuần, tháng và học kì.
                    </p>

                    <div className="space-y-6">
                        {/* Weekly */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span> Xếp loại theo Tuần
                            </h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(100, gradeThresholds.weekly).bgColor} ${getConductGrade(100, gradeThresholds.weekly).color}`}>Tốt</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.weekly.tot} onChange={e => setGradeThresholds({ ...gradeThresholds, weekly: { ...gradeThresholds.weekly, tot: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(75, gradeThresholds.weekly).bgColor} ${getConductGrade(75, gradeThresholds.weekly).color}`}>Khá</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.weekly.kha} onChange={e => setGradeThresholds({ ...gradeThresholds, weekly: { ...gradeThresholds.weekly, kha: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(55, gradeThresholds.weekly).bgColor} ${getConductGrade(55, gradeThresholds.weekly).color}`}>Đạt</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.weekly.dat} onChange={e => setGradeThresholds({ ...gradeThresholds, weekly: { ...gradeThresholds.weekly, dat: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Dưới {gradeThresholds.weekly.dat} điểm → <span className="text-red-600 font-medium">Chưa đạt</span></p>
                        </div>

                        {/* Monthly */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-sky-500 rounded-full"></span> Xếp loại theo Tháng
                            </h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(100, gradeThresholds.monthly).bgColor} ${getConductGrade(100, gradeThresholds.monthly).color}`}>Tốt</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.monthly.tot} onChange={e => setGradeThresholds({ ...gradeThresholds, monthly: { ...gradeThresholds.monthly, tot: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(75, gradeThresholds.monthly).bgColor} ${getConductGrade(75, gradeThresholds.monthly).color}`}>Khá</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.monthly.kha} onChange={e => setGradeThresholds({ ...gradeThresholds, monthly: { ...gradeThresholds.monthly, kha: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(55, gradeThresholds.monthly).bgColor} ${getConductGrade(55, gradeThresholds.monthly).color}`}>Đạt</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.monthly.dat} onChange={e => setGradeThresholds({ ...gradeThresholds, monthly: { ...gradeThresholds.monthly, dat: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Dưới {gradeThresholds.monthly.dat} điểm → <span className="text-red-600 font-medium">Chưa đạt</span></p>
                        </div>

                        {/* Semester */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span> Xếp loại theo Học kì / Năm học
                            </h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(100, gradeThresholds.semester).bgColor} ${getConductGrade(100, gradeThresholds.semester).color}`}>Tốt</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.semester.tot} onChange={e => setGradeThresholds({ ...gradeThresholds, semester: { ...gradeThresholds.semester, tot: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(75, gradeThresholds.semester).bgColor} ${getConductGrade(75, gradeThresholds.semester).color}`}>Khá</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.semester.kha} onChange={e => setGradeThresholds({ ...gradeThresholds, semester: { ...gradeThresholds.semester, kha: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                                <div>
                                    <label className="input-label flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getConductGrade(55, gradeThresholds.semester).bgColor} ${getConductGrade(55, gradeThresholds.semester).color}`}>Đạt</span>
                                        ≥ điểm
                                    </label>
                                    <input type="number" value={gradeThresholds.semester.dat} onChange={e => setGradeThresholds({ ...gradeThresholds, semester: { ...gradeThresholds.semester, dat: Number(e.target.value) } })} className="input-field bg-white" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Dưới {gradeThresholds.semester.dat} điểm → <span className="text-red-600 font-medium">Chưa đạt</span></p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveThresholds}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        Lưu xếp loại
                    </button>
                </CardContent>
            </Card>

            <Dialog
                open={showNewYearDialog}
                onClose={() => setShowNewYearDialog(false)}
                title="🎓 Tạo năm học mới"
            >
                <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                        ⚠️ <strong>Lưu ý:</strong> Tạo năm học mới sẽ:
                        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
                            <li>Giữ lại danh sách học sinh (reset điểm về 100)</li>
                            <li>Xoá toàn bộ nhật ký vi phạm/việc tốt</li>
                            <li>Xoá toàn bộ điểm danh</li>
                            <li>Reset mật khẩu học sinh về 123456</li>
                        </ul>
                    </div>
                    <div>
                        <label className="input-label">Năm học mới</label>
                        <input
                            type="text"
                            value={newYearValue}
                            onChange={e => setNewYearValue(e.target.value)}
                            className="input-field"
                            placeholder="2026 - 2027"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setShowNewYearDialog(false)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={handleCreateNewYear}
                            className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            Tạo năm học mới
                        </button>
                    </div>
                </div>
            </Dialog>

            <Dialog
                open={showSemesterDialog}
                onClose={() => setShowSemesterDialog(false)}
                title={editingSemester ? 'Sửa học kì' : 'Thêm học kì mới'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="input-label">Tên học kì</label>
                        <input
                            type="text"
                            value={semesterForm.name}
                            onChange={e => setSemesterForm({ ...semesterForm, name: e.target.value })}
                            className="input-field"
                            placeholder="Học kì 1"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Ngày bắt đầu</label>
                            <input
                                type="date"
                                value={semesterForm.startDate}
                                onChange={e => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="input-label">Ngày kết thúc</label>
                            <input
                                type="date"
                                value={semesterForm.endDate}
                                onChange={e => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
                                className="input-field"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setShowSemesterDialog(false)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={handleSaveSemester}
                            className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            {editingSemester ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}
