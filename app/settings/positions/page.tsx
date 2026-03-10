"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { getPositions, addPosition, updatePosition, deletePosition } from '@/lib/storage'
import { Position } from '@/types'
import { Plus, Pencil, Trash2, UserCheck, Shield, ShieldOff, Info } from 'lucide-react'

interface PositionForm {
    name: string
    canCreateLog: boolean
}

export default function PositionsSettingsPage() {
    const [positions, setPositions] = useState<Position[]>([])
    const [ready, setReady] = useState(false)
    const [showDialog, setShowDialog] = useState(false)
    const [editingPosition, setEditingPosition] = useState<Position | null>(null)
    const [form, setForm] = useState<PositionForm>({ name: '', canCreateLog: false })
    const [deleteTarget, setDeleteTarget] = useState<Position | null>(null)
    const { showToast, ToastComponent } = useToast()

    useEffect(() => {
        refresh()
    }, [])

    const refresh = async () => {
        const data = await getPositions()
        setPositions(data)
        setReady(true)
    }

    const openAdd = () => {
        setEditingPosition(null)
        setForm({ name: '', canCreateLog: false })
        setShowDialog(true)
    }

    const openEdit = (p: Position) => {
        setEditingPosition(p)
        setForm({ name: p.name, canCreateLog: p.canCreateLog })
        setShowDialog(true)
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            showToast('Tên chức vụ không được để trống!', 'error')
            return
        }
        // Check duplicate name
        const duplicate = positions.find(p =>
            p.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
            p.id !== editingPosition?.id
        )
        if (duplicate) {
            showToast('Chức vụ này đã tồn tại!', 'error')
            return
        }

        if (editingPosition) {
            await updatePosition(editingPosition.id, form.name.trim(), form.canCreateLog)
            showToast('Đã cập nhật chức vụ!')
        } else {
            const id = `pos_${Date.now()}`
            await addPosition(id, form.name.trim(), form.canCreateLog)
            showToast('Đã thêm chức vụ mới!')
        }
        setShowDialog(false)
        refresh()
    }

    const handleDelete = async (p: Position) => {
        await deletePosition(p.id)
        showToast('Đã xoá chức vụ!', 'info')
        setDeleteTarget(null)
        refresh()
    }

    if (!ready) return null

    const logAllowedCount = positions.filter(p => p.canCreateLog).length

    return (
        <div className="space-y-6">
            {ToastComponent}

            <Card className="animate-slide-up border-indigo-200">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-indigo-500" />
                            Quản lý Chức vụ
                        </CardTitle>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Thêm chức vụ
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Info banner */}
                    <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 flex gap-2 text-sm text-blue-700">
                        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                        <div>
                            <p>Thiết lập danh sách chức vụ trong lớp và quyền lập phiếu nề nếp.</p>
                            <p className="text-xs text-blue-500 mt-0.5">
                                Chức vụ có quyền lập phiếu: <strong>{logAllowedCount}/{positions.length}</strong>
                            </p>
                        </div>
                    </div>

                    {positions.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Chưa có chức vụ nào. Nhấn "Thêm chức vụ" để tạo.</p>
                    ) : (
                        <div className="space-y-2">
                            {positions.map(pos => (
                                <div
                                    key={pos.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${pos.canCreateLog
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-200 text-slate-500'
                                            }`}>
                                            {pos.canCreateLog
                                                ? <Shield className="h-3 w-3" />
                                                : <ShieldOff className="h-3 w-3" />
                                            }
                                            {pos.canCreateLog ? 'Được lập phiếu' : 'Không lập phiếu'}
                                        </div>
                                        <span className="text-sm font-medium text-slate-800">{pos.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(pos)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Sửa"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(pos)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            title="Xoá"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                        💡 Chức vụ được dùng để gán cho học sinh và kiểm soát quyền lập phiếu nề nếp
                    </p>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog
                open={showDialog}
                onClose={() => setShowDialog(false)}
                title={editingPosition ? 'Sửa chức vụ' : 'Thêm chức vụ mới'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="input-label">Tên chức vụ</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="input-field"
                            placeholder="VD: Lớp trưởng, Bí thư, Tổ trưởng..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                        />
                    </div>

                    <div>
                        <label className="input-label flex items-center gap-1.5 mb-2">
                            <Shield className="h-3.5 w-3.5 text-emerald-500" />
                            Quyền lập phiếu nề nếp
                        </label>
                        <div className="flex gap-3">
                            <label className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.canCreateLog
                                ? 'border-emerald-400 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}>
                                <input
                                    type="radio"
                                    name="canCreateLog"
                                    checked={form.canCreateLog}
                                    onChange={() => setForm({ ...form, canCreateLog: true })}
                                    className="text-emerald-600 border-slate-300 focus:ring-emerald-600"
                                />
                                <div>
                                    <p className={`text-sm font-medium ${form.canCreateLog ? 'text-emerald-800' : 'text-slate-700'}`}>
                                        Được phép
                                    </p>
                                    <p className="text-[10px] text-slate-400">Có thể tạo phiếu vi phạm/việc tốt</p>
                                </div>
                            </label>
                            <label className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${!form.canCreateLog
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}>
                                <input
                                    type="radio"
                                    name="canCreateLog"
                                    checked={!form.canCreateLog}
                                    onChange={() => setForm({ ...form, canCreateLog: false })}
                                    className="text-slate-600 border-slate-300 focus:ring-slate-600"
                                />
                                <div>
                                    <p className={`text-sm font-medium ${!form.canCreateLog ? 'text-slate-800' : 'text-slate-700'}`}>
                                        Không được phép
                                    </p>
                                    <p className="text-[10px] text-slate-400">Chỉ xem, không tạo phiếu</p>
                                </div>
                            </label>
                        </div>
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
                            {editingPosition ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Delete Confirm Dialog */}
            {deleteTarget && (
                <Dialog
                    open={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Xác nhận xoá chức vụ"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Bạn có chắc muốn xoá chức vụ <strong>"{deleteTarget.name}"</strong>?
                            Học sinh đang giữ chức vụ này sẽ không bị ảnh hưởng (tên chức vụ vẫn được lưu trên hồ sơ).
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={() => handleDelete(deleteTarget)}
                                className="px-5 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                                Xoá
                            </button>
                        </div>
                    </div>
                </Dialog>
            )}
        </div>
    )
}
