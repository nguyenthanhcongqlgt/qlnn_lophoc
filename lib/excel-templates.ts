// ===== Excel Import/Export Templates =====
// Uses 'xlsx' (SheetJS) for parsing and generating Excel files on the client side

import * as XLSX from 'xlsx';
import type { Student, IncidentType, LogType } from '@/types';

// ── Download Sample Templates ──

export function downloadStudentTemplate() {
    const wb = XLSX.utils.book_new();
    const data = [
        ['STT', 'Họ và tên', 'Ngày sinh', 'Tổ'],
        [1, 'Nguyễn Văn A', '01/01/2010', 'Tổ 1'],
        [2, 'Trần Thị B', '15/05/2010', 'Tổ 2'],
        [3, 'Lê Văn C', '20/11/2010', 'Tổ 3'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
    XLSX.writeFile(wb, 'MauDanhSachHocSinh.xlsx');
}

export function downloadIncidentTemplate(type: LogType) {
    const wb = XLSX.utils.book_new();
    const isViolation = type === 'violation';
    const data = [
        ['STT', 'Nội dung', 'Điểm'],
        [1, isViolation ? 'Đi học muộn' : 'Phát biểu xây dựng bài', isViolation ? -2 : 2],
        [2, isViolation ? 'Không thuộc bài' : 'Giúp đỡ bạn bè', isViolation ? -5 : 5],
        [3, isViolation ? 'Mất trật tự' : 'Nhặt được của rơi', isViolation ? -2 : 10],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, isViolation ? 'ViPham' : 'ViecTot');
    XLSX.writeFile(wb, isViolation ? 'MauDanhSachViPham.xlsx' : 'MauDanhSachViecTot.xlsx');
}

// ── Parse Excel Files ──

export interface ParseResult<T> {
    data: T[];
    errors: string[];
}

export function parseStudentExcel(file: File): Promise<ParseResult<Omit<Student, 'id' | 'note'>>> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                const results: Omit<Student, 'id' | 'note'>[] = [];
                const errors: string[] = [];

                // Skip header row (row 0)
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const name = String(row[1] || '').trim();
                    const dob = String(row[2] || '').trim();
                    const team = String(row[3] || '').trim();

                    if (!name) {
                        errors.push(`Dòng ${i + 1}: Thiếu họ tên`);
                        continue;
                    }
                    if (!team) {
                        errors.push(`Dòng ${i + 1}: Thiếu tổ`);
                        continue;
                    }

                    results.push({ name, dateOfBirth: dob, team, initialScore: 100 });
                }

                resolve({ data: results, errors });
            } catch {
                resolve({ data: [], errors: ['Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng.'] });
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

export function parseIncidentExcel(file: File, type: LogType): Promise<ParseResult<IncidentType>> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                const results: IncidentType[] = [];
                const errors: string[] = [];
                const prefix = type === 'violation' ? 'V' : 'A';

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const content = String(row[1] || '').trim();
                    const point = Number(row[2]);

                    if (!content) {
                        errors.push(`Dòng ${i + 1}: Thiếu nội dung`);
                        continue;
                    }
                    if (isNaN(point)) {
                        errors.push(`Dòng ${i + 1}: Điểm không hợp lệ`);
                        continue;
                    }

                    const id = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
                    results.push({ id, content, point, type });
                }

                resolve({ data: results, errors });
            } catch {
                resolve({ data: [], errors: ['Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng.'] });
            }
        };
        reader.readAsArrayBuffer(file);
    });
}
