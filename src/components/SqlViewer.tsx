/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Database, Shield, Server, Terminal } from 'lucide-react';

export default function SqlViewer() {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedAction, setCopiedAction] = useState(false);

  const sqlScript = `-- ==========================================
-- SCRIPT SQL COMPLETO PARA O SUPABASE
-- tabelas + RLS + Políticas de Segurança (auth.uid())
-- ==========================================

-- 1. Ativação do UUID no Postgres (se não ativo)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA: USUÁRIOS (Sincronizado/referenciado ao auth.users do Supabase)
CREATE TABLE public.usuarios (
  "idUsuario" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA: CONTAS
CREATE TABLE public.contas (
  "idConta" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "idUsuario" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  instituicao VARCHAR(100),
  "saldoInicial" NUMERIC(15,2) DEFAULT 0.00,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA: CATEGORIAS
CREATE TABLE public.categorias (
  "idCategoria" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "idUsuario" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(10) CHECK (tipo IN ('RECEITA', 'DESPESA')) NOT NULL,
  cor VARCHAR(7) DEFAULT '#64748b',
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 5. TABELA: LANÇAMENTOS (Com suporte a Transferência e Categoria Opcional)
CREATE TABLE public.lancamentos (
  "idLancamento" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "idUsuario" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "idConta" UUID NOT NULL REFERENCES public.contas("idConta") ON DELETE CASCADE,
  "idCategoria" UUID REFERENCES public.categorias("idCategoria") ON DELETE SET NULL,
  "dataPgto" DATE NOT NULL,
  "dataLancamento" DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC(15,2) NOT NULL, -- Valores positivos = Receitas, Negativos = Despesas
  descricao TEXT NOT NULL,
  "transferenciaId" UUID, -- Vincula transações de transferência para exclusão em lote
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- REQUISITO CRÍTICO DE SEGURANÇA: RLS POLICIES
-- ==========================================

-- Ativar Row Level Security (RLS) para todas as tabelas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para public.usuarios
CREATE POLICY "Permitir leitura do próprio usuário" ON public.usuarios
  FOR SELECT USING (auth.uid() = "idUsuario");

CREATE POLICY "Permitir inserção do próprio usuário" ON public.usuarios
  FOR INSERT WITH CHECK (auth.uid() = "idUsuario");

CREATE POLICY "Permitir atualização do próprio usuário" ON public.usuarios
  FOR UPDATE USING (auth.uid() = "idUsuario");

-- Políticas para public.contas
CREATE POLICY "Contas: Usuários podem gerenciar suas próprias contas" ON public.contas
  FOR ALL USING (auth.uid() = "idUsuario") WITH CHECK (auth.uid() = "idUsuario");

-- Políticas para public.categorias
CREATE POLICY "Categorias: Usuários podem gerenciar suas próprias categorias" ON public.categorias
  FOR ALL USING (auth.uid() = "idUsuario") WITH CHECK (auth.uid() = "idUsuario");

-- Políticas para public.lancamentos
CREATE POLICY "Lançamentos: Usuários podem gerenciar seus próprios lançamentos" ON public.lancamentos
  FOR ALL USING (auth.uid() = "idUsuario") WITH CHECK (auth.uid() = "idUsuario");

-- ==========================================
-- TRIGGER AUTOMÁTICO: Criação de Usuário ao Registrar Auth
-- Sincroniza auth.users do Supabase com nossa tabela pública.usuarios
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios ("idUsuario", nome, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', 'Novo Usuário'),
    new.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;

  const serverActionCode = `/**
 * FUNÇÃO DE BACKEND / SERVER ACTION (Node.js / Express / NextJS Server Action)
 * Processa o lote (Bulk Insert) de lançamentos de forma segura.
 * 
 * Garante que:
 * 1. O ID do usuário autenticado no servidor seja atribuído aos registros.
 * 2. Transações de transferência permaneçam vinculadas por UUID.
 * 3. A gravação ocorra em lote único (bulk insert) no banco de dados.
 */

import { createClient } from '@supabase/supabase-js';

// Inicialização do cliente com a chave Service Role (Segura no Servidor)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Chave secreta que ignora RLS apenas para operações legítimas do sistema
);

interface BulkInsertRequest {
  idConta: string;
  idCategoria?: string;
  dataPgto: string; // YYYY-MM-DD
  valor: number;
  descricao: string;
  transferenciaId?: string;
}

/**
 * Server Action / API Handler seguro para bulk insert de lançamentos
 */
