import React from 'react';
import { StatusAtendimento } from '@/types/atendimento';

interface StatusBadgeProps {
  status: StatusAtendimento;
  size?: 'sm' | 'md';
}

export const STATUS_CONFIG: Record<
  StatusAtendimento,
  {
    label: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  AGUARDANDO: {
    label: 'Em Aguardo',
    badgeClass:
      'bg-amber-100 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500',
  },
  EM_PROCESSO: {
    label: 'Em Processo',
    badgeClass:
      'bg-blue-100 text-blue-800 border-blue-300',
    dotClass: 'bg-blue-500',
  },
  ATENDIDO: {
    label: 'Atendido',
    badgeClass:
      'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClass:
      'bg-rose-100 text-rose-800 border-rose-300',
    dotClass: 'bg-rose-500',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.AGUARDANDO;
  const padding = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${padding} ${config.badgeClass}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}
