"use client"
// Trigger deployment for Academic Year feature


import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import {
    initializeData, getStudentsWithScores, getLogs, deleteLog, getStudents, getClassInfo, getGradeThresholds, getAttendance
} from '@/lib/storage'
import { LogEntry, StudentWithScore, ClassInfo, Semester, GradeThresholds, getConductGrade, DEFAULT_GRADE_THRESHOLDS, AttendanceRecord } from '@/types'
import {
    Calendar, Download, AlertTriangle, Award, TrendingDown, Trash2,
    CalendarDays, CalendarRange, GraduationCap, X, Users, Filter, User, Printer, FileSpreadsheet, BookOpen, Contact, ChevronLeft, ChevronRight, ClipboardCheck, Sun, Moon
} from 'lucide-react'
import { sortByName } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { format, isWithinInterval, parseISO } from 'date-fns'
import Link from 'next/link'

type TimeRange = 'week' | 'month' | 'semester' | 'year' | 'custom'

// Helper: get start of current week (Monday)
function getWeekStart(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.getFullYear(), d.getMonth(), diff)
    return format(monday, 'yyyy-MM-dd')
}

// Helper: get start of current month
function getMonthStart(): string {
    const d = new Date()
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

// Helper: get semester start — now uses classInfo.semesters
// Fallback if no semesters defined
function getSemesterStartFallback(): string {
    const d = new Date()
    const month = d.getMonth()
    if (month >= 0 && month < 6) {
        return format(new Date(d.getFullYear(), 0, 15), 'yyyy-MM-dd')
    } else {
        return format(new Date(d.getFullYear(), 7, 15), 'yyyy-MM-dd')
    }
}

function getYearRange(schoolYear?: string, semesters?: Semester[]): { startDate: string; endDate: string } {
    const today = getToday()

    // 1. Try to find Semester 1 (Học kì 1)
    const sem1 = semesters?.find(s => s.name.toLowerCase().includes('1') || s.name.toLowerCase().includes('i'))
    if (sem1?.startDate) {
        return { startDate: sem1.startDate, endDate: today }
    }

    // 2. Fallback: Use September 1st
    let startYear: number
    if (schoolYear) {
        const match = schoolYear.match(/^(\d{4})/)
        if (match) {
            startYear = parseInt(match[1])
        } else {
            const d = new Date()
            startYear = d.getMonth() < 8 ? d.getFullYear() - 1 : d.getFullYear()
        }
    } else {
        const d = new Date()
        startYear = d.getMonth() < 8 ? d.getFullYear() - 1 : d.getFullYear()
    }

    const startDate = format(new Date(startYear, 8, 1), 'yyyy-MM-dd')
    const maxEnd = format(new Date(startYear + 1, 4, 31), 'yyyy-MM-dd')

    return {
        startDate,
        endDate: today > maxEnd ? maxEnd : today
    }
}

function getToday(): string {
    return format(new Date(), 'yyyy-MM-dd')
}

export default function ReportPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [students, setStudents] = useState<StudentWithScore[]>([])
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [classInfo, setClassInfo] = useState<ClassInfo>({ schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [] })
    const [thresholds, setThresholds] = useState<GradeThresholds>(DEFAULT_GRADE_THRESHOLDS)
    const [ready, setReady] = useState(false)
    const [selectedSemester, setSelectedSemester] = useState<string>('')
    const [thresholdType, setThresholdType] = useState<keyof GradeThresholds>('weekly')

    // Time range
    const [timeRange, setTimeRange] = useState<TimeRange>('week')
    const [customStart, setCustomStart] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [customEnd, setCustomEnd] = useState(getToday())

    // Team & Student & Subject filters
    const [teamFilter, setTeamFilter] = useState('')
    const [studentFilter, setStudentFilter] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('')

    // Compute unique teams
    const teams = useMemo(() => {
        const t = new Set(students.map(s => s.team))
        return Array.from(t).sort()
    }, [students])

    // Compute unique subjects
    const subjects = useMemo(() => {
        const s = new Set(logs.map(l => l.subject).filter((s): s is string => !!s))
        return Array.from(s).sort()
    }, [logs])

    const filteredStudentOptions = useMemo(() => {
        let options = students
        if (teamFilter) options = students.filter(s => s.team === teamFilter)
        return [...options].sort(sortByName)
    }, [students, teamFilter])

    const [detailType, setDetailType] = useState<'violation' | 'achievement' | null>(null)

    // Pagination
    const [logsLimit, setLogsLimit] = useState<number | 'all'>(10)
    const [logsPage, setLogsPage] = useState(1)

    const [studentsLimit, setStudentsLimit] = useState<number | 'all'>(10)
    const [studentsPage, setStudentsPage] = useState(1)

    const [deleteTarget, setDeleteTarget] = useState<LogEntry | null>(null)

    const { showToast, ToastComponent } = useToast()

    useEffect(() => {
        initializeData()
        refresh()
    }, [])

    const refresh = async () => {
        const [logsData, studentsData, classInfoData, thresholdsData, attendanceData] = await Promise.all([
            getLogs(),
            getStudentsWithScores(),
            getClassInfo(),
            getGradeThresholds(),
            getAttendance()
        ])
        setLogs(logsData)
        setStudents(studentsData.filter(s => s.status !== 'dropped_out'))
        setClassInfo(classInfoData)
        setThresholds(thresholdsData)
        setAttendance(attendanceData)
        setReady(true)

        // Select the current semester if defined, otherwise month
        if (classInfoData?.semesters && classInfoData.semesters.length > 0) {
            const today = new Date()
            const currentSemester = classInfoData.semesters.find(s => {
                if (!s.startDate || !s.endDate) return false;
                return isWithinInterval(today, { start: parseISO(s.startDate), end: parseISO(s.endDate) })
            })
            if (currentSemester) {
                // Keep the default timeRange as 'week' but prepare the selected semester ID
                setSelectedSemester(currentSemester.id)
            }
        }
    }

    const { user, can } = useAuth()

    // Compute date range based on selected time range
    const { startDate, endDate } = useMemo(() => {
        switch (timeRange) {
            case 'week':
                return { startDate: getWeekStart(), endDate: getToday() }
            case 'month':
                return { startDate: getMonthStart(), endDate: getToday() }
            case 'semester': {
                const sem = classInfo.semesters?.find(s => s.id === selectedSemester)
                if (sem) {
                    return { startDate: sem.startDate, endDate: sem.endDate }
                }
                return { startDate: getSemesterStartFallback(), endDate: getToday() }
            }
            case 'year':
                return getYearRange(classInfo.schoolYear, classInfo.semesters)
            case 'custom':
                return { startDate: customStart, endDate: customEnd }
        }
    }, [timeRange, customStart, customEnd, selectedSemester, classInfo.semesters, classInfo.schoolYear])

    // Build a set of student IDs belonging to the selected team
    const teamStudentIds = useMemo(() => {
        if (!teamFilter) return null
        return new Set(students.filter(s => s.team === teamFilter).map(s => s.id))
    }, [students, teamFilter])

    const filteredLogs = useMemo(() => {
        return logs
            .filter(l => {
                if (l.date < startDate || l.date > endDate) return false
                // Role-based filtering
                if (user?.role === 'student' && l.studentId !== user.studentId) return false
                if (user?.role === 'team_leader') {
                    const student = students.find(s => s.id === l.studentId)
                    if (student && student.team !== user.team) return false
                }
                // Team filter
                if (teamStudentIds && !teamStudentIds.has(l.studentId)) return false
                // Student filter
                if (studentFilter && l.studentId !== studentFilter) return false
                // Subject filter
                if (subjectFilter && l.subject !== subjectFilter) return false
                return true
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }, [logs, startDate, endDate, teamStudentIds, studentFilter, subjectFilter, user, students])

    // Attendance stats in date range
    const attendanceStats = useMemo(() => {
        const inRange = attendance.filter(r => r.date >= startDate && r.date <= endDate)
        const totalExcused = inRange.filter(r => r.status === 'absent_excused').length
        const totalUnexcused = inRange.filter(r => r.status === 'absent_unexcused').length
        const morningExcused = inRange.filter(r => (r.session || 'morning') === 'morning' && r.status === 'absent_excused').length
        const morningUnexcused = inRange.filter(r => (r.session || 'morning') === 'morning' && r.status === 'absent_unexcused').length
        const afternoonExcused = inRange.filter(r => r.session === 'afternoon' && r.status === 'absent_excused').length
        const afternoonUnexcused = inRange.filter(r => r.session === 'afternoon' && r.status === 'absent_unexcused').length
        const hasAfternoon = inRange.some(r => r.session === 'afternoon')
        return { totalExcused, totalUnexcused, morningExcused, morningUnexcused, afternoonExcused, afternoonUnexcused, hasAfternoon, totalAbsent: totalExcused + totalUnexcused }
    }, [attendance, startDate, endDate])

    // Summary stats
    const violationLogs = filteredLogs.filter(l => l.type === 'violation')
    const achievementLogs = filteredLogs.filter(l => l.type === 'achievement')
    const totalViolations = violationLogs.length
    const totalAchievements = achievementLogs.length
    const totalPoints = filteredLogs.reduce((sum, l) => sum + l.point, 0)

    // Per-student breakdown
    const studentBreakdown = useMemo(() => {
        const map = new Map<string, { violations: number; achievements: number; points: number; logs: LogEntry[] }>()
        filteredLogs.forEach(l => {
            const entry = map.get(l.studentId) || { violations: 0, achievements: 0, points: 0, logs: [] }
            if (l.type === 'violation') entry.violations++
            else entry.achievements++
            entry.points += l.point
            entry.logs.push(l)
            map.set(l.studentId, entry)
        })
        return map
    }, [filteredLogs])

    // Per-subject breakdown
    const subjectBreakdown = useMemo(() => {
        const map = new Map<string, { violations: number; achievements: number; points: number; logs: LogEntry[] }>()
        filteredLogs.forEach(l => {
            if (!l.subject) return;
            const entry = map.get(l.subject) || { violations: 0, achievements: 0, points: 0, logs: [] }
            if (l.type === 'violation') entry.violations++
            else entry.achievements++
            entry.points += l.point
            entry.logs.push(l)
            map.set(l.subject, entry)
        })
        return map
    }, [filteredLogs])

    const getStudentName = (id: string) => {
        return students.find(s => s.id === id)?.name || 'Không rõ'
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        await deleteLog(deleteTarget.id)
        showToast('Đã xoá bản ghi!', 'info')
        setDeleteTarget(null)
        refresh()
    }

    // Detail data for the clicked stat card
    const detailLogs = detailType
        ? filteredLogs.filter(l => l.type === detailType)
        : []

    // Group detail logs by student
    const detailByStudent = useMemo(() => {
        const map = new Map<string, LogEntry[]>()
        detailLogs.forEach(l => {
            const arr = map.get(l.studentId) || []
            arr.push(l)
            map.set(l.studentId, arr)
        })
        return Array.from(map.entries())
            .map(([studentId, logs]) => ({
                studentId,
                name: getStudentName(studentId),
                logs,
                totalPoints: logs.reduce((s, l) => s + l.point, 0),
            }))
            .sort((a, b) => a.totalPoints - b.totalPoints)
    }, [detailLogs]) // eslint-disable-line react-hooks/exhaustive-deps

    // Export Excel A4
    const exportExcel = async () => {
        try {
            const ExcelJS = await import('exceljs')
            const { saveAs } = await import('file-saver')
            const workbook = new ExcelJS.Workbook()
            const sheet = workbook.addWorksheet('Báo Cáo Nề Nếp', {
                pageSetup: { paperSize: 9, orientation: 'portrait', margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } }
            })

            // Set column widths
            sheet.columns = [
                { key: 'stt', width: 5 },
                { key: 'date', width: 12 },
                { key: 'student', width: 22 },
                { key: 'type', width: 12 },
                { key: 'content', width: 35 },
                { key: 'point', width: 8 },
                { key: 'time', width: 15 }
            ]

            // Insert Logo if exists
            let logoImageId = -1;
            if (classInfo.logo) {
                logoImageId = workbook.addImage({
                    base64: classInfo.logo,
                    extension: 'png',
                });
                sheet.addImage(logoImageId, {
                    tl: { col: 0.1, row: 0.2 },
                    ext: { width: 80, height: 80 }
                });
            }

            // Header information
            sheet.mergeCells('C1:G1')
            const schoolName = sheet.getCell('C1')
            schoolName.value = 'SỔ THEO DÕI NỀ NẾP ĐIỆN TỬ'
            schoolName.font = { name: 'Times New Roman', size: 16, bold: true }
            schoolName.alignment = { vertical: 'middle', horizontal: 'center' }

            sheet.mergeCells('C2:G2')
            const reportName = sheet.getCell('C2')
            reportName.value = `BÁO CÁO NỀ NẾP LỚP ${classInfo.name || '.....'}`
            reportName.font = { name: 'Times New Roman', size: 14, bold: true }
            reportName.alignment = { vertical: 'middle', horizontal: 'center' }

            sheet.mergeCells('C3:G3')
            const timeInfo = sheet.getCell('C3')
            timeInfo.value = `Thời gian tham chiếu: ${startDate} đến ${endDate}`
            timeInfo.font = { name: 'Times New Roman', size: 11, italic: true }
            timeInfo.alignment = { vertical: 'middle', horizontal: 'center' }

            sheet.mergeCells('C4:G4')
            const teacherInfo = sheet.getCell('C4')
            teacherInfo.value = `Giáo viên chủ nhiệm: ${classInfo.teacherName || '..........................'}`
            teacherInfo.font = { name: 'Times New Roman', size: 11, italic: true }
            teacherInfo.alignment = { vertical: 'middle', horizontal: 'center' }

            // Thêm vài dòng để nhường chỗ cho logo (chiều cao ~ 6 dòng)
            sheet.getRow(1).height = 25
            sheet.getRow(2).height = 20
            sheet.getRow(3).height = 18
            sheet.getRow(4).height = 18
            sheet.getRow(5).height = 10 // Spacer

            // Bảng cấu trúc
            const headerRow = sheet.getRow(6);
            headerRow.values = ['STT', 'Ngày', 'Học sinh', 'Phân loại', 'Nội dung', 'Điểm', 'Tiết/Môn'];
            headerRow.font = { name: 'Times New Roman', size: 11, bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Áp dụng border cho Header
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEFEFEF' }
                }
            })

            // Data rows
            filteredLogs.forEach((l, index) => {
                const row = sheet.addRow({
                    stt: index + 1,
                    date: format(new Date(l.date), 'dd/MM/yyyy'),
                    student: getStudentName(l.studentId),
                    type: l.type === 'violation' ? 'Vi phạm' : 'Việc tốt',
                    content: l.content,
                    point: l.point,
                    time: `${l.session || ''} ${l.period ? `T${l.period}` : ''} ${l.subject ? `(${l.subject})` : ''}`.trim()
                })
                row.font = { name: 'Times New Roman', size: 11 }

                // Alignment for content and point
                row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
                row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }
                row.getCell(5).alignment = { vertical: 'middle', wrapText: true }
                row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' }
                const pointCell = row.getCell(6)
                pointCell.font = { name: 'Times New Roman', size: 11, color: { argb: l.point < 0 ? 'FF0000' : '008000' }, bold: true }

                // Borders
                row.eachCell((cell) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                })
            })

            // Ký tên mảng sau bảng dữ liệu
            const lastRowIndex = sheet.rowCount + 2;
            sheet.mergeCells(`A${lastRowIndex}:D${lastRowIndex}`); // Dành cho bên trái
            sheet.mergeCells(`E${lastRowIndex}:G${lastRowIndex}`); // Dành cho bên phải (Người lập)
            const signatureCell = sheet.getCell(`E${lastRowIndex}`);
            signatureCell.value = format(new Date(), "'Ngày' dd 'tháng' MM 'năm' yyyy");
            signatureCell.font = { name: 'Times New Roman', size: 11, italic: true };
            signatureCell.alignment = { horizontal: 'center' };

            const signTitle = sheet.getCell(`E${lastRowIndex + 1}`);
            sheet.mergeCells(`E${lastRowIndex + 1}:G${lastRowIndex + 1}`);
            signTitle.value = 'NGƯỜI LẬP BIỂU';
            signTitle.font = { name: 'Times New Roman', size: 11, bold: true };
            signTitle.alignment = { horizontal: 'center' };

            const signName = sheet.getCell(`E${lastRowIndex + 4}`);
            sheet.mergeCells(`E${lastRowIndex + 4}:G${lastRowIndex + 4}`);
            signName.value = classInfo.teacherName || '...........................................';
            signName.font = { name: 'Times New Roman', size: 11, bold: true };
            signName.alignment = { horizontal: 'center' };

            // Export to ArrayBuffer and trigger download
            const buffer = await workbook.xlsx.writeBuffer()
            saveAs(new Blob([buffer]), `bao-cao-ne-nep_${startDate}_${endDate}.xlsx`)
            showToast('Đã xuất file báo cáo Excel!')
        } catch (error) {
            console.error(error)
            showToast('Lỗi khi xuất File Excel', 'error')
        }
    }

    // Time range labels
    const timeRangeLabel = () => {
        switch (timeRange) {
            case 'week': return 'Tuần này'
            case 'month': return 'Tháng này'
            case 'semester': {
                const sem = classInfo.semesters?.find(s => s.id === selectedSemester)
                return sem ? sem.name : 'Học kì'
            }
            case 'year': return 'Năm học'
            case 'custom': return 'Tuỳ chỉnh'
        }
    }

    // Print handler
    const handlePrint = () => {
        window.print()
    }

    // Pagination computations
    const totalLogs = filteredLogs.length
    const logPagesCount = logsLimit === 'all' ? 1 : Math.ceil(totalLogs / logsLimit)
    const currentLogPage = Math.min(logsPage, logPagesCount || 1)
    const paginatedLogs = logsLimit === 'all' ? filteredLogs : filteredLogs.slice((currentLogPage - 1) * logsLimit, currentLogPage * logsLimit)

    const studentBreakdownArray = useMemo(() => {
        return Array.from(studentBreakdown.entries()).sort((a, b) => {
            const nameA = getStudentName(a[0]);
            const nameB = getStudentName(b[0]);
            return sortByName({ name: nameA }, { name: nameB });
        })
    }, [studentBreakdown, students])
    const totalStudents = studentBreakdownArray.length
    const studentPagesCount = studentsLimit === 'all' ? 1 : Math.ceil(totalStudents / studentsLimit)
    const currentStudentPage = Math.min(studentsPage, studentPagesCount || 1)
    const paginatedStudents = studentsLimit === 'all' ? studentBreakdownArray : studentBreakdownArray.slice((currentStudentPage - 1) * studentsLimit, currentStudentPage * studentsLimit)

    if (!ready) return null

    return (
        <div className="space-y-6 print:space-y-0 print:gap-1 max-w-7xl mx-auto flex flex-col">
            {ToastComponent}

            {/* Print header — hidden on screen, visible on print */}
            <div className="print-header hidden print:block">
                <div className="print-header-top flex justify-between items-start mb-4">
                    {/* Left: Logo + School Info */}
                    <div className="flex items-center gap-4">
                        {classInfo.logo && <img src={classInfo.logo} alt="Logo" className="w-20 h-20 object-contain" />}
                        <div className="text-center">
                            <h3 className="font-bold text-sm m-0 uppercase leading-tight">{classInfo.schoolName || 'TRƯỜNG ............................'}</h3>
                            <p className="text-sm m-0 leading-tight">LỚP: {classInfo.name}</p>
                            <p className="text-sm m-0 leading-tight">Năm học: {classInfo.schoolYear}</p>
                        </div>
                    </div>
                    {/* Right: National Motto */}
                    <div className="text-center mr-8">
                        <h4 className="font-bold text-sm m-0 uppercase leading-tight">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                        <p className="text-sm font-bold underline underline-offset-4 m-0 leading-tight mt-1">Độc lập - Tự do - Hạnh phúc</p>
                    </div>
                </div>

                {/* Center Title */}
                <div className="text-center mb-4">
                    <h1 className="text-xl font-bold m-0 uppercase leading-tight">SỔ THEO DÕI NỀ NẾP ĐIỆN TỬ</h1>
                    <h2 className="text-lg font-bold m-0 uppercase leading-tight mt-1">BÁO CÁO NỀ NẾP LỚP {classInfo.name} ĐỊNH KỲ</h2>
                </div>

                {/* Meta Information */}
                <div className="flex justify-between items-end mb-2 text-sm italic">
                    <div>
                        <p className="m-0 leading-tight">Giáo viên chủ nhiệm: <span className="font-bold cursor-text">{classInfo.teacherName}</span></p>
                        <p className="m-0 leading-tight mt-1">Thời gian: {format(new Date(startDate), 'dd/MM/yyyy')} — {format(new Date(endDate), 'dd/MM/yyyy')}</p>
                        {/* Filters print */}
                        {(teamFilter || studentFilter || subjectFilter) && (
                            <p className="m-0 leading-tight mt-1">
                                Lọc theo: {teamFilter ? `Tổ: ${teamFilter} ` : ''}
                                {teamFilter && (studentFilter || subjectFilter) ? '| ' : ''}
                                {studentFilter ? `HS: ${getStudentName(studentFilter)} ` : ''}
                                {studentFilter && subjectFilter ? '| ' : ''}
                                {subjectFilter ? `Môn: ${subjectFilter}` : ''}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in no-print">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 truncate">Báo cáo nề nếp</h1>
                    <p className="text-slate-500 text-sm mt-1 truncate">Tổng hợp và xuất dữ liệu — {timeRangeLabel()}</p>
                </div>
                {(can('print_report') || can('export_report')) && (
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <Link
                            href="/report/student"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full hover:bg-indigo-100 transition-colors shadow-sm"
                        >
                            <Contact className="h-4 w-4" />
                            In phiếu cá nhân
                        </Link>
                        {can('print_report') && (
                            <button
                                onClick={handlePrint}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
                            >
                                <Printer className="h-4 w-4" />
                                In báo cáo
                            </button>
                        )}
                        {can('export_report') && (
                            <button
                                onClick={exportExcel}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                Xuất Excel
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Time Range Tabs */}
            <div className="flex flex-col gap-3 animate-fade-in no-print" style={{ animationDelay: '50ms' }}>
                <div className="flex flex-wrap gap-2">
                    <TimeTab
                        active={timeRange === 'week'}
                        onClick={() => setTimeRange('week')}
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Tuần này"
                    />
                    <TimeTab
                        active={timeRange === 'month'}
                        onClick={() => setTimeRange('month')}
                        icon={<CalendarRange className="h-4 w-4" />}
                        label="Tháng này"
                    />
                    <TimeTab
                        active={timeRange === 'semester'}
                        onClick={() => setTimeRange('semester')}
                        icon={<GraduationCap className="h-4 w-4" />}
                        label="Học kì"
                    />
                    <TimeTab
                        active={timeRange === 'year'}
                        onClick={() => setTimeRange('year')}
                        icon={<BookOpen className="h-4 w-4" />}
                        label="Năm học"
                    />
                    <TimeTab
                        active={timeRange === 'custom'}
                        onClick={() => setTimeRange('custom')}
                        icon={<Calendar className="h-4 w-4" />}
                        label="Tuỳ chỉnh"
                    />
                </div>

                {/* Custom date pickers */}
                {timeRange === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 animate-fade-in">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="input-field pl-10"
                            />
                        </div>
                        <span className="text-slate-400 text-sm">đến</span>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="input-field pl-10"
                            />
                        </div>
                    </div>
                )}

                {/* Semester selector */}
                {timeRange === 'semester' && classInfo.semesters && classInfo.semesters.length > 0 && (
                    <div className="flex items-center gap-3 animate-fade-in">
                        <select
                            value={selectedSemester}
                            onChange={e => setSelectedSemester(e.target.value)}
                            className="input-field appearance-none bg-white min-w-[200px]"
                        >
                            <option value="">Chọn học kì...</option>
                            {classInfo.semesters.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.startDate} → {s.endDate})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {timeRange === 'semester' && (!classInfo.semesters || classInfo.semesters.length === 0) && (
                    <p className="text-xs text-amber-500">
                        Chưa có học kì nào. Vào Cài đặt để tạo học kì.
                    </p>
                )}

                {/* Date range display */}
                {timeRange !== 'custom' && (
                    <p className="text-xs text-slate-400 mt-1">
                        {format(new Date(startDate), 'dd/MM/yyyy')} — {format(new Date(endDate), 'dd/MM/yyyy')}
                    </p>
                )}
            </div>

            {/* Team & Student Filter */}
            <div className="flex flex-wrap gap-3 animate-fade-in no-print" style={{ animationDelay: '80ms' }}>
                <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={thresholdType}
                        onChange={e => setThresholdType(e.target.value as keyof GradeThresholds)}
                        className="input-field pl-10 pr-8 appearance-none bg-white min-w-[200px]"
                    >
                        <option value="weekly">Tiêu chuẩn: Theo tuần</option>
                        <option value="monthly">Tiêu chuẩn: Theo tháng</option>
                        <option value="semester">Tiêu chuẩn: Theo học kì</option>
                    </select>
                </div>
                <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={teamFilter}
                        onChange={e => { setTeamFilter(e.target.value); setStudentFilter('') }}
                        className="input-field pl-10 pr-8 appearance-none bg-white min-w-[160px]"
                    >
                        <option value="">Tất cả tổ</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={studentFilter}
                        onChange={e => setStudentFilter(e.target.value)}
                        className="input-field pl-10 pr-8 appearance-none bg-white min-w-[200px]"
                    >
                        <option value="">Tất cả học sinh</option>
                        {filteredStudentOptions.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.team})</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={subjectFilter}
                        onChange={e => setSubjectFilter(e.target.value)}
                        className="input-field pl-10 pr-8 appearance-none bg-white min-w-[160px]"
                    >
                        <option value="">Tất cả môn học</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                {(teamFilter || studentFilter || subjectFilter) && (
                    <button
                        onClick={() => { setTeamFilter(''); setStudentFilter(''); setSubjectFilter('') }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                        Xoá bộ lọc
                    </button>
                )}
            </div>

            {/* Summary Cards — Clickable */}
            <div className="grid gap-4 sm:grid-cols-3 stagger-children">
                <button
                    onClick={() => setDetailType('violation')}
                    className="text-left"
                >
                    <Card className="card-hover cursor-pointer border-2 border-transparent hover:border-red-200 transition-all">
                        <CardContent className="pt-5">
                            <div className="flex items-center gap-3">
                                <div className="stat-icon bg-red-100 text-red-600">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Tổng vi phạm</p>
                                    <p className="text-2xl font-bold text-red-600">{totalViolations}</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">Nhấn để xem chi tiết →</p>
                        </CardContent>
                    </Card>
                </button>

                <button
                    onClick={() => setDetailType('achievement')}
                    className="text-left"
                >
                    <Card className="card-hover cursor-pointer border-2 border-transparent hover:border-emerald-200 transition-all">
                        <CardContent className="pt-5">
                            <div className="flex items-center gap-3">
                                <div className="stat-icon bg-emerald-100 text-emerald-600">
                                    <Award className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Tổng việc tốt</p>
                                    <p className="text-2xl font-bold text-emerald-600">{totalAchievements}</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">Nhấn để xem chi tiết →</p>
                        </CardContent>
                    </Card>
                </button>

                <Card className="card-hover">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-3">
                            <div className="stat-icon bg-indigo-100 text-indigo-600">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Tổng điểm cộng/trừ</p>
                                <p className={`text-2xl font-bold ${totalPoints >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {totalPoints > 0 ? '+' : ''}{totalPoints}đ
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Attendance Stats */}
            {
                (attendanceStats.totalAbsent > 0 || attendance.length > 0) && (
                    <Card className="animate-slide-up" style={{ animationDelay: '120ms' }}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-0 print:mb-0">
                            <CardTitle className="text-base flex items-center gap-2 print:text-sm">
                                <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                                Thống kê Điểm danh
                                <span className="text-xs font-normal text-slate-400 ml-1">(trong khoảng thời gian đã chọn)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                                    <p className="text-2xl font-bold text-amber-600">{attendanceStats.totalExcused}</p>
                                    <p className="text-xs text-amber-500 mt-0.5">Tổng buổi vắng có phép</p>
                                </div>
                                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center">
                                    <p className="text-2xl font-bold text-red-600">{attendanceStats.totalUnexcused}</p>
                                    <p className="text-xs text-red-500 mt-0.5">Tổng buổi vắng không phép</p>
                                </div>
                                {attendanceStats.hasAfternoon ? (
                                    <>
                                        <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Sun className="h-3.5 w-3.5 text-orange-500" />
                                                <span className="text-xs font-semibold text-orange-600">Buổi Sáng</span>
                                            </div>
                                            <p className="text-sm text-amber-600">Có phép: <strong>{attendanceStats.morningExcused}</strong></p>
                                            <p className="text-sm text-red-600">Không phép: <strong>{attendanceStats.morningUnexcused}</strong></p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                                                <span className="text-xs font-semibold text-indigo-600">Buổi Chiều</span>
                                            </div>
                                            <p className="text-sm text-amber-600">Có phép: <strong>{attendanceStats.afternoonExcused}</strong></p>
                                            <p className="text-sm text-red-600">Không phép: <strong>{attendanceStats.afternoonUnexcused}</strong></p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center flex items-center justify-center">
                                        <p className="text-xs text-slate-400">Chưa có dữ liệu buổi sáng/chiều riêng</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Team Breakdown — only when viewing all teams */}
            {
                !teamFilter && teams.length > 0 && filteredLogs.length > 0 && (
                    <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-0 print:mb-0">
                            <CardTitle className="text-base flex items-center gap-2 print:text-sm">
                                <Users className="h-4 w-4 text-indigo-500" />
                                Tổng hợp theo tổ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tổ</TableHead>
                                            <TableHead className="text-center">Tổng vi phạm</TableHead>
                                            <TableHead className="text-center">Tổng việc tốt</TableHead>
                                            <TableHead className="text-right">Tổng điểm c/trừ</TableHead>
                                            <TableHead className="w-[200px]">Tỉ lệ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teams.map(team => {
                                            const memberIds = new Set(students.filter(s => s.team === team).map(s => s.id))
                                            const teamLogs = filteredLogs.filter(l => memberIds.has(l.studentId))
                                            const vCount = teamLogs.filter(l => l.type === 'violation').length
                                            const aCount = teamLogs.filter(l => l.type === 'achievement').length
                                            const pts = teamLogs.reduce((s, l) => s + l.point, 0)
                                            const total = vCount + aCount
                                            const aPct = total > 0 ? Math.round((aCount / total) * 100) : 0

                                            return (
                                                <TableRow key={team} className="hover:bg-slate-50/80 transition-colors">
                                                    <TableCell className="font-semibold text-slate-800">{team}</TableCell>
                                                    <TableCell className="text-center">
                                                        {vCount > 0 ? (
                                                            <Badge variant="danger">{vCount}</Badge>
                                                        ) : <span className="text-slate-300">0</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {aCount > 0 ? (
                                                            <Badge variant="success">{aCount}</Badge>
                                                        ) : <span className="text-slate-300">0</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`font-bold ${pts >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {pts > 0 ? '+' : ''}{pts}đ
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        {total > 0 ? (
                                                            <div className="flex items-center gap-2 min-w-[120px]">
                                                                <div className="flex-1 min-w-[50px] sm:min-w-[80px] h-4 rounded-full overflow-hidden bg-red-100 flex">
                                                                    <div
                                                                        className="h-full bg-emerald-400 rounded-l-full transition-all"
                                                                        style={{ width: `${aPct}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 w-[50px] whitespace-nowrap text-right shrink-0">{aPct}% tốt</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Detail Table */}
            <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <CardHeader>
                    <CardTitle className="text-base">Chi tiết ({filteredLogs.length} bản ghi)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="table-responsive">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Ngày</TableHead>
                                    <TableHead className="whitespace-nowrap">Học sinh</TableHead>
                                    <TableHead className="w-auto">Nội dung</TableHead>
                                    <TableHead className="hidden md:table-cell w-[100px]">Môn</TableHead>
                                    <TableHead className="hidden lg:table-cell w-[100px]">Buổi/Tiết</TableHead>
                                    <TableHead className="text-right w-[60px]">Điểm</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                                            Không có dữ liệu trong khoảng thời gian này
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedLogs.map(log => (
                                    <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                        <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                                            {format(new Date(log.date), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-800 whitespace-nowrap">
                                            {getStudentName(log.studentId)}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600 max-w-[200px] md:max-w-[300px] truncate" title={log.content}>
                                            {log.content}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500 hidden md:table-cell break-words">{log.subject || '—'}</TableCell>
                                        <TableCell className="text-sm text-slate-500 hidden lg:table-cell break-words">
                                            {log.session && log.period ? `${log.session} / T${log.period}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-bold ${log.point < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {log.point > 0 ? '+' : ''}{log.point}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => setDeleteTarget(log)}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors no-print"
                                                title="Xoá"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalLogs > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 no-print gap-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span>Hiển thị</span>
                                <select
                                    value={logsLimit}
                                    onChange={e => {
                                        setLogsLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))
                                        setLogsPage(1)
                                    }}
                                    className="input-field py-1 text-sm bg-white min-w-[70px]"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value="all">Tất cả</option>
                                </select>
                                <span>bản ghi</span>
                            </div>

                            {logsLimit !== 'all' && logPagesCount > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        disabled={currentLogPage === 1}
                                        onClick={() => setLogsPage(p => p - 1)}
                                        className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                    ><ChevronLeft className="h-4 w-4" /></button>
                                    <span className="text-sm text-slate-600 font-medium px-2">Trang {currentLogPage} / {logPagesCount}</span>
                                    <button
                                        disabled={currentLogPage >= logPagesCount}
                                        onClick={() => setLogsPage(p => p + 1)}
                                        className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                    ><ChevronRight className="h-4 w-4" /></button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Per-student breakdown */}
            {
                studentBreakdown.size > 0 && (
                    <Card className="animate-slide-up" style={{ animationDelay: '300ms' }}>
                        <CardHeader>
                            <CardTitle className="text-base">Tổng hợp theo học sinh</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Học sinh</TableHead>
                                            <TableHead className="text-center">Vi phạm</TableHead>
                                            <TableHead className="text-center">Việc tốt</TableHead>
                                            <TableHead className="text-right">Tổng điểm c/trừ</TableHead>
                                            <TableHead className="text-center">Xếp loại</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedStudents.map(([studentId, data]) => {
                                            const grade = getConductGrade(data.points + 100, thresholds[thresholdType]) // assume 100 is init score for pure calculation, though this is a demo
                                            return (
                                                <TableRow key={studentId} className="hover:bg-slate-50/80 transition-colors">
                                                    <TableCell className="font-medium text-slate-800 whitespace-nowrap">{getStudentName(studentId)}</TableCell>
                                                    <TableCell className="text-center">
                                                        {data.violations > 0 ? (
                                                            <Badge variant="danger">{data.violations}</Badge>
                                                        ) : <span className="text-slate-300">0</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {data.achievements > 0 ? (
                                                            <Badge variant="success">{data.achievements}</Badge>
                                                        ) : <span className="text-slate-300">0</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`font-bold ${data.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {data.points > 0 ? '+' : ''}{data.points}đ
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={`${grade.bgColor} ${grade.color} border-none`}>{grade.name}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            {/* Pagination Controls */}
                            {totalStudents > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 no-print gap-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <span>Hiển thị</span>
                                        <select
                                            value={studentsLimit}
                                            onChange={e => {
                                                setStudentsLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))
                                                setStudentsPage(1)
                                            }}
                                            className="input-field py-1 text-sm bg-white min-w-[70px]"
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value="all">Tất cả</option>
                                        </select>
                                        <span>học sinh</span>
                                    </div>

                                    {studentsLimit !== 'all' && studentPagesCount > 1 && (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={currentStudentPage === 1}
                                                onClick={() => setStudentsPage(p => p - 1)}
                                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                            ><ChevronLeft className="h-4 w-4" /></button>
                                            <span className="text-sm text-slate-600 font-medium px-2">Trang {currentStudentPage} / {studentPagesCount}</span>
                                            <button
                                                disabled={currentStudentPage >= studentPagesCount}
                                                onClick={() => setStudentsPage(p => p + 1)}
                                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                            ><ChevronRight className="h-4 w-4" /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            }

            {/* Per-subject breakdown */}
            {
                subjectBreakdown.size > 0 && (
                    <Card className="animate-slide-up" style={{ animationDelay: '350ms' }}>
                        <CardHeader className="print:pb-0 print:mb-0">
                            <CardTitle className="text-base print:text-sm">Tổng hợp theo môn học</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Môn học</TableHead>
                                            <TableHead className="text-center">Vi phạm</TableHead>
                                            <TableHead className="text-center">Việc tốt</TableHead>
                                            <TableHead className="text-right">Tổng điểm c/trừ</TableHead>
                                            <TableHead className="text-center">Xếp loại</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Array.from(subjectBreakdown.entries())
                                            .sort((a, b) => a[1].points - b[1].points)
                                            .map(([subject, data]) => (
                                                <TableRow key={subject} className="hover:bg-slate-50/80 transition-colors">
                                                    <TableCell className="font-medium text-slate-800">{subject}</TableCell>
                                                    <TableCell className="text-center">
                                                        {data.violations > 0 ? (
                                                            <Badge variant="danger">{data.violations}</Badge>
                                                        ) : <span className="text-slate-300">0</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {data.achievements > 0 ? (
                                                            <Badge variant="success">{data.achievements}</Badge>
                                                        ) : <span className="text-slate-300">0</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`font-bold ${data.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {data.points > 0 ? '+' : ''}{data.points}đ
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Print footer: Signatures */}
            <div className="print-footer hidden print:block page-break-inside-avoid mt-6">
                <div className="flex justify-between">
                    <div></div>
                    <div className="text-center">
                        <p className="italic mb-1">{format(new Date(), "'Ngày' dd 'tháng' MM 'năm' yyyy")}</p>
                        <p className="font-bold">NGƯỜI LẬP BIỂU</p>
                        <p className="italic text-xs">(Ký và ghi rõ họ tên)</p>
                        <div className="h-24"></div>
                        <p className="font-bold">{classInfo.teacherName || '...........................................'}</p>
                    </div>
                </div>
            </div>

            {/* ── Detail Dialog: Violations or Achievements by Student ── */}
            <Dialog
                open={!!detailType}
                onClose={() => setDetailType(null)}
                title={detailType === 'violation' ? `Chi tiết Vi phạm (${totalViolations})` : `Chi tiết Việc tốt (${totalAchievements})`}
                maxWidth="max-w-2xl"
            >
                {detailByStudent.length === 0 ? (
                    <p className="text-center text-slate-400 py-6">Không có dữ liệu</p>
                ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {detailByStudent.map(({ studentId, name, logs, totalPoints }) => (
                            <div key={studentId} className="rounded-xl border border-slate-200 overflow-hidden">
                                {/* Student header */}
                                <div className={`flex items-center justify-between px-4 py-3 ${detailType === 'violation'
                                    ? 'bg-red-50 border-b border-red-100'
                                    : 'bg-emerald-50 border-b border-emerald-100'
                                    }`}>
                                    <div>
                                        <span className="font-semibold text-sm text-slate-800">{name}</span>
                                        <span className="text-xs text-slate-400 ml-2">({logs.length} lần)</span>
                                    </div>
                                    <span className={`font-bold text-sm ${detailType === 'violation' ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {totalPoints > 0 ? '+' : ''}{totalPoints}đ
                                    </span>
                                </div>
                                {/* Detail rows */}
                                <div className="divide-y divide-slate-100">
                                    {logs.map(log => (
                                        <div key={log.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50/50">
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-400 text-xs w-12">
                                                    {new Date(log.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                                <span className="text-slate-700">{log.content}</span>
                                                {log.subject && (
                                                    <Badge variant="info" className="text-[10px]">{log.subject}</Badge>
                                                )}
                                                {log.session && log.period && (
                                                    <span className="text-[10px] text-slate-400">{log.session} T{log.period}</span>
                                                )}
                                            </div>
                                            <span className={`font-semibold ${log.point < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {log.point > 0 ? '+' : ''}{log.point}đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Dialog>

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Xoá bản ghi"
                message={`Bạn có chắc chắn muốn xoá bản ghi "${deleteTarget?.content}"?`}
                confirmText="Xoá"
            />
        </div >
    )
}

// ── Time Tab Component ──
function TimeTab({ active, onClick, icon, label }: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${active
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                }`}
        >
            {icon}
            {label}
        </button>
    )
}
