"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { BookOpen, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { getClassInfo } from '@/lib/storage'
import { ClassInfo } from '@/types'

export default function LoginPage() {
    const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { login, user } = useAuth()
    const router = useRouter()

    // If already logged in, redirect (inside useEffect to avoid setState-during-render)
    useEffect(() => {
        if (user) {
            router.replace('/')
        }
    }, [user, router])

    useEffect(() => {
        getClassInfo().then(setClassInfo)
    }, [])

    if (user) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!username.trim() || !password.trim()) {
            setError('Vui lòng nhập đầy đủ thông tin')
            return
        }

        setIsSubmitting(true)
        try {
            const success = await login(username.trim(), password)
            if (success) {
                router.replace('/')
            } else {
                setError('Sai tên đăng nhập hoặc mật khẩu')
                setIsSubmitting(false)
            }
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #0f172a 100%)' }}>

            <div className="w-full max-w-sm animate-slide-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    {classInfo?.logo ? (
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-white shadow-lg shadow-indigo-500/30 overflow-hidden">
                            <img src={classInfo.logo} alt="Logo trường" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                            <BookOpen className="h-8 w-8 text-white" />
                        </div>
                    )}

                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                        {classInfo?.schoolName || 'Sổ Nề Nếp Điện Tử'}
                    </h1>
                    {classInfo?.name && (
                        <p className="text-indigo-200 font-medium mt-1 text-lg">
                            {classInfo.name}
                        </p>
                    )}
                    <p className="text-indigo-300/60 text-sm mt-1">Đăng nhập để tiếp tục</p>
                </div>

                {/* Login Form Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-medium text-indigo-200 mb-1.5">
                                Tên đăng nhập
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => { setUsername(e.target.value); setError('') }}
                                placeholder="VD: gvcn hoặc HS001"
                                className="w-full h-11 rounded-xl bg-white/10 border border-white/15 px-4 text-white placeholder:text-indigo-300/40 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 outline-none transition-all text-sm"
                                autoComplete="username"
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-indigo-200 mb-1.5">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError('') }}
                                    placeholder="••••••"
                                    className="w-full h-11 rounded-xl bg-white/10 border border-white/15 px-4 pr-11 text-white placeholder:text-indigo-300/40 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 outline-none transition-all text-sm"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300/50 hover:text-indigo-200 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-300 text-xs bg-red-500/15 rounded-lg px-3 py-2 animate-fade-in">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-60"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="h-4 w-4" />
                                    Đăng nhập
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Help text */}
                <p className="text-center text-[11px] text-indigo-300/40 mt-4">
                    Mật khẩu mặc định: <span className="text-indigo-300/60 font-mono">123456</span>
                </p>
            </div>
        </div>
    )
}
