import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function extractFirstName(fullName: string): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1]; // In Vietnamese, first name is the last word
}

export function sortByName<T extends { name: string }>(a: T, b: T): number {
    const firstNameA = extractFirstName(a.name);
    const firstNameB = extractFirstName(b.name);
    const cmp = firstNameA.localeCompare(firstNameB, 'vi');
    if (cmp !== 0) return cmp;
    // If first names are same, compare full names
    return a.name.localeCompare(b.name, 'vi');
}

export function generateBaseUsername(fullName: string): string {
    if (!fullName) return '';
    const noAccents = fullName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    return 'hs_' + noAccents;
}
