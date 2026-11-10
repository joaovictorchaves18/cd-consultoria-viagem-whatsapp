'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import {
  Users,
  Phone,
  MapPin,
  Calendar,
  Compass,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Bot,
  UserCheck,
  AlertCircle,
  Plane,
  Lock,
  UserPlus,
  LogOut,
  ShieldCheck,
  KeyRound,
  User,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  Atendimento,
  StatusAtendimento,
  AdminUserInfo,
} from '@/types/atendimento';
import { StatusBadge, STATUS_CONFIG } from '@/components/StatusBadge';

const fetcher = async (url: string): Promise<Atendimento[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Falha ao carregar fila de atendimentos');
  }
  return res.json();
};

type FiltroTab = 'TODOS' | StatusAtendimento;

const TABS: {
  id: FiltroTab;
  label: string;
  accentColor: string;
  badgeBg: string;
}[] = [
  {
    id: 'TODOS',
    label: 'Todos',
    accentColor: 'border-blue-900 text-blue-950',
    badgeBg: 'bg-slate-200 text-slate-800',
  },
  {
    id: 'AGUARDANDO',
    label: 'Em Aguardo',
    accentColor: 'border-amber-500 text-amber-800',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'EM_PROCESSO',
    label: 'Em Processo',
    accentColor: 'border-blue-600 text-blue-800',
    badgeBg: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'ATENDIDO',
    label: 'Atendido',
    accentColor: 'border-emerald-600 text-emerald-800',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'CANCELADO',
    label: 'Cancelado',
    accentColor: 'border-rose-500 text-rose-800',
    badgeBg: 'bg-rose-100 text-rose-800',
  },
];

