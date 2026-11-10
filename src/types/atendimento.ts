export type StatusAtendimento =
  | 'AGUARDANDO'
  | 'EM_PROCESSO'
  | 'ATENDIDO'
  | 'CANCELADO';

export type EtapaBot = 'EM_TRIAGEM' | 'FINALIZADO_BOT';

export interface ResumoViagem {
  nome?: string;
  periodo?: string;
  formaViagem?: string;
  aeroportoChegada?: string;
  quantidadePessoas?: string;
  // Campos legados caso haja registros anteriores no banco
  viajantes?: string;
  origem?: string;
  duracao?: string;
  destinos?: string;
  interesses?: string;
  orcamento?: string;
  inclusoes?: string;
  estilo?: string;
}

export interface MensagemHistorico {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Atendimento {
  id: string;
  telefone: string;
  nome: string | null;
  status: StatusAtendimento;
  etapaBot: EtapaBot;
  resumoViagem: ResumoViagem | null;
  historico: MensagemHistorico[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserInfo {
  id: string;
  nome: string;
  usuario: string;
  createdAt?: string;
}
