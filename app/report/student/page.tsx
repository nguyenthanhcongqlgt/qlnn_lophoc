"use client"

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { initializeData, getStudentsWithScores, getLogs, getClassInfo, getGradeThresholds, getAttendance } from '@/lib/storage'
import { LogEntry, StudentWithScore, ClassInfo, GradeThresholds, getConductGrade, DEFAULT_GRADE_THRESHOLDS, AttendanceRecord, Semester } from '@/types'
import { Calendar, CalendarDays, CalendarRange, GraduationCap, X, Users, User, BookOpen, Printer, ArrowLeft, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, isWithinInterval, parseISO } from 'date-fns'
import Link from 'next/link'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

type TimeRange = 'week' | 'month' | 'semester' | 'year' | 'custom'

// Helper functions for dates
function getWeekStart(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.getFullYear(), d.getMonth(), diff)
    return format(monday, 'yyyy-MM-dd')
}

function getMonthStart(): string {
    const d = new Date()
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

function getSemesterStartFallback(): string {
    const d = new Date()
    const month = d.getMonth()
    let startMonth = 8
    let year = d.getFullYear()
    if (month >= 0 && month < 5) {
        startMonth = 0
    } else if (month >= 5 && month < 8) {
        startMonth = 5
    } else {
        startMonth = 8
    }
    return format(new Date(year, startMonth, 1), 'yyyy-MM-dd')
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

export default function StudentDetailedReportPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [students, setStudents] = useState<StudentWithScore[]>([])
    const [classInfo, setClassInfo] = useState<ClassInfo>({ schoolName: '', name: '', schoolYear: '', teacherName: '', semesters: [] })
    const [thresholds, setThresholds] = useState<GradeThresholds>(DEFAULT_GRADE_THRESHOLDS)
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
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

    // Filters
    const [teamFilter, setTeamFilter] = useState('')
    const [studentFilter, setStudentFilter] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('')

    // Pagination
    const [studentsLimit, setStudentsLimit] = useState<number | 'all'>(10)
    const [studentsPage, setStudentsPage] = useState(1)

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

        if (classInfoData?.semesters && classInfoData.semesters.length > 0) {
            const today = new Date()
            const currentSemester = classInfoData.semesters.find(s => {
                if (!s.startDate || !s.endDate) return false;
                return isWithinInterval(today, { start: parseISO(s.startDate), end: parseISO(s.endDate) })
            })
            if (currentSemester) {
                setSelectedSemester(currentSemester.id)
            }
        }
    }

    // Compute unique teams and subjects
    const teams = useMemo(() => Array.from(new Set(students.map(s => s.team))).sort(), [students])
    const subjects = useMemo(() => Array.from(new Set(logs.map(l => l.subject).filter((s): s is string => !!s))).sort(), [logs])

    const filteredStudentOptions = useMemo(() => {
        if (teamFilter) return students.filter(s => s.team === teamFilter)
        return students
    }, [students, teamFilter])

    // Compute date range
    const { startDate, endDate } = useMemo(() => {
        switch (timeRange) {
            case 'week': return { startDate: getWeekStart(), endDate: getToday() }
            case 'month': return { startDate: getMonthStart(), endDate: getToday() }
            case 'semester': {
                const sem = classInfo.semesters?.find(s => s.id === selectedSemester)
                if (sem) return { startDate: sem.startDate, endDate: sem.endDate }
                return { startDate: getSemesterStartFallback(), endDate: getToday() }
            }
            case 'year': return getYearRange(classInfo.schoolYear, classInfo.semesters)
            case 'custom': return { startDate: customStart, endDate: customEnd }
        }
    }, [timeRange, customStart, customEnd, selectedSemester, classInfo.semesters, classInfo.schoolYear])

    // Filter logs
    const filteredLogs = useMemo(() => {
        return logs
            .filter(l => {
                if (l.date < startDate || l.date > endDate) return false
                if (teamFilter) {
                    const student = students.find(s => s.id === l.studentId)
                    if (student?.team !== teamFilter) return false
                }
                if (studentFilter && l.studentId !== studentFilter) return false
                if (subjectFilter && l.subject !== subjectFilter) return false
                return true
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }, [logs, startDate, endDate, teamFilter, studentFilter, subjectFilter, students])

    // Group logs by student
    const studentBreakdown = useMemo(() => {
        const activeStudents = new Map<string, { student: StudentWithScore; logs: LogEntry[]; violations: number; achievements: number; points: number; absentExcused: number; absentUnexcused: number }>()

        // Initialize missing students from filter, or just only show students who have logs or match standard filter
        let currentStudents = students
        if (teamFilter) currentStudents = currentStudents.filter(s => s.team === teamFilter)
        if (studentFilter) currentStudents = currentStudents.filter(s => s.id === studentFilter)

        currentStudents.forEach(s => {
            activeStudents.set(s.id, { student: s, logs: [], violations: 0, achievements: 0, points: 0, absentExcused: 0, absentUnexcused: 0 })
        })

        filteredLogs.forEach(l => {
            const entry = activeStudents.get(l.studentId)
            if (entry) {
                entry.logs.push(l)
                if (l.type === 'violation') entry.violations++
                else entry.achievements++
                entry.points += l.point
            }
        })

        const filteredAttendance = attendance.filter(a => {
            if (a.date < startDate || a.date > endDate) return false
            if (teamFilter) {
                const student = students.find(s => s.id === a.studentId)
                if (student?.team !== teamFilter) return false
            }
            if (studentFilter && a.studentId !== studentFilter) return false
            return true
        })

        filteredAttendance.forEach(a => {
            const entry = activeStudents.get(a.studentId)
            if (entry) {
                if (a.status === 'absent_excused') entry.absentExcused += 0.5;
                if (a.status === 'absent_unexcused') entry.absentUnexcused += 0.5;
            }
        })

        // Sort by student name, and keep only students with logs IF no specific student filter is on
        const arr = Array.from(activeStudents.values())
            .filter(e => studentFilter ? true : (e.logs.length > 0 || e.absentExcused > 0 || e.absentUnexcused > 0)) // Hide empty students unless explicitly searched
            .sort((a, b) => a.student.name.localeCompare(b.student.name))
        return arr
    }, [filteredLogs, students, teamFilter, studentFilter, attendance, startDate, endDate])

    const totalStudents = studentBreakdown.length
    const studentPagesCount = studentsLimit === 'all' ? 1 : Math.ceil(totalStudents / studentsLimit)
    const currentStudentPage = Math.min(studentsPage, studentPagesCount || 1)
    const paginatedBreakdown = studentsLimit === 'all' ? studentBreakdown : studentBreakdown.slice((currentStudentPage - 1) * studentsLimit, currentStudentPage * studentsLimit)

    const handlePrint = () => {
        if (studentBreakdown.length === 0) {
            showToast('Không có dữ liệu học sinh nào để in.', 'error')
            return
        }
        window.print()
    }

    const handleExportWord = async () => {
        if (paginatedBreakdown.length === 0) {
            showToast('Không có dữ liệu học sinh nào để xuất.', 'error')
            return
        }

        try {
            const children = [];

            for (let i = 0; i < paginatedBreakdown.length; i++) {
                const data = paginatedBreakdown[i];

                // Add page break if not the first page
                if (i > 0) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: "", break: 1 })],
                        pageBreakBefore: true,
                    }));
                }

                // Column 1: Logo + School Info
                const leftColChildren = [];
                if (classInfo.printLogo !== false && classInfo.logo && classInfo.logo.startsWith('data:image')) {
                    try {
                        const base64Data = classInfo.logo.split(',')[1];
                        const binaryStr = atob(base64Data);
                        const bytes = new Uint8Array(binaryStr.length);
                        for (let j = 0; j < binaryStr.length; j++) {
                            bytes[j] = binaryStr.charCodeAt(j);
                        }
                        const { ImageRun } = await import('docx');
                        leftColChildren.push(
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: bytes,
                                        type: classInfo.logo.includes('jpeg') || classInfo.logo.includes('jpg') ? 'jpg' : 'png',
                                        transformation: { width: 70, height: 70 }
                                    })
                                ],
                                alignment: AlignmentType.CENTER
                            })
                        );
                    } catch (e) {
                        console.error('Lỗi chèn logo', e);
                    }
                }

                leftColChildren.push(
                    new Paragraph({ children: [new TextRun({ text: classInfo.schoolName || 'TRƯỜNG ............................', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: `LỚP: ${classInfo.name}`, size: 22 })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: `NĂM HỌC: ${classInfo.schoolYear}`, size: 22 })], alignment: AlignmentType.CENTER })
                );

                // Column 2: National Motto + Report Title
                const rightColChildren = [
                    new Paragraph({ children: [new TextRun({ text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, size: 22, underline: {} })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: "", break: 1 })], alignment: AlignmentType.CENTER }),
                    new Paragraph({
                        children: [new TextRun({ text: 'PHIẾU BÁO CÁO NỀ NẾP CÁ NHÂN', bold: true, size: 30, color: '3b82f6' })],
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: `Thời gian từ: ${format(new Date(startDate), 'dd/MM/yyyy')} đến: ${format(new Date(endDate), 'dd/MM/yyyy')}`, size: 22 })],
                        alignment: AlignmentType.CENTER
                    })
                ];

                // Header Table
                children.push(
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 40, type: WidthType.PERCENTAGE },
                                        children: leftColChildren,
                                        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
                                    }),
                                    new TableCell({
                                        width: { size: 60, type: WidthType.PERCENTAGE },
                                        children: rightColChildren,
                                        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),
                );
                // Title
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Họ và tên: ", bold: true }),
                            new TextRun({ text: `${data.student.name}    ` }),
                            new TextRun({ text: "Ngày sinh: ", bold: true }),
                            new TextRun({ text: `${data.student.dateOfBirth || '........'}    ` }),
                            new TextRun({ text: "Ngày nghỉ: ", bold: true }),
                            new TextRun({ text: `${data.absentExcused} phép, ${data.absentUnexcused} không phép    ` }),
                            new TextRun({ text: "Tổ: ", bold: true }),
                            new TextRun({ text: data.student.team })
                        ],
                        spacing: { after: 200 },
                    })
                );

                // Table Rows
                const tableRows = [
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: "Ngày", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
                            new TableCell({ children: [new Paragraph({ text: "Nội dung", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
                            new TableCell({ children: [new Paragraph({ text: "Môn học", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
                            new TableCell({ children: [new Paragraph({ text: "Buổi/Tiết", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
                            new TableCell({ children: [new Paragraph({ text: "Điểm", alignment: AlignmentType.CENTER })], shading: { fill: "F3F4F6" } }),
                        ],
                        tableHeader: true,
                    })
                ];

                if (data.logs.length === 0) {
                    tableRows.push(
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ text: "Không có vi phạm hay điểm cộng nào trong thời gian này.", alignment: AlignmentType.CENTER })],
                                    columnSpan: 5
                                })
                            ]
                        })
                    );
                } else {
                    data.logs.forEach(log => {
                        tableRows.push(
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: format(new Date(log.date), 'dd/MM/yyyy'), alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: log.content })] }),
                                    new TableCell({ children: [new Paragraph({ text: log.subject || '-', alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: log.session && log.period ? `${log.session[0]} T${log.period}` : '-', alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: `${log.point > 0 ? '+' : ''}${log.point}`, alignment: AlignmentType.RIGHT })] }),
                                ]
                            })
                        );
                    });
                }

                children.push(
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows,
                    }),
                    new Paragraph({ text: "" }),
                );

                // Summary
                const grade = getConductGrade(data.points + 100, thresholds[thresholdType]);
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Vi phạm: ", bold: true }),
                            new TextRun({ text: `${data.violations}    ` }),
                            new TextRun({ text: "Việc tốt: ", bold: true }),
                            new TextRun({ text: `${data.achievements}    ` }),
                            new TextRun({ text: "Tổng điểm thu được: ", bold: true }),
                            new TextRun({ text: `${data.points > 0 ? '+' : ''}${data.points}đ    ` }),
                            new TextRun({ text: "Xếp loại: ", bold: true }),
                            new TextRun({ text: `${grade.name}` }),
                        ],
                        spacing: { before: 200, after: 400 },
                    })
                );

                // Signatures
                children.push(
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 33, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "Giáo viên Chủ nhiệm", bold: true })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "(Ký, ghi rõ họ tên)" })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ text: "", spacing: { before: 800 } }),
                                            new Paragraph({ children: [new TextRun({ text: classInfo.teacherName })], alignment: AlignmentType.CENTER }),
                                        ],
                                        borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }
                                    }),
                                    new TableCell({
                                        width: { size: 33, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "Học sinh", bold: true })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "(Ký, ghi rõ họ tên)" })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ text: "", spacing: { before: 800 } }),
                                            new Paragraph({ children: [new TextRun({ text: data.student.name })], alignment: AlignmentType.CENTER }),
                                        ],
                                        borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }
                                    }),
                                    new TableCell({
                                        width: { size: 33, type: WidthType.PERCENTAGE },
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "Phụ huynh học sinh", bold: true })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "(Ký, ghi rõ họ tên)" })], alignment: AlignmentType.CENTER }),
                                        ],
                                        borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }
                                    }),
                                ],
                            }),
                        ],
                    })
                );
            }

            const doc = new Document({
                sections: [{
                    properties: {
                        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
                    },
                    children: children,
                }],
            });

            const blob = await Packer.toBlob(doc);
            const safeClassName = (classInfo.name || '10A1').replace(/^Lớp\s*/i, '');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Lớp${safeClassName}_ngàythang.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error generating docx", error);
            showToast('Lỗi khi xuất file Word', 'error');
        }
    }

    if (!ready) return null

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {ToastComponent}

            {/* Header (Screen only) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Link href="/report" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        Phiếu Báo Cáo Cá Nhân
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-10">In phiếu báo cáo tình hình nề nếp cho từng học sinh</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto ml-10 sm:ml-0">
                    <button
                        onClick={handleExportWord}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Download className="h-4 w-4" />
                        Xuất Word
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
                    >
                        <Printer className="h-4 w-4" />
                        In tất cả ({studentBreakdown.length})
                    </button>
                </div>
            </div>

            {/* Toolbar (Screen only) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print animate-fade-in" style={{ animationDelay: '40ms' }}>
                <div className="flex flex-wrap items-center gap-2">
                    <TimeTab active={timeRange === 'week'} onClick={() => setTimeRange('week')} icon={<CalendarDays className="h-4 w-4" />} label="Tuần này" />
                    <TimeTab active={timeRange === 'month'} onClick={() => setTimeRange('month')} icon={<CalendarRange className="h-4 w-4" />} label="Tháng này" />
                    <TimeTab active={timeRange === 'semester'} onClick={() => setTimeRange('semester')} icon={<GraduationCap className="h-4 w-4" />} label="Học kì" />
                    <TimeTab active={timeRange === 'year'} onClick={() => setTimeRange('year')} icon={<BookOpen className="h-4 w-4" />} label="Năm học" />
                    <TimeTab active={timeRange === 'custom'} onClick={() => setTimeRange('custom')} icon={<Calendar className="h-4 w-4" />} label="Tuỳ chỉnh" />
                </div>

                {timeRange === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-field" />
                        <span className="text-slate-400 text-sm">đến</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-field" />
                    </div>
                )}

                {timeRange === 'semester' && classInfo.semesters && classInfo.semesters.length > 0 && (
                    <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="input-field max-w-[300px]">
                        <option value="">Chọn học kì...</option>
                        {classInfo.semesters.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startDate} → {s.endDate})</option>)}
                    </select>
                )}

                <div className="flex flex-wrap gap-3">
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
                        <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setStudentFilter('') }} className="input-field pl-10 pr-8 min-w-[160px]">
                            <option value="">Tất cả tổ</option>
                            {teams.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className="input-field pl-10 pr-8 min-w-[200px]">
                            <option value="">Tất cả học sinh</option>
                            {filteredStudentOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.team})</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="input-field pl-10 pr-8 min-w-[160px]">
                            <option value="">Tất cả môn học</option>
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {(teamFilter || studentFilter || subjectFilter) && (
                        <button onClick={() => { setTeamFilter(''); setStudentFilter(''); setSubjectFilter('') }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                            <X className="h-3.5 w-3.5" />
                            Xoá bộ lọc
                        </button>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-4 w-full">
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
            </div>

            {/* Empty State */}
            {studentBreakdown.length === 0 && (
                <Card className="no-print">
                    <CardContent className="p-10 text-center text-slate-400">
                        Không có dữ liệu học sinh nào để xuất báo cáo.
                    </CardContent>
                </Card>
            )}

            {/* Printable Container */}
            <div className="student-reports-container space-y-8 print:space-y-0 print:bg-white">
                {paginatedBreakdown.map((data, index) => (
                    <div key={data.student.id} className="student-report-page bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 break-after-page print:bg-white text-black">

                        {/* Custom Print Header (Only visible on print/similar to page template) */}
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 print:mb-6 gap-3 sm:gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {classInfo.printLogo !== false && classInfo.logo && (
                                    <img src={classInfo.logo} alt="Logo trường" className="w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] object-contain shrink-0" />
                                )}
                                <div className="text-center min-w-0">
                                    <h3 className="font-bold text-[11px] sm:text-[13px] uppercase m-0 leading-tight">{classInfo.schoolName || 'TRƯỜNG ............................'}</h3>
                                    <p className="text-[11px] sm:text-[13px] m-0 mt-1 leading-tight">LỚP: {classInfo.name}</p>
                                    <p className="text-[11px] sm:text-[13px] uppercase m-0 mt-1 leading-tight">NĂM HỌC: {classInfo.schoolYear}</p>
                                </div>
                            </div>
                            <div className="text-center w-full sm:w-[280px] shrink-0">
                                <h4 className="font-bold text-[11px] sm:text-[13px] uppercase m-0 leading-tight">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                                <p className="text-[11px] sm:text-[13px] font-bold m-0 mt-1 underline underline-offset-4 leading-tight">Độc lập - Tự do - Hạnh phúc</p>
                            </div>
                        </div>

                        <div className="text-center mb-6">
                            <h1 className="text-[15px] font-bold m-0 uppercase leading-tight">PHIẾU BÁO CÁO NỀ NẾP CÁ NHÂN</h1>
                            <p className="text-[13px] mt-1">
                                Thời gian từ: {format(new Date(startDate), 'dd/MM/yyyy')} đến: {format(new Date(endDate), 'dd/MM/yyyy')}
                            </p>
                        </div>

                        {/* Student Meta */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 text-sm bg-slate-50 print:bg-transparent p-3 print:p-0 rounded-lg gap-2 sm:gap-0">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-6 min-w-0">
                                <p className="font-bold text-base sm:text-lg text-slate-800 print:text-black whitespace-nowrap">Họ và tên: {data.student.name}</p>
                                <p className="font-medium text-xs sm:text-sm text-slate-700 print:text-black whitespace-nowrap">Ngày sinh: {data.student.dateOfBirth || '........'}</p>
                                <p className="font-medium text-xs sm:text-sm text-slate-700 print:text-black whitespace-nowrap">Nghỉ: <span className="text-amber-600 font-semibold">{data.absentExcused}</span> P, <span className="text-red-600 font-semibold">{data.absentUnexcused}</span> KP</p>
                            </div>
                            <p className="font-semibold text-slate-600 print:text-black border print:border-none px-3 py-1 rounded-full shrink-0 self-start sm:self-auto">{data.student.team}</p>
                        </div>

                        {/* Data Table */}
                        <table className="w-full text-left text-sm mb-6 border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-300">
                                    <th className="py-2 px-2 font-semibold w-[80px]">Ngày</th>
                                    <th className="py-2 px-2 font-semibold w-auto">Nội dung</th>
                                    <th className="py-2 px-2 font-semibold text-center w-[120px]">Môn học</th>
                                    <th className="py-2 px-2 font-semibold text-center w-[100px]">Buổi/Tiết</th>
                                    <th className="py-2 px-2 font-semibold text-right w-[60px]">Điểm</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                                {data.logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">Không có vi phạm hay điểm cộng nào trong thời gian này.</td>
                                    </tr>
                                ) : (
                                    data.logs.map(log => (
                                        <tr key={log.id} className="print:text-sm">
                                            <td className="py-2 px-2 print:py-1 whitespace-nowrap">{format(new Date(log.date), 'dd/MM/yyyy')}</td>
                                            <td className="py-2 px-2 print:py-1 max-w-[200px] sm:max-w-[250px] truncate" title={log.content}>{log.content}</td>
                                            <td className="py-2 px-2 print:py-1 text-center break-words">{log.subject || '-'}</td>
                                            <td className="py-2 px-2 print:py-1 text-center break-words">{log.session && log.period ? `${log.session[0]} T${log.period}` : '-'}</td>
                                            <td className={`py-2 px-2 print:py-1 text-right font-bold ${log.point < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {log.point > 0 ? '+' : ''}{log.point}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Summary Block */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 print:bg-white p-3 sm:p-4 print:p-0 print:border-y print:py-2 border-slate-200 rounded-lg mb-8 gap-3 sm:gap-0">
                            <div className="flex items-center gap-4 sm:gap-0 sm:flex-col sm:items-start">
                                <p className="text-sm font-medium">Vi phạm: <span className="text-red-600 font-bold">{data.violations}</span></p>
                                <p className="text-sm font-medium">Việc tốt: <span className="text-emerald-600 font-bold">{data.achievements}</span></p>
                            </div>
                            <div className="text-right flex items-center gap-4 sm:gap-6">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium shrink-0">Tổng điểm:</p>
                                    <p className={`text-lg sm:text-xl font-bold ${data.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {data.points > 0 ? '+' : ''}{data.points}đ
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm font-medium">Xếp loại:</p>
                                    <p className={`text-lg sm:text-xl font-bold ${getConductGrade(data.points + 100, thresholds[thresholdType]).color}`}>
                                        {getConductGrade(data.points + 100, thresholds[thresholdType]).name}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="flex justify-between mt-8 break-inside-avoid">
                            <div className="text-center w-1/3">
                                <p className="font-bold text-sm">Giáo viên Chủ nhiệm</p>
                                <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
                                <div className="h-20"></div>
                                <p className="font-medium text-sm">{classInfo.teacherName}</p>
                            </div>
                            <div className="text-center w-1/3">
                                <p className="font-bold text-sm">Học sinh</p>
                                <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
                                <div className="h-20"></div>
                                <p className="font-medium text-sm">{data.student.name}</p>
                            </div>
                            <div className="text-center w-1/3">
                                <p className="font-bold text-sm">Phụ huynh học sinh</p>
                                <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
                            </div>
                        </div>

                    </div>
                ))}
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 1.5cm 1cm 1.5cm 1.5cm;
                    }
                    /* Force each student report to start on a new page */
                    .student-report-page {
                        page-break-after: always;
                        break-after: page;
                        page-break-inside: avoid;
                        min-height: 260mm; /* approximate A4 height minus margins to visually fill a page */
                    }
                    /* Remove page break for the very last student to avoid a blank trailing page */
                    .student-report-page:last-child {
                        page-break-after: auto;
                        break-after: auto;
                        min-height: auto;
                    }
                    body {
                        background: transparent !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    * {
                        background-color: transparent !important;
                        box-shadow: none !important;
                        text-shadow: none !important;
                    }
                    table, th, td {
                        border-color: #000 !important;
                    }
                    /* Hide everything else not needed for print */
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

        </div>
    )
}

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
                ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
        >
            {icon}
            {label}
        </button>
    )
}
