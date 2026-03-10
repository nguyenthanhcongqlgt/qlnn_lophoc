"use client"

import { useState } from 'react'

interface ToastProps {
    message: string
    type?: 'success' | 'error' | 'info'
    onClose: () => void
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
    const bgColors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-indigo-500',
    }

    return (
        <div className="toast-container">
            <div className={`animate-toast ${bgColors[type]} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium`}>
                <span>{type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
                <span>{message}</span>
                <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">✕</button>
            </div>
        </div>
    )
}

// Hook for easy toast usage
export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const ToastComponent = toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    ) : null

    return { showToast, ToastComponent }
}
