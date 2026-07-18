/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Conta, Categoria, Lancamento, Usuario } from '../types';

// Load Supabase configuration from environment variables or localStorage override if present
const getSupabaseCredentials = () => {
  let url = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
  let key = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

  if (typeof window !== 'undefined') {
    const overrideUrl = localStorage.getItem('finance_override_supabase_url');
    const overrideKey = localStorage.getItem('finance_override_supabase_key');
    if (overrideUrl && overrideKey) {
      url = overrideUrl;
      key = overrideKey;
    }
  }
  return { url, key };
};

const { url: SUPABASE_URL, key: SUPABASE_ANON_KEY } = getSupabaseCredentials();

export let supabase: SupabaseClient | null = null;

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // ignore and use fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error('Falha ao inicializar o cliente do Supabase:', error);
  }
}

// Initial Seed Data for the Local/Sandbox Engine (to make the app immediately stunning)
const SEED_ACCOUNTS: Conta[] = [
  { idConta: 'acc-1', idUsuario: 'usr-demo', nome: 'Conta Corrente Itaú', instituicao: 'Itaú', saldoInicial: 1500 },
  { idConta: 'acc-2', idUsuario: 'usr-demo', nome: 'Carteira Dinheiro', instituicao: 'Dinheiro', saldoInicial: 200 },
  { idConta: 'acc-3', idUsuario: 'usr-demo', nome: 'Reserva de Emergência', instituicao: 'Nubank', saldoInicial: 5000 },
  { idConta: 'acc-4', idUsuario: 'usr-demo', nome: 'Cartão de Crédito', instituicao: 'Visa', saldoInicial: 0 }
];

const SEED_CATEGORIES: Categoria[] = [
  { idCategoria: 'cat-salario', idUsuario: 'usr-demo', nome: 'Salário & Renda', tipo: 'RECEITA', cor: '#10b981' }, // Emerald-500
  { idCategoria: 'cat-invest', idUsuario: 'usr-demo', nome: 'Investimentos', tipo: 'RECEITA', cor: '#06b6d4' }, // Cyan-500
  { idCategoria: 'cat-alimentacao', idUsuario: 'usr-demo', nome: 'Alimentação', tipo: 'DESPESA', cor: '#f59e0b' }, // Amber-500
  { idCategoria: 'cat-moradia', idUsuario: 'usr-demo', nome: 'Moradia & Aluguel', tipo: 'DESPESA', cor: '#ef4444' }, // Red-500
  { idCategoria: 'cat-transporte', idUsuario: 'usr-demo', nome: 'Transporte', tipo: 'DESPESA', cor: '#3b82f6' }, // Blue-500
  { idCategoria: 'cat-lazer', idUsuario: 'usr-demo', nome: 'Lazer & Viagem', tipo: 'DESPESA', cor: '#8b5cf6' }, // Purple-500
  { idCategoria: 'cat-outros', idUsuario: 'usr-demo', nome: 'Outros Custos', tipo: 'DESPESA', cor: '#64748b' } // Slate-500
];

// Seed transactions distributed across the current month and last month to populate dashboards beautifully
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
const prevMonth = String(today.getMonth() === 0 ? 12 : today.getMonth()).padStart(2, '0');
const prevYear = today.getMonth() === 0 ? currentYear - 1 : currentYear;

