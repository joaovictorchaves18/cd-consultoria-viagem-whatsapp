import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STATUS_PERMITIDOS = ['AGUARDANDO', 'EM_PROCESSO', 'ATENDIDO', 'CANCELADO'];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    if (statusParam && !STATUS_PERMITIDOS.includes(statusParam)) {
      return NextResponse.json(
        {
          error: `Filtro de status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const whereClause = statusParam ? { status: statusParam } : {};

    // Ordenação FIFO (First-In, First-Out): createdAt asc
    const atendimentos = await prisma.atendimento.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(atendimentos, { status: 200 });
  } catch (error) {
    console.error('[GET /api/atendimentos] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar a fila de atendimentos.' },
      { status: 500 }
    );
  }
}
