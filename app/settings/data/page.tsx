"use client"

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
    resetAllData, importStudents
} from '@/lib/storage'
import { Database, FileSpreadsheet, Download, Upload, RotateCcw, Save, ArchiveRestore } from 'lucide-react'
import { downloadStudentTemplate, parseStudentExcel } from '@/lib/excel-templates'

export default function DataSettingsPage() {
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [importPreview, setImportPreview] = useState<{ type: 'students'; data: any[]; errors: string[] } | null>(null)
    const studentFileRef = useRef<HTMLInputElement>(null)

    // Backup & Restore
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
    const [restoreFile, setRestoreFile] = useState<File | null>(null)
    const restoreFileRef = useRef<HTMLInputElement>(null)

    const { showToast, ToastComponent } = useToast()

    const handleReset = async () => {
        try {
            await resetAllData()
            showToast('Đã xoá toàn bộ dữ liệu thành công!', 'success')
            setShowResetConfirm(false)
            setTimeout(() => {
                window.location.href = '/settings/data' // Hard refresh
            }, 1000)
        } catch (e) {
            console.error('Lỗi khi xoá dữ liệu:', e)
            showToast('Đã xảy ra lỗi khi xoá dữ liệu', 'error')
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        e.target.value = '' // reset input
        const result = await parseStudentExcel(file)
        setImportPreview({ type: 'students', data: result.data, errors: result.errors })
    }

    const handleConfirmImport = async () => {
        if (!importPreview || importPreview.data.length === 0) return
        await importStudents(importPreview.data)
        showToast(`Đã import ${importPreview.data.length} học sinh!`)
        setImportPreview(null)
        setTimeout(() => {
            window.location.reload()
        }, 1500)
    }

    const handleBackup = () => {
        window.location.href = '/api/backup'
        showToast('Đang tải xuống file sao lưu...', 'info')
    }

    const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        e.target.value = '' // reset
        setRestoreFile(file)
        setShowRestoreConfirm(true)
    }

    const handleConfirmRestore = async () => {
        if (!restoreFile) return
        try {
            const formData = await restoreFile.text()
            const payload = JSON.parse(formData)

            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to restore')

            showToast(json.message || 'Đã phục hồi dữ liệu thành công!', 'success')
            setShowRestoreConfirm(false)
            setRestoreFile(null)

            setTimeout(() => {
                window.location.href = '/settings/data' // Hard refresh
            }, 1000)
        } catch (e: any) {
            console.error('Lỗi khi phục hồi:', e)
            showToast(e.message || 'Lỗi đọc file phục hồi.', 'error')
            setShowRestoreConfirm(false)
            setRestoreFile(null)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {ToastComponent}

            <input ref={studentFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />

            <Card className="animate-slide-up">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                        Import danh sách học sinh
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-500 mb-4">
                        Tải file mẫu, điền danh sách học sinh, rồi import vào hệ thống.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => downloadStudentTemplate()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            Tải file mẫu
                        </button>
                        <button
                            onClick={() => studentFileRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                        >
                            <Upload className="h-4 w-4" />
                            Import học sinh
                        </button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Save className="h-4 w-4 text-indigo-500" />
                            Sao lưu dữ liệu
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500 mb-4 h-10">
                            Tải file chứa toàn bộ dữ liệu hiện tại về máy tính để dự phòng.
                        </p>
                        <button
                            onClick={handleBackup}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 text-sm font-medium hover:bg-indigo-100 transition-colors w-full justify-center"
                        >
                            <Download className="h-4 w-4" />
                            Tải xuống bản sao lưu (.json)
                        </button>
                    </CardContent>
                </Card>

                <Card className="animate-slide-up" style={{ animationDelay: '75ms' }}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                            <ArchiveRestore className="h-4 w-4 text-amber-500" />
                            Phục hồi dữ liệu
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500 mb-4 h-10">
                            Khôi phục hệ thống từ một file sao lưu .json đã lưu trước đó.
                        </p>
                        <input ref={restoreFileRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFileSelect} />
                        <button
                            onClick={() => restoreFileRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors w-full justify-center"
                        >
                            <Upload className="h-4 w-4" />
                            Tải lên bản sao lưu (.json)
                        </button>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-red-200 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-red-600">
                        <Database className="h-4 w-4 text-red-500" />
                        Vùng nguy hiểm
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                        Xoá toàn bộ dữ liệu trong hệ thống. <strong>Tất cả dữ liệu hiện tại (Học sinh, vi phạm, việc tốt, ...) sẽ bị xoá vĩnh viễn. Khi chọn nút này sẽ xóa toàn bộ dữ liệu, kể cả dữ liệu mẫu, kể cả danh sách Học sinh được uỷ quyền duyệt phiếu (Ban Cán Sự).</strong>
                    </p>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Xoá toàn bộ dữ liệu
                    </button>
                </CardContent>
            </Card>

            <ConfirmDialog
                open={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={handleReset}
                title="Xác nhận xoá toàn bộ dữ liệu"
                message="Tất cả dữ liệu (bao gồm cả danh sách lớp, vi phạm, việc tốt, và quyền duyệt phiếu của Ban Cán Sự) sẽ bị xoá sạch. Thao tác này không thể hoàn tác!"
                confirmText="Xoá dữ liệu"
                variant="danger"
            />

            <ConfirmDialog
                open={showRestoreConfirm}
                onClose={() => {
                    setShowRestoreConfirm(false)
                    setRestoreFile(null)
                }}
                onConfirm={handleConfirmRestore}
                title="Cảnh báo: Phục hồi Cơ sở dữ liệu"
                message={`Bạn chuẩn bị phục hồi dữ liệu từ file "${restoreFile?.name}". Dữ liệu hiện tại của hệ thống sẽ bị ghi đè và thay thế HOÀN TOÀN bằng dữ liệu trong file này. Bạn có chắc chắn muốn tiếp tục?`}
                confirmText="Xác nhận phục hồi"
                variant="danger"
            />

            <Dialog
                open={!!importPreview}
                onClose={() => setImportPreview(null)}
                title={`📊 Xem trước dữ liệu (${importPreview?.data.length || 0} học sinh)`}
                maxWidth="max-w-3xl"
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
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 border-b">Mã</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 border-b">Họ Tên</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 border-b">Ngày sinh</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 border-b">Tổ</th>
                                            <th className="px-4 py-2 text-center font-medium text-slate-500 border-b">Điểm Đầu</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 border-b">Ghi Chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {importPreview.data.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 font-mono text-xs">{item.id || '-'}</td>
                                                <td className="px-4 py-2 font-medium">{item.name}</td>
                                                <td className="px-4 py-2 text-slate-600">{item.dateOfBirth || '-'}</td>
                                                <td className="px-4 py-2">{item.team}</td>
                                                <td className="px-4 py-2 text-center">{item.initialScore}</td>
                                                <td className="px-4 py-2 text-slate-500 truncate max-w-[150px]">{item.note}</td>
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