const SEED_TRANSACTIONS: Lancamento[] = [
  // Last month's data
  {
    idLancamento: 'tx-prev-1',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-salario',
    dataPgto: `${prevYear}-${prevMonth}-05`,
    dataLancamento: `${prevYear}-${prevMonth}-05`,
    valor: 4500.00,
    descricao: 'Salário Mensal Corporativo'
  },
  {
    idLancamento: 'tx-prev-2',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-moradia',
    dataPgto: `${prevYear}-${prevMonth}-10`,
    dataLancamento: `${prevYear}-${prevMonth}-10`,
    valor: -1200.00,
    descricao: 'Aluguel Apartamento'
  },
  {
    idLancamento: 'tx-prev-3',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-alimentacao',
    dataPgto: `${prevYear}-${prevMonth}-12`,
    dataLancamento: `${prevYear}-${prevMonth}-12`,
    valor: -350.40,
    descricao: 'Supermercado da Família'
  },
  {
    idLancamento: 'tx-prev-4',
    idUsuario: 'usr-demo',
    idConta: 'acc-2',
    idCategoria: 'cat-transporte',
    dataPgto: `${prevYear}-${prevMonth}-15`,
    dataLancamento: `${prevYear}-${prevMonth}-15`,
    valor: -80.00,
    descricao: 'Combustível Posto Ipiranga'
  },
  {
    idLancamento: 'tx-prev-5',
    idUsuario: 'usr-demo',
    idConta: 'acc-3',
    idCategoria: 'cat-invest',
    dataPgto: `${prevYear}-${prevMonth}-20`,
    dataLancamento: `${prevYear}-${prevMonth}-20`,
    valor: 500.00,
    descricao: 'Rendimento de Dividendos'
  },
  {
    idLancamento: 'tx-prev-6',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-lazer',
    dataPgto: `${prevYear}-${prevMonth}-25`,
    dataLancamento: `${prevYear}-${prevMonth}-25`,
    valor: -240.00,
    descricao: 'Jantar Restaurante Japonês'
  },

  // This month's data
  {
    idLancamento: 'tx-curr-1',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-salario',
    dataPgto: `${currentYear}-${currentMonth}-05`,
    dataLancamento: `${currentYear}-${currentMonth}-05`,
    valor: 4800.00,
    descricao: 'Salário Mensal Corporativo'
  },
  {
    idLancamento: 'tx-curr-2',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-moradia',
    dataPgto: `${currentYear}-${currentMonth}-08`,
    dataLancamento: `${currentYear}-${currentMonth}-08`,
    valor: -1200.00,
    descricao: 'Aluguel Apartamento'
  },
  {
    idLancamento: 'tx-curr-3',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-alimentacao',
    dataPgto: `${currentYear}-${currentMonth}-10`,
    dataLancamento: `${currentYear}-${currentMonth}-10`,
    valor: -420.50,
    descricao: 'Supermercado da Família'
  },
  {
    idLancamento: 'tx-curr-4',
    idUsuario: 'usr-demo',
    idConta: 'acc-4',
    idCategoria: 'cat-transporte',
    dataPgto: `${currentYear}-${currentMonth}-11`,
    dataLancamento: `${currentYear}-${currentMonth}-11`,
    valor: -55.00,
    descricao: 'Uber / Táxi'
  },
  {
    idLancamento: 'tx-curr-5',
    idUsuario: 'usr-demo',
    idConta: 'acc-1',
    idCategoria: 'cat-lazer',
    dataPgto: `${currentYear}-${currentMonth}-12`,
    dataLancamento: `${currentYear}-${currentMonth}-12`,
    valor: -180.00,
    descricao: 'Ingressos de Cinema e Teatro'
  },
  // Transfer transactions (linked by transferenciaId)
  {
    idLancamento: 'tx-trans-out',
    idUsuario: 'usr-demo',
    idConta: 'acc-1', // Origem: Itaú
    idCategoria: undefined, // Transferência tipicamente não possui categoria de gastos
    dataPgto: `${currentYear}-${currentMonth}-07`,
    dataLancamento: `${currentYear}-${currentMonth}-07`,
    valor: -1000.00, // Saída
    descricao: 'Transferência para Reserva (Origem)',
    transferenciaId: 'trans-demo-1'
  },
  {
    idLancamento: 'tx-trans-in',
    idUsuario: 'usr-demo',
    idConta: 'acc-3', // Destino: Reserva de Emergência
    idCategoria: undefined,
    dataPgto: `${currentYear}-${currentMonth}-07`,
    dataLancamento: `${currentYear}-${currentMonth}-07`,
    valor: 1000.00, // Entrada
    descricao: 'Transferência para Reserva (Destino)',
    transferenciaId: 'trans-demo-1'
  }
];

