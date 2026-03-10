import { NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';
export async function GET() {
    return NextResponse.json({
        hasPostgres: hasPostgres(),
        postgresUrlPrefix: process.env.POSTGRES_URL ? process.env.POSTGRES_URL.substring(0, 20) : null,
        cwd: process.cwd(),
        accountsKeyCount: Object.keys(getStore().accounts).length,
        accounts: getStore().accounts
    });
}
