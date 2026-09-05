import './globals.css';
import '../styles/landingpage.css';
import '../styles/navbar.css';
import '../styles/footer.css';
import '../styles/auth.css';
import '../styles/loading.css';
import '../styles/dashboard.css';
import '../styles/dashboard-shell.css';
import '../styles/financial-dashboard.css';
import '../styles/graphs.css';
import '../styles/masterdata.css';
import '../styles/forms.css';
import '../styles/masters.css';
import '../styles/transactions.css';
import '../styles/budgets.css';
import '../styles/reports.css';
import '../styles/auditlogs.css';
import '../styles/portal.css';

export const metadata = {
  title: 'Furnova — Accounting Built for Furniture Businesses',
  description: 'Double-entry accounting for furniture retail: master data, transactions, automatic journal entries and real-time financial reports.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Sora:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