export async function handleBulkInsert(
  usuarioAutenticadoId: string, // Obtido do cabeçalho de autenticação ou sessão (JWT seguro)
  lancamentosReconciliados: BulkInsertRequest[]
) {
  if (!usuarioAutenticadoId) {
    throw new Error("Não autorizado. Usuário não autenticado.");
  }

  if (!lancamentosReconciliados || lancamentosReconciliados.length === 0) {
    return { success: true, count: 0, message: "Nenhum lançamento fornecido." };
  }

  // Prepara os dados acoplando obrigatoriamente o idUsuario do servidor para evitar fraude
  const dadosParaInsercao = lancamentosReconciliados.map(item => {
    // Garante que o valor está formatado devidamente
    const valorTratado = parseFloat(String(item.valor));
    
    return {
      idUsuario: usuarioAutenticadoId, // Segurança: Garante que os registros pertencem apenas ao usuário autenticado
      idConta: item.idConta,
      idCategoria: item.idCategoria || null,
      dataPgto: item.dataPgto,
      dataLancamento: new Date().toISOString().split('T')[0], // data de criação hoje
      valor: valorTratado,
      descricao: item.descricao,
      transferenciaId: item.transferenciaId || null
    };
  });

  try {
    // Insere os registros em lote único (Bulk Insert) usando o Supabase SDK
    const { data, error } = await supabaseAdmin
      .from('lancamentos')
      .insert(dadosParaInsercao)
      .select();

    if (error) {
      console.error("Erro no bulk insert de lançamentos:", error.message);
      throw new Error(\`Erro ao persistir lançamentos: \${error.message}\`);
    }

    return {
      success: true,
      count: data?.length || 0,
      message: \`\${data?.length || 0} lançamentos importados e salvos com sucesso.\`,
      data: data
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erro desconhecido durante a conciliação bancária."
    };
  }
}`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="developer-panel" className="space-y-8 animate-fade-in">
      {/* Introduction Header */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Terminal className="text-emerald-600 w-5 h-5" />
            Central do Arquiteto & Supabase
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Aqui você encontra o script SQL estrutural completo de banco de dados, políticas de segurança RLS (Row Level Security) e a função de backend (Server Action) de gravação em lote.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1 font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          Segurança RLS Ativa
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: SQL Script */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="text-emerald-400 w-4 h-4" />
              <span className="text-xs font-semibold text-slate-200 font-mono">1. supabase_schema.sql</span>
            </div>
            <button
              onClick={() => copyToClipboard(sqlScript, setCopiedSql)}
              className="text-slate-400 hover:text-emerald-400 transition-colors duration-150 p-1.5 rounded hover:bg-slate-800"
              title="Copiar SQL"
              id="copy-sql-btn"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="p-0 flex-1 relative max-h-[500px] overflow-y-auto font-mono text-[11px] leading-relaxed bg-slate-950 text-slate-300">
            <pre className="p-4 overflow-x-auto whitespace-pre">{sqlScript}</pre>
          </div>
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" /> Como aplicar no Supabase:
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Copie o código acima, abra o painel do seu projeto no Supabase, acesse **SQL Editor**, clique em **New Query**, cole o script e clique em **Run**. Todas as tabelas, triggers de usuário e políticas RLS serão configuradas imediatamente!
            </p>
          </div>
        </div>

        {/* Section 2: Server Action / Bulk Insert function */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="text-sky-400 w-4 h-4" />
              <span className="text-xs font-semibold text-slate-200 font-mono">2. server_bulk_insert.ts</span>
            </div>
            <button
              onClick={() => copyToClipboard(serverActionCode, setCopiedAction)}
              className="text-slate-400 hover:text-sky-400 transition-colors duration-150 p-1.5 rounded hover:bg-slate-800"
              title="Copiar Código"
              id="copy-action-btn"
            >
              {copiedAction ? <Check className="w-4 h-4 text-sky-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="p-0 flex-1 relative max-h-[500px] overflow-y-auto font-mono text-[11px] leading-relaxed bg-slate-950 text-slate-300">
            <pre className="p-4 overflow-x-auto whitespace-pre">{serverActionCode}</pre>
          </div>
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-600" /> Princípio de Segurança Garantido:
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Esta função opera no backend onde o `idUsuario` do remetente é extraído da sessão segura (JWT verificado). O array final é enriquecido com o ID real do usuário autenticado no servidor, inviabilizando qualquer falsificação de identidade (ID Spoofing) nas requisições.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
