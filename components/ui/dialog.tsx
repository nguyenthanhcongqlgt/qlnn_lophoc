"use client"

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
    open: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    className?: string
    maxWidth?: string
}

export function Dialog({ open, onClose, title, children, className, maxWidth = 'max-w-lg' }: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEsc)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handleEsc)
            document.body.style.overflow = ''
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <>
            <div className="dialog-overlay" onClick={onClose} />
            <div className={cn("dialog-content w-[92vw]", maxWidth, className)} ref={dialogRef}>
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    {/* Body */}
                    <div className="px-6 py-4">
                        {children}
                    </div>
                </div>
            </div>
        </>
    )
}

// ── Confirm Dialog ──
interface ConfirmDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Huỷ',
    variant = 'danger'
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
            <p className="text-sm text-slate-600 mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    {cancelText}
                </button>
                <button
                    onClick={() => { onConfirm(); onClose(); }}
                    className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors",
                        variant === 'danger'
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-indigo-500 hover:bg-indigo-600'
                    )}
                >
                    {confirmText}
                </button>
            </div>
        </Dialog>
    )
}
