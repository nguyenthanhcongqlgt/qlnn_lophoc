import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info'
    className?: string
}

const variantStyles = {
    default: 'bg-slate-50 text-slate-600 border border-slate-200/60',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/40',
    danger: 'bg-red-50 text-red-700 border border-red-200/40',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/40',
    info: 'bg-blue-50 text-blue-700 border border-blue-200/40',
}

export function Badge({ children, variant = 'default', className, ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-semibold transition-colors",
                variantStyles[variant],
                className
            )}
            {...props}
        >
            {children}
        </span>
    )
}