function formatarTelefone(tel: string) {
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 13 && limpo.startsWith('55')) {
    return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
  }
  if (limpo.length === 12 && limpo.startsWith('55')) {
    return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`;
  }
  return `+${limpo}`;
}

function formatarDataHora(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  // Estados de Autenticação Admin
  const [adminLogado, setAdminLogado] = useState<AdminUserInfo | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [abaAuth, setAbaAuth] = useState<'login' | 'register'>('login');
  const [authNome, setAuthNome] = useState('');
  const [authUsuario, setAuthUsuario] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authErro, setAuthErro] = useState<string | null>(null);
  const [authSucesso, setAuthSucesso] = useState<string | null>(null);
  const [authCarregando, setAuthCarregando] = useState(false);

  // Modal de gerenciamento/criação de Admin dentro do Dashboard
  const [modalAdminAberto, setModalAdminAberto] = useState(false);
  const [listaAdmins, setListaAdmins] = useState<AdminUserInfo[]>([]);

  // Estados do Dashboard
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroTab>('TODOS');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<
    string | null
  >(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  // Carrega sessão salva no navegador
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('cd_consultoria_admin');
      if (salvo) {
        setAdminLogado(JSON.parse(salvo));
      }
    } catch {
      // ignora erro de storage
    } finally {
      setVerificandoSessao(false);
    }
  }, []);

  async function carregarListaAdmins() {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        setListaAdmins(data.admins || []);
      }
    } catch {
      // ignora erro
    }
  }

  useEffect(() => {
    if (modalAdminAberto) {
      carregarListaAdmins();
    }
  }, [modalAdminAberto]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthErro(null);
    setAuthSucesso(null);
    setAuthCarregando(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: abaAuth,
          nome: authNome,
          usuario: authUsuario,
          senha: authSenha,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthErro(data.error || 'Falha na autenticação.');
        return;
      }

      if (abaAuth === 'register') {
        setAuthSucesso(
          data.message || 'Usuário administrador salvo com sucesso!'
        );
        setAuthNome('');
        setAuthSenha('');
        carregarListaAdmins();
        // Se estava na tela inicial de login, já loga o usuário criado
        if (!adminLogado && data.user) {
          setAdminLogado(data.user);
          localStorage.setItem(
            'cd_consultoria_admin',
            JSON.stringify(data.user)
          );
        }
      } else if (data.user) {
        setAdminLogado(data.user);
        localStorage.setItem('cd_consultoria_admin', JSON.stringify(data.user));
        setAuthUsuario('');
        setAuthSenha('');
      }
    } catch {
      setAuthErro('Erro de conexão com o servidor.');
    } finally {
      setAuthCarregando(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('cd_consultoria_admin');
    setAdminLogado(null);
  }

  // Polling leve a cada 10s via SWR
  const {
    data: atendimentos = [],
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<Atendimento[]>(
    adminLogado ? '/api/atendimentos' : null,
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  );

  // Contadores rápidos por status no Header
  const contadores = useMemo(() => {
    const counts: Record<FiltroTab, number> = {
      TODOS: atendimentos.length,
      AGUARDANDO: 0,
      EM_PROCESSO: 0,
      ATENDIDO: 0,
      CANCELADO: 0,
    };

    for (const item of atendimentos) {
      if (counts[item.status] !== undefined) {
        counts[item.status] += 1;
      }
    }
    return counts;
  }, [atendimentos]);

  // Lista filtrada respeitando a ordem FIFO (createdAt asc)
  const filaFiltrada = useMemo(() => {
    if (filtroAtivo === 'TODOS') return atendimentos;
    return atendimentos.filter((a) => a.status === filtroAtivo);
  }, [atendimentos, filtroAtivo]);

  // Cliente ativo no painel direito
  const clienteSelecionado = useMemo(() => {
    if (!clienteSelecionadoId) return filaFiltrada[0] || null;
    return (
      atendimentos.find((a) => a.id === clienteSelecionadoId) ||
      filaFiltrada[0] ||
      null
    );
  }, [atendimentos, filaFiltrada, clienteSelecionadoId]);

  // Função para atualizar o status do atendimento no backend
  async function alterarStatusCliente(
    id: string,
    novoStatus: StatusAtendimento
  ) {
    try {
      setAtualizandoStatus(true);

      mutate(
        (atuais = []) =>
          atuais.map((item) =>
            item.id === id ? { ...item, status: novoStatus } : item
          ),
        false
      );

      const response = await fetch(`/api/atendimentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar status.');
      }

      await mutate();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      await mutate();
    } finally {
      setAtualizandoStatus(false);
    }
  }

  // Botão "Abrir WhatsApp Web": redireciona para wa.me/{telefone} e muda status automaticamente para EM_PROCESSO
  async function handleAbrirWhatsApp(cliente: Atendimento) {
    const telefoneLimpo = cliente.telefone.replace(/\D/g, '');
    const urlWhatsApp = `https://wa.me/${telefoneLimpo}`;

    window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');

    if (cliente.status !== 'EM_PROCESSO') {
      await alterarStatusCliente(cliente.id, 'EM_PROCESSO');
    }
  }

  if (verificandoSessao) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold">
            CD
          </div>
          <span className="text-sm text-slate-300">
            Carregando CD Consultoria de Viagem...
          </span>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // TELA DE LOGIN / CRIAÇÃO DE USUÁRIO ADMINISTRADOR
  // ===========================================================================
  if (!adminLogado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
          {/* Topo Institucional CD Consultoria */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 text-white text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur border border-white/25 mx-auto flex items-center justify-center shadow-lg mb-4">
              <Plane className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              CD Consultoria de Viagem
            </h1>
            <p className="text-xs text-blue-200 mt-1">
              Painel Administrativo • Gestão de Orçamentos & Atendimento WhatsApp
            </p>
          </div>

          {/* Seletor Login vs Criar Admin */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setAbaAuth('login');
                setAuthErro(null);
                setAuthSucesso(null);
              }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition ${
                abaAuth === 'login'
                  ? 'border-blue-700 text-blue-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Entrar no Painel
            </button>
            <button
              type="button"
              onClick={() => {
                setAbaAuth('register');
                setAuthErro(null);
                setAuthSucesso(null);
              }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition ${
                abaAuth === 'register'
                  ? 'border-blue-700 text-blue-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Criar / Definir Admin
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="p-8 space-y-4">
            {authErro && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authErro}</span>
              </div>
            )}

            {authSucesso && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{authSucesso}</span>
              </div>
            )}

            {abaAuth === 'register' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nome do Consultor / Admin
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: João - CD Consultoria"
                    value={authNome}
                    onChange={(e) => setAuthNome(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Usuário de Acesso
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ex: admin"
                  value={authUsuario}
                  onChange={(e) => setAuthUsuario(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha"
                  value={authSenha}
                  onChange={(e) => setAuthSenha(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authCarregando}
              className="w-full py-3 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-bold text-sm shadow-md transition disabled:opacity-60"
            >
              {authCarregando
                ? 'Processando...'
                : abaAuth === 'login'
                ? 'Acessar Dashboard CD Consultoria'
                : 'Criar Conta Admin e Entrar'}
            </button>

            <div className="pt-3 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-500">
                Acesso padrão inicial:{' '}
                <strong className="text-slate-700">admin</strong> / senha:{' '}
                <strong className="text-slate-700">cd123456</strong> (ou crie seu
                próprio usuário na aba ao lado).
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const resumo = clienteSelecionado?.resumoViagem || {};
  const temDadosResumo =
    resumo &&
    Object.values(resumo).some((v) => v && String(v).trim().length > 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* TOPO / HEADER PERSONALIZADO CD CONSULTORIA DE VIAGEM */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-800 flex items-center justify-center text-white shadow-md border border-blue-700">
                <Plane className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                    CD Consultoria de Viagem
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Painel de Orçamentos
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Triagem Inteligente WhatsApp (5 Etapas) & Transbordo para Consultor
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isValidating ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'
                  }`}
                />
                Sincronização 10s
              </span>

              <button
                onClick={() => mutate()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                title="Atualizar fila agora"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`}
                />
                Atualizar
              </button>

              {/* Botão para Criar / Gerenciar Usuários Admin */}
              <button
                onClick={() => {
                  setAbaAuth('register');
                  setAuthErro(null);
                  setAuthSucesso(null);
                  setModalAdminAberto(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Usuários Admin
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                  {adminLogado.nome}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition"
                  title="Sair do painel"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            </div>
          </div>

          {/* ABAS / CARDS DE FILTRO RÁPIDO COM CONTADORES */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5">
            {TABS.map((tab) => {
              const ativo = filtroAtivo === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFiltroAtivo(tab.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    ativo
                      ? `bg-white shadow-sm border-2 ${tab.accentColor} font-semibold`
                      : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm truncate">{tab.label}</span>
                  <span
                    className={`ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full ${tab.badgeBg}`}
                  >
                    {contadores[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              Não foi possível carregar os atendimentos. Verifique a conexão com o banco PostgreSQL.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA ESQUERDA: FILA DE CLIENTES (FIFO) */}
          <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-230px)]">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-800" />
                <h2 className="text-sm font-bold text-slate-800">
                  Fila de Clientes • CD Consultoria
                </h2>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {filaFiltrada.length}{' '}
                {filaFiltrada.length === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Carregando fila de clientes...
                </div>
              ) : filaFiltrada.length === 0 ? (
                <div className="p-10 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">
                    Nenhum atendimento neste filtro
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Novos pedidos de orçamento da CD Consultoria aparecerão aqui.
                  </p>
                </div>
              ) : (
                filaFiltrada.map((cliente, index) => {
                  const selecionado = clienteSelecionado?.id === cliente.id;
                  const nomeExibicao =
                    cliente.resumoViagem?.nome ||
                    cliente.nome ||
                    'Cliente em Triagem';

                  return (
                    <button
                      key={cliente.id}
                      onClick={() => setClienteSelecionadoId(cliente.id)}
                      className={`w-full text-left p-4 transition flex flex-col gap-2 hover:bg-slate-50 ${
                        selecionado
                          ? 'bg-blue-50/70 border-l-4 border-l-blue-800'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-400">
                              #{index + 1}
                            </span>
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {nomeExibicao}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {formatarTelefone(cliente.telefone)}
                          </p>
                        </div>

                        <StatusBadge status={cliente.status} size="sm" />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span className="inline-flex items-center gap-1">
                          {cliente.etapaBot === 'FINALIZADO_BOT' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <UserCheck className="w-3.5 h-3.5" />
                              Pronto p/ Orçamento
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <Bot className="w-3.5 h-3.5" />
                              Em Triagem (5 Etapas)
                            </span>
                          )}
                        </span>
                        <span>Entrada: {formatarDataHora(cliente.createdAt)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* COLUNA DIREITA: FICHA DE ORÇAMENTO (5 CAMPOS DA CD CONSULTORIA) */}
          <section className="lg:col-span-8">
            {!clienteSelecionado ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-700">
                  Selecione um cliente na fila ao lado
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Confira os 5 dados coletados pelo bot da CD Consultoria de Viagem e envie o orçamento via WhatsApp Web.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* CABEÇALHO DO CLIENTE SELECIONADO */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-bold text-slate-900">
                          {resumo.nome ||
                            clienteSelecionado.nome ||
                            'Cliente sem nome identificado'}
                        </h2>
                        <StatusBadge status={clienteSelecionado.status} />
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                            clienteSelecionado.etapaBot === 'FINALIZADO_BOT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {clienteSelecionado.etapaBot === 'FINALIZADO_BOT'
                            ? 'Triagem Concluída • Pronto para Orçar'
                            : 'Respondendo Triagem no WhatsApp'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {formatarTelefone(clienteSelecionado.telefone)}
                        </span>
                        <span>
                          Criado em: {formatarDataHora(clienteSelecionado.createdAt)}
                        </span>
                        <span>
                          Atualizado:{' '}
                          {formatarDataHora(clienteSelecionado.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* BOTÃO DE AÇÃO DIRETA: ABRIR WHATSAPP WEB */}
                    <button
                      onClick={() => handleAbrirWhatsApp(clienteSelecionado)}
                      disabled={atualizandoStatus}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm shadow-sm transition shrink-0 disabled:opacity-60"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir WhatsApp Web
                    </button>
                  </div>

                  {/* CONTROLE DE STATUS */}
                  <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Alterar Status do Atendimento:
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          'AGUARDANDO',
                          'EM_PROCESSO',
                          'ATENDIDO',
                          'CANCELADO',
                        ] as StatusAtendimento[]
                      ).map((statusOption) => {
                        const cfg = STATUS_CONFIG[statusOption];
                        const isCurrent =
                          clienteSelecionado.status === statusOption;

                        return (
                          <button
                            key={statusOption}
                            disabled={atualizandoStatus || isCurrent}
                            onClick={() =>
                              alterarStatusCliente(
                                clienteSelecionado.id,
                                statusOption
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              isCurrent
                                ? `${cfg.badgeClass} ring-2 ring-offset-1 ring-slate-400 cursor-default`
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${cfg.dotClass}`}
                            />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* CORPO DA FICHA TÉCNICA (5 CAMPOS DA CD CONSULTORIA DE VIAGEM) */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Ficha de Orçamento • CD Consultoria de Viagem (5 Etapas)
                    </h3>
                    {clienteSelecionado.etapaBot !== 'FINALIZADO_BOT' && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                        Preenchendo em tempo real via WhatsApp...
                      </span>
                    )}
                  </div>

                  {!temDadosResumo ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                      <Bot className="w-9 h-9 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">
                        Aguardando respostas das 5 perguntas no WhatsApp
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        O bot da CD Consultoria está coletando: Nome, Período da Viagem, Forma de Viagem, Aeroporto de Chegada e Quantidade de Pessoas.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card 1: Nome do Cliente */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3.5">
                        <div className="p-2.5 rounded-lg bg-blue-100 text-blue-800">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            1. Nome do Cliente
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-1">
                            {resumo.nome ||
                              clienteSelecionado.nome ||
                              'Aguardando resposta...'}
                          </p>
                        </div>
                      </div>

                      {/* Card 2: Período de Viagem */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3.5">
                        <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            2. Período de Viagem
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-1">
                            {resumo.periodo || 'Aguardando resposta...'}
                          </p>
                        </div>
                      </div>

                      {/* Card 3: Forma de Viagem */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3.5">
                        <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-800">
                          <Compass className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            3. Forma de Viagem
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-1">
                            {resumo.formaViagem ||
                              resumo.estilo ||
                              'Aguardando resposta...'}
                          </p>
                        </div>
                      </div>

                      {/* Card 4: Aeroporto de Chegada */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3.5">
                        <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            4. Aeroporto de Chegada
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-1">
                            {resumo.aeroportoChegada ||
                              resumo.destinos ||
                              resumo.origem ||
                              'Aguardando resposta...'}
                          </p>
                        </div>
                      </div>

                      {/* Card 5: Quantidade de Pessoas */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3.5 md:col-span-2">
                        <div className="p-2.5 rounded-lg bg-purple-100 text-purple-800">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            5. Quantidade de Pessoas
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-1">
                            {resumo.quantidadePessoas ||
                              resumo.viajantes ||
                              'Aguardando resposta...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dica da Mensagem de Ativação do Site */}
                  <div className="mt-6 p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900">
                    <div>
                      <span className="font-bold">
                        Mensagem de ativação do Bot (Gatilho do Site):
                      </span>{' '}
                      <code className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-950">
                        Olá! Vim pelo site da CD Consultoria de Viagem e gostaria de fazer um orçamento.
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* MODAL PARA CRIAR / ATUALIZAR USUÁRIOS ADMIN */}
      {modalAdminAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">
                  Gerenciar Administradores • CD Consultoria
                </h3>
              </div>
              <button
                onClick={() => setModalAdminAberto(false)}
                className="text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <p className="text-xs text-slate-600">
                  Cadastre um novo usuário administrador ou digite um usuário já existente para atualizar sua senha:
                </p>

                {authErro && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {authErro}
                  </div>
                )}
                {authSucesso && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                    {authSucesso}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: João"
                      value={authNome}
                      onChange={(e) => setAuthNome(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Login (Usuário)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: joao"
                      value={authUsuario}
                      onChange={(e) => setAuthUsuario(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Digite a senha"
                    value={authSenha}
                    onChange={(e) => setAuthSenha(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authCarregando}
                  className="w-full py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition"
                >
                  {authCarregando ? 'Salvando...' : 'Salvar Usuário e Senha'}
                </button>
              </form>

              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Administradores Cadastrados ({listaAdmins.length})
                </h4>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto border border-slate-200 rounded-xl">
                  {listaAdmins.map((adm) => (
                    <div
                      key={adm.id}
                      className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">
                          {adm.nome}
                        </span>
                        <span className="ml-2 text-slate-500">
                          (@{adm.usuario})
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[10px]">
                        Ativo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
