"use client"

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
    initializeData, getViolationTypes, getAchievementTypes,
    addIncidentType, updateIncidentType, deleteIncidentType,
    importIncidentTypes
} from '@/lib/storage'
import { IncidentType } from '@/types'
import { AlertTriangle, Award, Plus, Pencil, Trash2, Download, Upload } from 'lucide-react'
import { downloadIncidentTemplate, parseIncidentExcel } from '@/lib/excel-templates'

function IncidentRow({ item, type, onEdit, onDelete }: { item: IncidentType, type: 'violation' | 'achievement', onEdit: () => void, onDelete: () => void }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group">
            <div className="flex items-center gap-3">
                <Badge variant={type === 'violation' ? 'danger' : 'success'}>
                    {item.point > 0 ? '+' : ''}{item.point}đ
                </Badge>
                <span className="text-sm font-medium text-slate-700">{item.content}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onEdit} className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}

export default function IncidentsSettingsPage() {
    const [violations, setViolations] = useState<IncidentType[]>([])
    const [achievements, setAchievements] = useState<IncidentType[]>([])
    const [ready, setReady] = useState(false)

    // Edit dialogs
    const [showIncidentDialog, setShowIncidentDialog] = useState(false)
    const [editingIncident, setEditingIncident] = useState<IncidentType | null>(null)
    const [incidentDialogType, setIncidentDialogType] = useState<'violation' | 'achievement'>('violation')
    const [formContent, setFormContent] = useState('')
    const [formPoint, setFormPoint] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<{ item: IncidentType; type: 'violation' | 'achievement' } | null>(null)

    // Excel import
    const violationFileRef = useRef<HTMLInputElement>(null)
    const achievementFileRef = useRef<HTMLInputElement>(null)
    const [importPreview, setImportPreview] = useState<{ type: 'violations' | 'achievements'; data: any[]; errors: string[] } | null>(null)

    const { showToast, ToastComponent } = useToast()

    useEffect(() => {
        initializeData()
        refresh()
    }, [])

    const refresh = async () => {
        const [v, a] = await Promise.all([
            getViolationTypes(),
            getAchievementTypes(),
        ])
        setViolations(v)
        setAchievements(a)
        setReady(true)
    }

    const openAddIncident = (type: 'violation' | 'achievement') => {
        setEditingIncident(null)
        setIncidentDialogType(type)
        setFormContent('')
        setFormPoint(type === 'violation' ? -2 : 2)
        setShowIncidentDialog(true)
    }

    const openEditIncident = (item: IncidentType, type: 'violation' | 'achievement') => {
        setEditingIncident(item)
        setIncidentDialogType(type)
        setFormContent(item.content)
        setFormPoint(item.point)
        setShowIncidentDialog(true)
    }

    const handleSaveIncident = async () => {
        if (!formContent.trim()) return

        if (editingIncident) {
            await updateIncidentType(editingIncident.id, formContent.trim(), formPoint)
        } else {
            const id = `${incidentDialogType === 'violation' ? 'V' : 'A'}${Date.now()}`
            await addIncidentType({
                id,
                content: formContent.trim(),
                point: formPoint,
                type: incidentDialogType,
            })
        }

        setShowIncidentDialog(false)
        showToast(editingIncident ? 'Đã cập nhật!' : 'Đã thêm mới!')
        refresh()
    }

    const handleDeleteIncident = async () => {
        if (!deleteTarget) return
        await deleteIncidentType(deleteTarget.item.id)
        setDeleteTarget(null)
        showToast('Đã xoá!', 'info')
        refresh()
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'violations' | 'achievements') => {
        const file = e.target.files?.[0]
        if (!file) return
        e.target.value = ''

        const logType = type === 'violations' ? 'violation' : 'achievement'
        const result = await parseIncidentExcel(file, logType)
        setImportPreview({ type, data: result.data, errors: result.errors })
    }

    const handleConfirmImport = async () => {
        if (!importPreview || importPreview.data.length === 0) return
        await importIncidentTypes(importPreview.data)
        showToast(`Đã import ${importPreview.data.length} ${importPreview.type === 'violations' ? 'vi phạm' : 'việc tốt'}!`)
        setImportPreview(null)
        refresh()
    }

    if (!ready) return null

    return (
        <div className="space-y-6">
            {ToastComponent}

            <input ref={violationFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFileSelect(e, 'violations')} />
            <input ref={achievementFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFileSelect(e, 'achievements')} />

            <Card className="animate-slide-up">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Danh sách loại vi phạm ({violations.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadIncidentTemplate('violation')}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-400 text-xs hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Tải file mẫu"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Mẫu</span>
                            </button>
                            <button
                                onClick={() => violationFileRef.current?.click()}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-400 text-xs hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Import từ Excel"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Import</span>
                            </button>
                            <button
                                onClick={() => openAddIncident('violation')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Thêm
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {violations.map(item => (
                            <IncidentRow
                                key={item.id}
                                item={item}
                                type="violation"
                                onEdit={() => openEditIncident(item, 'violation')}
                                onDelete={() => setDeleteTarget({ item, type: 'violation' })}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Award className="h-4 w-4 text-emerald-500" />
                            Danh sách loại việc tốt ({achievements.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadIncidentTemplate('achievement')}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-400 text-xs hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Tải file mẫu"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Mẫu</span>
                            </button>
                            <button
                                onClick={() => achievementFileRef.current?.click()}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-400 text-xs hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Import từ Excel"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Import</span>
                            </button>
                            <button
                                onClick={() => openAddIncident('achievement')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Thêm
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {achievements.map(item => (
                            <IncidentRow
                                key={item.id}
                                item={item}
                                type="achievement"
                                onEdit={() => openEditIncident(item, 'achievement')}
                                onDelete={() => setDeleteTarget({ item, type: 'achievement' })}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Dialogs */}
            <Dialog
                open={showIncidentDialog}
                onClose={() => setShowIncidentDialog(false)}
                title={editingIncident
                    ? `Sửa ${incidentDialogType === 'violation' ? 'vi phạm' : 'việc tốt'}`
                    : `Thêm ${incidentDialogType === 'violation' ? 'vi phạm' : 'việc tốt'} mới`
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="input-label">Nội dung</label>
                        <input
                            type="text"
                            value={formContent}
                            onChange={e => setFormContent(e.target.value)}
                            className="input-field"
                            placeholder="Mô tả nội dung..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="input-label">Điểm ({incidentDialogType === 'violation' ? 'trừ' : 'cộng'})</label>
                        <input
                            type="number"
                            value={formPoint}
                            onChange={e => setFormPoint(Number(e.target.value))}
                            className="input-field"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            {incidentDialogType === 'violation' ? 'Nhập số âm (VD: -2)' : 'Nhập số dương (VD: 2)'}
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setShowIncidentDialog(false)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={handleSaveIncident}
                            className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            {editingIncident ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </div>
                </div>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteIncident}
                title="Xoá nội dung"
                message={`Bạn có chắc chắn muốn xoá "${deleteTarget?.item.content}"?`}
                confirmText="Xoá"
            />

            <Dialog
                open={!!importPreview}
                onClose={() => setImportPreview(null)}
                title={`📊 Xem trước dữ liệu import (${importPreview?.data.length || 0} mục)`}
                maxWidth="max-w-2xl"
            >
                {importPreview && (
                    <div className="space-y-4">
                        {importPreview.errors.length > 0 && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                                <strong>Lỗi:</strong>
                                <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5">
                                    {importPreview.errors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </div>
                        )}

                        {importPreview.data.length > 0 && (
                            <div className="max-h-60 overflow-auto rounded-xl border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 border-b">Loại Nề Nếp</th>
                                            <th className="px-4 py-2 text-right font-medium text-slate-500 border-b">Điểm</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {importPreview.data.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2">{item.content}</td>
                                                <td className="px-4 py-2 text-right font-medium">
                                                    <span className={item.point > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                        {item.point > 0 ? '+' : ''}{item.point}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setImportPreview(null)}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={importPreview.data.length === 0}
                                className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                Xác nhận Import
                            </button>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    )
}