// LocalStorage Helper functions
const getLocal = <T>(key: string, seed: T[]): T[] => {
  const data = localStorage.getItem(`finance_${key}`);
  if (!data) {
    localStorage.setItem(`finance_${key}`, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(data);
};

const setLocal = <T>(key: string, val: T[]): void => {
  localStorage.setItem(`finance_${key}`, JSON.stringify(val));
};

// Database Service Layer
export const dbService = {
  // Check connection status
  isLive(): boolean {
    return !!supabase;
  },

  getSupabaseConfig() {
    return {
      url: SUPABASE_URL,
      key: SUPABASE_ANON_KEY ? 'Configurada (Oculta)' : 'Não configurada'
    };
  },

  // --- AUTENTICAÇÃO SUPABASE ---
  async getSessionUser() {
    if (!supabase) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user || null;
    } catch (e) {
      console.error('Erro ao buscar sessão:', e);
      return null;
    }
  },

  async signUp(email: string, pass: string, name: string) {
    if (!supabase) throw new Error('Supabase não inicializado.');
    
    // 1. Cadastra o usuário no Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nome: name
        }
      }
    });
    if (authErr) throw authErr;
    if (!authData.user) throw new Error('Falha no cadastro do usuário.');

    // 2. Insere na tabela pública de usuários para sincronização
    try {
      await supabase
        .from('usuarios')
        .upsert({
          idUsuario: authData.user.id,
          nome: name,
          email: email
        });
    } catch (dbErr) {
      // Ignora erro se o trigger automático do PostgreSQL (handle_new_user) já realizou a inserção
      console.log('Aviso ou trigger executado ao sincronizar usuário público:', dbErr);
    }
    
    return authData.user;
  },

  async signIn(email: string, pass: string) {
    if (!supabase) throw new Error('Supabase não inicializado.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });
    if (error) throw error;
    return data.user;
  },

  async signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
  },

  // --- ACCOUNTS (CONTAS) ---
  async getAccounts(idUsuario: string): Promise<Conta[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('idUsuario', idUsuario);
      if (error) throw error;
      return data || [];
    }
    return getLocal<Conta>('contas', SEED_ACCOUNTS).filter(a => a.idUsuario === idUsuario);
  },

  async createAccount(idUsuario: string, nome: string, instituicao = '', saldoInicial = 0): Promise<Conta> {
    const newAcc: Conta = {
      idConta: generateUUID(),
      idUsuario,
      nome,
      instituicao,
      saldoInicial
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('contas')
        .insert([newAcc])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = getLocal<Conta>('contas', SEED_ACCOUNTS);
    current.push(newAcc);
    setLocal('contas', current);
    return newAcc;
  },

  async updateAccount(idUsuario: string, idConta: string, nome: string, instituicao = ''): Promise<Conta> {
    if (supabase) {
      const { data, error } = await supabase
        .from('contas')
        .update({ nome, instituicao })
        .eq('idConta', idConta)
        .eq('idUsuario', idUsuario)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = getLocal<Conta>('contas', SEED_ACCOUNTS);
    const idx = current.findIndex(a => a.idConta === idConta && a.idUsuario === idUsuario);
    if (idx !== -1) {
      current[idx] = { ...current[idx], nome, instituicao };
      setLocal('contas', current);
      return current[idx];
    }
    throw new Error('Conta não encontrada.');
  },

  async deleteAccount(idUsuario: string, idConta: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('contas')
        .delete()
        .eq('idConta', idConta)
        .eq('idUsuario', idUsuario);
      if (error) throw error;
      return;
    }

    const current = getLocal<Conta>('contas', SEED_ACCOUNTS);
    const updated = current.filter(a => !(a.idConta === idConta && a.idUsuario === idUsuario));
    setLocal('contas', updated);
  },

  // --- CATEGORIES (CATEGORIAS) ---
  async getCategories(idUsuario: string): Promise<Categoria[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('idUsuario', idUsuario);
      if (error) throw error;
      return data || [];
    }
    return getLocal<Categoria>('categorias', SEED_CATEGORIES).filter(c => c.idUsuario === idUsuario);
  },

  async createCategory(idUsuario: string, nome: string, tipo: 'RECEITA' | 'DESPESA', cor = '#64748b'): Promise<Categoria> {
    const newCat: Categoria = {
      idCategoria: generateUUID(),
      idUsuario,
      nome,
      tipo,
      cor
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('categorias')
        .insert([newCat])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = getLocal<Categoria>('categorias', SEED_CATEGORIES);
    current.push(newCat);
    setLocal('categorias', current);
    return newCat;
  },

  async updateCategory(idUsuario: string, idCategoria: string, nome: string, tipo: 'RECEITA' | 'DESPESA', cor = '#64748b'): Promise<Categoria> {
    if (supabase) {
      const { data, error } = await supabase
        .from('categorias')
        .update({ nome, tipo, cor })
        .eq('idCategoria', idCategoria)
        .eq('idUsuario', idUsuario)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = getLocal<Categoria>('categorias', SEED_CATEGORIES);
    const idx = current.findIndex(c => c.idCategoria === idCategoria && c.idUsuario === idUsuario);
    if (idx !== -1) {
      current[idx] = { ...current[idx], nome, tipo, cor };
      setLocal('categorias', current);
      return current[idx];
    }
    throw new Error('Categoria não encontrada.');
  },

  async deleteCategory(idUsuario: string, idCategoria: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('idCategoria', idCategoria)
        .eq('idUsuario', idUsuario);
      if (error) throw error;
      return;
    }

    const current = getLocal<Categoria>('categorias', SEED_CATEGORIES);
    const updated = current.filter(c => !(c.idCategoria === idCategoria && c.idUsuario === idUsuario));
    setLocal('categorias', updated);
  },

  // --- TRANSACTIONS (LANÇAMENTOS) ---
  async getTransactions(idUsuario: string): Promise<Lancamento[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('idUsuario', idUsuario)
        .order('dataPgto', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS)
      .filter(t => t.idUsuario === idUsuario)
      .sort((a, b) => new Date(b.dataPgto).getTime() - new Date(a.dataPgto).getTime());
  },

  async createTransaction(idUsuario: string, t: Omit<Lancamento, 'idLancamento' | 'idUsuario'>): Promise<Lancamento> {
    const newTx: Lancamento = {
      ...t,
      idLancamento: generateUUID(),
      idUsuario
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('lancamentos')
        .insert([newTx])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS);
    current.push(newTx);
    setLocal('lancamentos', current);
    return newTx;
  },

  // --- REQUISITO DE NEGÓCIO A: TRANSFERÊNCIAS ---
  // Registers a transfer creating both Source (-v) and Destination (+v) entries
  async createTransfer(
    idUsuario: string,
    idContaOrigem: string,
    idContaDestino: string,
    valor: number,
    data: string,
    descricao: string
  ): Promise<Lancamento[]> {
    const transferenciaId = generateUUID();
    
    const txOrigem: Omit<Lancamento, 'idLancamento' | 'idUsuario'> = {
      idConta: idContaOrigem,
      dataPgto: data,
      dataLancamento: new Date().toISOString().split('T')[0],
      valor: -Math.abs(valor), // Negative output
      descricao: `${descricao} (Origem)`,
      transferenciaId
    };

    const txDestino: Omit<Lancamento, 'idLancamento' | 'idUsuario'> = {
      idConta: idContaDestino,
      dataPgto: data,
      dataLancamento: new Date().toISOString().split('T')[0],
      valor: Math.abs(valor), // Positive input
      descricao: `${descricao} (Destino)`,
      transferenciaId
    };

    if (supabase) {
      const dbTxOrigem = { ...txOrigem, idLancamento: generateUUID(), idUsuario };
      const dbTxDestino = { ...txDestino, idLancamento: generateUUID(), idUsuario };
      
      const { data: inserted, error } = await supabase
        .from('lancamentos')
        .insert([dbTxOrigem, dbTxDestino])
        .select();
        
      if (error) throw error;
      return inserted;
    }

    const current = getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS);
    const newOrigem: Lancamento = {
      ...txOrigem,
      idLancamento: generateUUID(),
      idUsuario
    };
    const newDestino: Lancamento = {
      ...txDestino,
      idLancamento: generateUUID(),
      idUsuario
    };

    current.push(newOrigem, newDestino);
    setLocal('lancamentos', current);
    return [newOrigem, newDestino];
  },

  // --- REQUISITO CRÍTICO DE IMPORTAÇÃO (BULK INSERT) ---
  // Secure backend/client bulk insertion of a batch of reconciled transactions
  async createBulkTransactions(idUsuario: string, list: Omit<Lancamento, 'idLancamento' | 'idUsuario'>[]): Promise<Lancamento[]> {
    const preparedList: Lancamento[] = list.map(item => ({
      ...item,
      idLancamento: generateUUID(),
      idUsuario
    }));

    if (supabase) {
      const { data, error } = await supabase
        .from('lancamentos')
        .insert(preparedList)
        .select();
      if (error) throw error;
      return data || [];
    }

    const current = getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS);
    current.push(...preparedList);
    setLocal('lancamentos', current);
    return preparedList;
  },

  async deleteTransaction(idUsuario: string, idLancamento: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('idLancamento', idLancamento)
        .eq('idUsuario', idUsuario);
      if (error) throw error;
      return;
    }

    const current = getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS);
    // If it belongs to a transfer, delete both linked records together (Requirement A: "permite exclusão em lote")
    const txToDelete = current.find(t => t.idLancamento === idLancamento && t.idUsuario === idUsuario);
    let updated;
    if (txToDelete?.transferenciaId) {
      updated = current.filter(t => !(t.transferenciaId === txToDelete.transferenciaId && t.idUsuario === idUsuario));
    } else {
      updated = current.filter(t => !(t.idLancamento === idLancamento && t.idUsuario === idUsuario));
    }
    
    setLocal('lancamentos', updated);
  },

  async updateTransaction(idUsuario: string, idLancamento: string, t: Partial<Omit<Lancamento, 'idLancamento' | 'idUsuario'>>): Promise<Lancamento> {
    if (supabase) {
      const { data, error } = await supabase
        .from('lancamentos')
        .update(t)
        .eq('idLancamento', idLancamento)
        .eq('idUsuario', idUsuario)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS);
    const idx = current.findIndex(tx => tx.idLancamento === idLancamento && tx.idUsuario === idUsuario);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...t };
      setLocal('lancamentos', current);
      return current[idx];
    }
    throw new Error('Lançamento não encontrado.');
  },

  async updateTransfer(
    idUsuario: string,
    transferenciaId: string,
    idContaOrigem: string,
    idContaDestino: string,
    valor: number,
    data: string,
    descricao: string
  ): Promise<Lancamento[]> {
    if (supabase) {
      const { data: txs, error: fetchErr } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('transferenciaId', transferenciaId)
        .eq('idUsuario', idUsuario);
      
      if (fetchErr) throw fetchErr;
      
      const orig = txs?.find(t => t.valor < 0);
      const dest = txs?.find(t => t.valor >= 0);
      
      if (!orig || !dest) {
        throw new Error('Não foi possível localizar as duas pontas da transferência.');
      }

      const { data: updated, error } = await supabase
        .from('lancamentos')
        .upsert([
          {
            idLancamento: orig.idLancamento,
            idUsuario,
            idConta: idContaOrigem,
            dataPgto: data,
            valor: -Math.abs(valor),
            descricao: `${descricao} (Origem)`,
            transferenciaId
          },
          {
            idLancamento: dest.idLancamento,
            idUsuario,
            idConta: idContaDestino,
            dataPgto: data,
            valor: Math.abs(valor),
            descricao: `${descricao} (Destino)`,
            transferenciaId
          }
        ])
        .select();
        
      if (error) throw error;
      return updated || [];
    }

    const current = getLocal<Lancamento>('lancamentos', SEED_TRANSACTIONS);
    const txs = current.filter(t => t.transferenciaId === transferenciaId && t.idUsuario === idUsuario);
    const orig = txs.find(t => t.valor < 0);
    const dest = txs.find(t => t.valor >= 0);
    
    if (orig && dest) {
      orig.idConta = idContaOrigem;
      orig.dataPgto = data;
      orig.valor = -Math.abs(valor);
      orig.descricao = `${descricao} (Origem)`;
      
      dest.idConta = idContaDestino;
      dest.dataPgto = data;
      dest.valor = Math.abs(valor);
      dest.descricao = `${descricao} (Destino)`;
      
      setLocal('lancamentos', current);
      return [orig, dest];
    }
    throw new Error('Transferência não encontrada.');
  },

  // Reset demo data to default states
  resetDemo() {
    localStorage.removeItem('finance_contas');
    localStorage.removeItem('finance_categorias');
    localStorage.removeItem('finance_lancamentos');
    window.location.reload();
  }
};
