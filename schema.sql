-- ===== Sổ Nề Nếp Điện Tử — Database Schema =====
-- Chạy file này trong Vercel Postgres console (Storage → Data → Query)

-- 1. Học sinh
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    position TEXT,
    initial_score INTEGER NOT NULL DEFAULT 100,
    note TEXT
);

-- 2. Nhật ký vi phạm / thành tích
CREATE TABLE IF NOT EXISTS log_entries (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('violation', 'achievement')),
    content TEXT NOT NULL,
    point INTEGER NOT NULL,
    date TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    subject TEXT,
    session TEXT,
    period INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reject_reason TEXT,
    created_by TEXT
);

-- 3. Loại vi phạm / thành tích mẫu
CREATE TABLE IF NOT EXISTS incident_types (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    point INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('violation', 'achievement'))
);

-- 4. Thông tin lớp (single row)
CREATE TABLE IF NOT EXISTS class_info (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    school_name TEXT NOT NULL DEFAULT '',
    school_year TEXT NOT NULL DEFAULT '',
    teacher_name TEXT NOT NULL DEFAULT '',
    semesters TEXT NOT NULL DEFAULT '[]',
    logo TEXT,
    print_logo BOOLEAN DEFAULT true,
    authorized_students TEXT DEFAULT '[]'
);

-- 5. Ngưỡng xếp loại (single row)
CREATE TABLE IF NOT EXISTS grade_thresholds (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    weekly_tot INTEGER NOT NULL DEFAULT 90,
    weekly_kha INTEGER NOT NULL DEFAULT 70,
    weekly_dat INTEGER NOT NULL DEFAULT 50,
    monthly_tot INTEGER NOT NULL DEFAULT 360,
    monthly_kha INTEGER NOT NULL DEFAULT 280,
    monthly_dat INTEGER NOT NULL DEFAULT 200,
    semester_tot INTEGER NOT NULL DEFAULT 1440,
    semester_kha INTEGER NOT NULL DEFAULT 1120,
    semester_dat INTEGER NOT NULL DEFAULT 800
);

-- 6. Điểm danh
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent_excused', 'absent_unexcused')),
    note TEXT,
    UNIQUE(student_id, date)
);

-- 8. Môn học
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- 7. Tài khoản đăng nhập
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'team_leader', 'class_leader', 'teacher')),
    display_name TEXT NOT NULL,
    student_id TEXT,
    team TEXT
);

-- ===== SEED DATA =====

-- Học sinh
INSERT INTO students (id, name, team, initial_score) VALUES
    ('HS001', 'Nguyễn Văn An', 'Tổ 1', 100),
    ('HS002', 'Trần Thị Bình', 'Tổ 1', 100),
    ('HS003', 'Lê Văn Cường', 'Tổ 1', 100),
    ('HS004', 'Phạm Thị Dung', 'Tổ 2', 100),
    ('HS005', 'Hoàng Văn Em', 'Tổ 2', 100),
    ('HS006', 'Võ Thị Phương', 'Tổ 2', 100),
    ('HS007', 'Đặng Quốc Hùng', 'Tổ 3', 100),
    ('HS008', 'Bùi Thị Hoa', 'Tổ 3', 100),
    ('HS009', 'Ngô Thanh Tùng', 'Tổ 3', 100),
    ('HS010', 'Lý Thị Kim', 'Tổ 4', 100),
    ('HS011', 'Trịnh Minh Đức', 'Tổ 4', 100),
    ('HS012', 'Huỳnh Thị Lan', 'Tổ 4', 100),
    ('HS013', 'Mai Xuân Trường', 'Tổ 1', 100),
    ('HS014', 'Đỗ Thị Ngọc', 'Tổ 2', 100),
    ('HS015', 'Phan Văn Khải', 'Tổ 3', 100)
ON CONFLICT (id) DO NOTHING;

-- Loại vi phạm
INSERT INTO incident_types (id, content, point, type) VALUES
    ('V01', 'Đi học muộn', -2, 'violation'),
    ('V02', 'Không thuộc bài', -5, 'violation'),
    ('V03', 'Mất trật tự trong lớp', -2, 'violation'),
    ('V04', 'Không mặc đồng phục', -2, 'violation'),
    ('V05', 'Vệ sinh lớp kém', -3, 'violation'),
    ('V06', 'Sử dụng điện thoại', -5, 'violation'),
    ('V07', 'Nói tục, chửi bậy', -5, 'violation'),
    ('V08', 'Không làm bài tập', -3, 'violation')
