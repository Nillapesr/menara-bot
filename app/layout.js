import './globals.css';
import './brutalism.css';
import { AuthProvider } from '@/components/AuthContext';

export const metadata = {
  title: 'Menara — Panel Bot Telegram',
  description: 'Deploy dan kelola banyak bot Telegram sekaligus, langsung dari browser.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
