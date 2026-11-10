import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function hashPassword(senha: string): string {
  return crypto.createHash('sha256').update(senha).digest('hex');
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth
 * Retorna a lista de administradores cadastrados (sem expor a senha)
 * Se ainda não houver nenhum admin cadastrado, cria o admin padrão inicial: admin / cd123456
 */
export async function GET() {
  try {
    let admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        nome: true,
        usuario: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (admins.length === 0) {
      const padrao = await prisma.adminUser.create({
        data: {
          nome: 'Administrador CD Consultoria',
          usuario: 'admin',
          senhaHash: hashPassword('cd123456'),
        },
        select: {
          id: true,
          nome: true,
          usuario: true,
          createdAt: true,
        },
      });
      admins = [padrao];
    }

    return NextResponse.json({ admins }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/auth] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar usuários administradores.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth
 * Realiza login (action: "login") ou cria/atualiza usuário administrador (action: "register")
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, nome, usuario, senha } = body;

    if (!usuario || !senha) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const userClean = String(usuario).trim().toLowerCase();
    const passHash = hashPassword(String(senha));

    // Garante que existe ao menos o admin padrão caso o banco esteja vazio
    const totalAdmins = await prisma.adminUser.count();
    if (totalAdmins === 0) {
      await prisma.adminUser.create({
        data: {
          nome: 'Administrador CD Consultoria',
          usuario: 'admin',
          senhaHash: hashPassword('cd123456'),
        },
      });
    }

    if (action === 'register') {
      const existente = await prisma.adminUser.findUnique({
        where: { usuario: userClean },
      });

      if (existente) {
        // Atualiza a senha e o nome caso o usuário já exista
        const atualizado = await prisma.adminUser.update({
          where: { usuario: userClean },
          data: {
            nome: nome?.trim() || existente.nome,
            senhaHash: passHash,
          },
          select: {
            id: true,
            nome: true,
            usuario: true,
            createdAt: true,
          },
        });
        return NextResponse.json(
          {
            message: 'Administrador atualizado com sucesso!',
            user: atualizado,
          },
          { status: 200 }
        );
      }

      const novoAdmin = await prisma.adminUser.create({
        data: {
          nome: nome?.trim() || 'Consultor(a) CD',
          usuario: userClean,
          senhaHash: passHash,
        },
        select: {
          id: true,
          nome: true,
          usuario: true,
          createdAt: true,
        },
      });

      return NextResponse.json(
        {
          message: 'Novo administrador criado com sucesso!',
          user: novoAdmin,
        },
        { status: 201 }
      );
    }

    // Ação padrão: Login
    const admin = await prisma.adminUser.findUnique({
      where: { usuario: userClean },
    });

    if (!admin || admin.senhaHash !== passHash) {
      return NextResponse.json(
        { error: 'Usuário ou senha inválidos.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: admin.id,
          nome: admin.nome,
          usuario: admin.usuario,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[POST /api/auth] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno na autenticação.' },
      { status: 500 }
    );
  }
}