ON CONFLICT (id) DO NOTHING;

-- Loại thành tích
INSERT INTO incident_types (id, content, point, type) VALUES
    ('A01', 'Phát biểu xây dựng bài', 2, 'achievement'),
    ('A02', 'Nhặt được của rơi', 10, 'achievement'),
    ('A03', 'Giúp đỡ bạn bè', 5, 'achievement'),
    ('A04', 'Điểm kiểm tra giỏi (9-10)', 5, 'achievement'),
    ('A05', 'Tham gia hoạt động phong trào', 3, 'achievement'),
    ('A06', 'Vệ sinh lớp tốt', 2, 'achievement')
ON CONFLICT (id) DO NOTHING;

-- Môn học
INSERT INTO subjects (id, name) VALUES
    ('SUB_01', 'Ngữ văn'),
    ('SUB_02', 'Toán'),
    ('SUB_03', 'Lịch sử'),
    ('SUB_04', 'Địa lý'),
    ('SUB_05', 'GDKTPL'),
    ('SUB_06', 'GDTC'),
    ('SUB_07', 'Vật lý'),
    ('SUB_08', 'Hóa học'),
    ('SUB_09', 'Sinh học'),
    ('SUB_10', 'Tin học'),
    ('SUB_11', 'Công nghệ'),
    ('SUB_12', 'Ngoại ngữ')
ON CONFLICT (id) DO NOTHING;

-- Thông tin lớp
INSERT INTO class_info (id, name, school_year, teacher_name)
VALUES (1, '10A1', '2025 - 2026', 'Nguyễn Thanh Cong')
ON CONFLICT (id) DO NOTHING;

-- Ngưỡng xếp loại
INSERT INTO grade_thresholds (id, weekly_tot, weekly_kha, weekly_dat, monthly_tot, monthly_kha, monthly_dat, semester_tot, semester_kha, semester_dat)
VALUES (1, 90, 70, 50, 360, 280, 200, 1440, 1120, 800)
ON CONFLICT (id) DO NOTHING;

-- Tài khoản giáo viên
INSERT INTO accounts (id, username, password, role, display_name)
VALUES ('teacher_001', 'gvcnql', 'thptql', 'teacher', 'Nguyễn Thanh Cong')
ON CONFLICT (id) DO NOTHING;

-- Tài khoản học sinh
INSERT INTO accounts (id, username, password, role, display_name, student_id, team) VALUES
    ('acc_HS001', 'HS001', '123456', 'student', 'Nguyễn Văn An', 'HS001', 'Tổ 1'),
    ('acc_HS002', 'HS002', '123456', 'student', 'Trần Thị Bình', 'HS002', 'Tổ 1'),
    ('acc_HS003', 'HS003', '123456', 'student', 'Lê Văn Cường', 'HS003', 'Tổ 1'),
    ('acc_HS004', 'HS004', '123456', 'student', 'Phạm Thị Dung', 'HS004', 'Tổ 2'),
    ('acc_HS005', 'HS005', '123456', 'student', 'Hoàng Văn Em', 'HS005', 'Tổ 2'),
    ('acc_HS006', 'HS006', '123456', 'student', 'Võ Thị Phương', 'HS006', 'Tổ 2'),
    ('acc_HS007', 'HS007', '123456', 'student', 'Đặng Quốc Hùng', 'HS007', 'Tổ 3'),
    ('acc_HS008', 'HS008', '123456', 'student', 'Bùi Thị Hoa', 'HS008', 'Tổ 3'),
    ('acc_HS009', 'HS009', '123456', 'student', 'Ngô Thanh Tùng', 'HS009', 'Tổ 3'),
    ('acc_HS010', 'HS010', '123456', 'student', 'Lý Thị Kim', 'HS010', 'Tổ 4'),
    ('acc_HS011', 'HS011', '123456', 'student', 'Trịnh Minh Đức', 'HS011', 'Tổ 4'),
    ('acc_HS012', 'HS012', '123456', 'student', 'Huỳnh Thị Lan', 'HS012', 'Tổ 4'),
    ('acc_HS013', 'HS013', '123456', 'student', 'Mai Xuân Trường', 'HS013', 'Tổ 1'),
    ('acc_HS014', 'HS014', '123456', 'student', 'Đỗ Thị Ngọc', 'HS014', 'Tổ 2'),
    ('acc_HS015', 'HS015', '123456', 'student', 'Phan Văn Khải', 'HS015', 'Tổ 3')
ON CONFLICT (id) DO NOTHING;
