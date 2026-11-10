import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CD Consultoria de Viagem | Painel de Atendimento WhatsApp',
  description:
    'Sistema de triagem inteligente e gestão de orçamentos da CD Consultoria de Viagem.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
