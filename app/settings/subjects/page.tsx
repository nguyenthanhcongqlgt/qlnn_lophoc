"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
    getSubjects, addSubject, updateSubject, deleteSubject, getLogs
} from '@/lib/storage'
import { Subject, LogEntry } from '@/types'
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function SubjectsSettingsPage() {
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [ready, setReady] = useState(false)

    // Edit dialogs
    const [showDialog, setShowDialog] = useState(false)
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
    const [formName, setFormName] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)

    const { showToast, ToastComponent } = useToast()
    const { can } = useAuth()

    useEffect(() => {
        refresh()
    }, [])

    const refresh = async () => {
        const [subjectsData, logsData] = await Promise.all([
            getSubjects(),
            getLogs()
        ]);
        setSubjects(subjectsData)
        setLogs(logsData)
        setReady(true)
    }

    const usedSubjects = new Set(logs.map(log => log.subject).filter(Boolean));

    const openAdd = () => {
        setEditingSubject(null)
        setFormName('')
        setShowDialog(true)
    }

    const openEdit = (item: Subject) => {
        setEditingSubject(item)
        setFormName(item.name)
        setShowDialog(true)
    }

    const handleSave = async () => {
        if (!formName.trim()) {
            showToast('Tên môn học không được để trống!', 'error')
            return
        }

        if (editingSubject) {
            await updateSubject(editingSubject.id, formName.trim())
            showToast('Đã cập nhật môn học!')
        } else {
            const newId = `SUB_${Date.now()}`
            await addSubject(newId, formName.trim())
            showToast('Đã thêm môn học mới!')
        }

        setShowDialog(false)
        refresh()
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteSubject(deleteTarget.id)
            setDeleteTarget(null)
            showToast('Đã xoá môn học!', 'info')
            refresh()
        } catch (error: any) {
            setDeleteTarget(null)
            showToast(error.message, 'error')
        }
    }

    if (!ready) return null

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {ToastComponent}

            <Card className="animate-slide-up">
                <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-indigo-500" />
                            Danh sách Môn học ({subjects.length})
                        </CardTitle>
                        {can('view_settings') && (
                            <button
                                onClick={openAdd}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Thêm môn học
                            </button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!subjects || subjects.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-6">Chưa có môn học nào. Nhấn "Thêm môn học" để tạo.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {subjects.map(item => (
                                <div key={item.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm transition-all group">
                                    <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
                                    {can('view_settings') && (
                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Chỉnh sửa">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => !usedSubjects.has(item.name) && setDeleteTarget(item)}
                                                disabled={usedSubjects.has(item.name)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                                title={usedSubjects.has(item.name) ? "Không thể xoá vì đã có học sinh ghi nhận" : "Xoá"}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={showDialog}
                onClose={() => setShowDialog(false)}
                title={editingSubject ? 'Sửa môn học' : 'Thêm môn học mới'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="input-label">Tên môn học</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            className="input-field"
                            placeholder="VD: Toán, Ngữ văn..."
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setShowDialog(false)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            {editingSubject ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </div>
                </div>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Xoá môn học"
                message={`Bạn có chắc chắn muốn xoá môn "${deleteTarget?.name}"?`}
                confirmText="Xoá"
            />
        </div>
    )
}
