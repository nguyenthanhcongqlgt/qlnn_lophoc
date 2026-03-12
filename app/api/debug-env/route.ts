import { NextResponse } from 'next/server';
import { hasPostgres, getStore } from '@/lib/memory-store';
export async function GET() {
    let accounts: any = getStore().accounts;
    let accountsSource = 'memory/file';

    if (hasPostgres()) {
        try {
            const { sql } = await import('@vercel/postgres');
            const { rows } = await sql`SELECT id, username, role, display_name FROM accounts`;
            accounts = rows;
            accountsSource = 'postgres';
        } catch (e) {
            accountsSource = 'postgres-error: ' + (e as Error).message;
        }
    }

    return NextResponse.json({
        hasPostgres: hasPostgres(),
        postgresUrlPrefix: process.env.POSTGRES_URL ? process.env.POSTGRES_URL.substring(0, 20) : null,
        accountsSource,
        accountsKeyCount: Array.isArray(accounts) ? accounts.length : Object.keys(accounts).length,
        accounts
    });
}
