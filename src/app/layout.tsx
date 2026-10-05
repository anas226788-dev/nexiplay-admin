import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AdminShell from '@/components/AdminShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: {
        template: '%s | Nexiplay Admin',
        default: 'Nexiplay Admin Panel',
    },
    description: 'Admin Dashboard for Nexiplay OTT Platform',
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    }
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} min-h-screen bg-black`} suppressHydrationWarning>
                <AdminShell>
                    {children}
                </AdminShell>
            </body>
        </html>
    );
}
