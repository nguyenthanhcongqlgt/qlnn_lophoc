// ===== Core Types for Sổ Nề Nếp Điện Tử =====

export interface Student {
  id: string;
  username?: string; // Tên đăng nhập (hs_hoten)
  name: string;
  dateOfBirth?: string; // DD/MM/YYYY
  team: string; // Tổ (e.g., "Tổ 1", "Tổ 2")
  position?: string; // Chức vụ: Lớp trưởng, Bí thư, Lớp phó học tập, Lớp phó lao động, Tổ trưởng
  initialScore: number; // Điểm khởi đầu (default 100)
  note?: string; // Nhận xét GVCN
  status?: 'active' | 'dropped_out'; // Tình trạng học tập
  dropoutDate?: string; // Ngày thôi học (YYYY-MM-DD)
}

export type LogType = 'violation' | 'achievement';

export interface LogEntry {
  id: string;
  studentId: string;
  type: LogType;
  content: string; // Mô tả nội dung
  point: number; // Negative for violation, positive for achievement
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: string; // Full ISO timestamp
  subject?: string; // Môn học (e.g., "Toán", "Văn")
  session?: string; // Buổi học (e.g., "Sáng", "Chiều")
  period?: number; // Tiết học (1-5)
  status?: 'pending' | 'approved' | 'rejected'; // Trạng thái duyệt
  rejectReason?: string; // Lý do từ chối
  createdBy?: string; // Người tạo phiếu
}

export interface IncidentType {
  id: string;
  content: string;
  point: number; // Negative for violations, positive for achievements
  type: LogType;
}

export interface Position {
  id: string;
  name: string;        // e.g. "Lớp trưởng", "Bí thư"
  canCreateLog: boolean; // Có quyền lập phiếu nề nếp
}

export const DEFAULT_POSITIONS: Position[] = [
  { id: 'pos_lt', name: 'Lớp trưởng', canCreateLog: true },
  { id: 'pos_lp', name: 'Lớp phó', canCreateLog: true },
  { id: 'pos_bt', name: 'Bí thư', canCreateLog: true },
  { id: 'pos_tt', name: 'Tổ trưởng', canCreateLog: true },
  { id: 'pos_hs', name: 'Học sinh', canCreateLog: false },
];

export interface Semester {
  id: string;
  name: string;       // "Học kì 1", "Học kì 2"
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
}

export interface ClassInfo {
  schoolName: string; // Tên trường (e.g., "THPT Quất Lâm")
  name: string; // Tên lớp (e.g., "10A1")
  schoolYear: string; // Năm học (e.g., "2025-2026")
  teacherName: string; // GVCN
  semesters: Semester[];
  logo?: string | null;
  printLogo?: boolean;
  authorizedStudents?: string[]; // Danh sách ID học sinh được uỷ quyền duyệt phiếu
  alertThreshold?: number; // Số lần vi phạm trong tuần để cảnh báo
  heatmapThresholds?: number[]; // Các mốc (3 mức) cho bản đồ nhiệt
}

// ── Xếp loại rèn luyện ──

export type ConductGradeName = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';

export interface ThresholdSet {
  tot: number;   // >= this => Tốt
  kha: number;   // >= this => Khá
  dat: number;   // >= this => Đạt
  // < dat => Chưa đạt
}

export interface GradeThresholds {
  weekly: ThresholdSet;
  monthly: ThresholdSet;
  semester: ThresholdSet;
}

export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = {
  weekly: { tot: 90, kha: 70, dat: 50 },
  monthly: { tot: 360, kha: 280, dat: 200 },     // ~ 4 weeks
  semester: { tot: 1440, kha: 1120, dat: 800 }, // ~ 16 weeks
};

export interface ConductGrade {
  name: ConductGradeName;
  color: string;       // Tailwind text color class
  bgColor: string;     // Tailwind bg color class
  borderColor: string; // Tailwind border color class
}

export function getConductGrade(score: number, thresholds: ThresholdSet): ConductGrade {
  if (score >= thresholds.tot) return {
    name: 'Tốt', color: 'text-emerald-700', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-300'
  };
  if (score >= thresholds.kha) return {
    name: 'Khá', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300'
  };
  if (score >= thresholds.dat) return {
    name: 'Đạt', color: 'text-amber-700', bgColor: 'bg-amber-100', borderColor: 'border-amber-300'
  };
  return {
    name: 'Chưa đạt', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300'
  };
}

// ── Điểm danh ──

export type AttendanceStatus = 'present' | 'absent_excused' | 'absent_unexcused';
export type AttendanceSession = 'morning' | 'afternoon';

export const ATTENDANCE_SESSION_LABELS: Record<AttendanceSession, string> = {
  morning: 'Buổi Sáng',
  afternoon: 'Buổi Chiều',
};

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  session: AttendanceSession; // 'morning' | 'afternoon'
  status: AttendanceStatus;
  note?: string;
}

// Computed types used in views
export interface StudentWithScore extends Student {
  currentScore: number;
  violationCount: number;
  achievementCount: number;
}

// ── Constants ──

export interface Subject {
  id: string;
  name: string;
}

export const SESSIONS = ['Sáng', 'Chiều'] as const;

export const PERIODS = [1, 2, 3, 4, 5] as const;

// ── Đăng nhập & Phân quyền ──

export type UserRole = 'student' | 'team_leader' | 'class_leader' | 'teacher';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  studentId?: string; // Liên kết với học sinh (cho student/team_leader/class_leader)
  team?: string;      // Tổ (cho team_leader)
  canCreateLog?: boolean; // Được phép lập phiếu nề nếp (theo chức vụ)
  positionName?: string;  // Tên chức vụ cụ thể (vd: "Cờ đỏ", "Lớp trưởng")
  avatar?: string | null; // Base64 image
}

export interface AuthSession {
  user: UserAccount;
  loggedInAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Học sinh',
  team_leader: 'Tổ trưởng',
  class_leader: 'Lớp trưởng / Lớp phó / Bí thư',
  teacher: 'Giáo viên chủ nhiệm',
};

export const ROLE_SHORT_LABELS: Record<UserRole, string> = {
  student: 'HS',
  team_leader: 'TT',
  class_leader: 'LT',
  teacher: 'GV',
};
