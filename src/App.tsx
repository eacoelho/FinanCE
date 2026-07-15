/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { dbService, supabase } from './lib/database';
import { Conta, Categoria, Lancamento } from './types';
import Dashboard from './components/Dashboard';
import TransactionImport from './components/TransactionImport';
import AccountsCategories from './components/AccountsCategories';
import SqlViewer from './components/SqlViewer';
import {
  TrendingUp, Wallet, Tag, BarChart3, Database, Key, Check, AlertCircle,
  HelpCircle, RefreshCw, Layers, X, Mail, Lock, User, LogIn
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRANSACTIONS' | 'ACCOUNTS_CATEGORIES' | 'SQL_VIEWER'>('DASHBOARD');

  // Database states
  const [accounts, setAccounts] = useState<Conta[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [transactions, setTransactions] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Supabase Configuration State Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(() => localStorage.getItem('finance_override_supabase_url') || '');
  const [inputKey, setInputKey] = useState(() => localStorage.getItem('finance_override_supabase_key') || '');
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Authentication State Variables
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'SIGNIN' | 'SIGNUP'>('SIGNIN');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Sync state from Database Service
  const loadData = async () => {
    try {
      setLoading(true);
      setAuthError('');
      
      const live = dbService.isLive();
      setIsLiveConnected(live);

      let userId = 'usr-demo';
      if (live) {
        const user = await dbService.getSessionUser();
        if (user) {
          setCurrentUser(user);
          userId = user.id;
        } else {
          setCurrentUser(null);
          setLoading(false);
          return; // Stop loading data if not authenticated on Supabase Live
        }
      } else {
        setCurrentUser(null);
      }

      // Fetch lists with authenticated UUID or local fallback
      const accList = await dbService.getAccounts(userId);
      const catList = await dbService.getCategories(userId);
      const txList = await dbService.getTransactions(userId);

      setAccounts(accList);
      setCategories(catList);
      setTransactions(txList);
    } catch (error) {
      console.error('Falha ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'SIGNIN') {
        await dbService.signIn(authEmail, authPassword);
      } else {
        if (!authName.trim()) {
          throw new Error('Por favor, informe seu nome.');
        }
        await dbService.signUp(authEmail, authPassword, authName.trim());
      }
      // Reload page data upon successful auth
      await loadData();
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Ocorreu um erro ao realizar a autenticação.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair da sua conta Supabase?')) {
      try {
        await dbService.signOut();
        setCurrentUser(null);
        window.location.reload();
      } catch (err) {
        console.error('Erro ao deslogar:', err);
      }
    }
  };

  // Set up or clear custom Supabase overrides
  const handleSaveCustomSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim() && inputKey.trim()) {
      localStorage.setItem('finance_override_supabase_url', inputUrl.trim());
      localStorage.setItem('finance_override_supabase_key', inputKey.trim());
      alert('Credenciais salvas! A página será reiniciada para estabelecer a conexão.');
      window.location.reload();
    } else {
      localStorage.removeItem('finance_override_supabase_url');
      localStorage.removeItem('finance_override_supabase_key');
      alert('Credenciais redefinidas! Retornando ao modo Sandbox local.');
      window.location.reload();
    }
  };

  const handleResetDatabase = () => {
    if (confirm('Deseja redefinir todo o banco de dados local para os dados iniciais demonstrativos? Todos os seus lançamentos personalizados e categorias criados serão limpos.')) {
      dbService.resetDemo();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. MASTER HEADER & BRAND BAR */}
      <header className="bg-white text-slate-900 border-b border-slate-200 shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm shadow-indigo-600/20">
              <TrendingUp className="w-5.5 h-5.5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold tracking-tighter text-indigo-600">finan<span className="text-slate-900 font-bold">CE</span></h1>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-slate-200/60">
                  MVP
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Controle Financeiro Multi-usuário</p>
            </div>
          </div>

          {/* Database Engine Indicators & Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status indicator pill */}
            <div
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer transition-all duration-150 shadow-xs"
              title="Clique para configurar o Supabase"
              id="supabase-status-pill"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isLiveConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-indigo-500'}`} />
              <span>Banco: <b className={isLiveConnected ? 'text-emerald-600' : 'text-indigo-600'}>{isLiveConnected ? 'Supabase Live' : 'Sandbox Local'}</b></span>
              <Key className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </div>

            {isLiveConnected && currentUser && (
              <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs">
                <span>Olá, <b className="text-indigo-900">{currentUser.user_metadata?.nome || currentUser.email}</b></span>
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer"
                  title="Sair da conta"
                >
                  Sair
                </button>
              </div>
            )}

            {/* Reset Seed Button */}
            {!isLiveConnected && (
              <button
                onClick={handleResetDatabase}
                className="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold py-1.5 px-3.5 rounded-full transition-all border border-slate-200 shadow-xs cursor-pointer"
                title="Wipes local records and restores rich seed defaults"
                id="reset-demo-btn"
              >
                Resetar Demo
              </button>
            )}
          </div>

        </div>
      </header>

      {/* 2. SUB-NAVIGATION TABS BAR */}
      <nav className="bg-white border-b border-slate-200 shrink-0 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 overflow-x-auto h-14 no-scrollbar scroll-smooth">
            
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`flex items-center gap-2 text-xs font-bold h-14 border-b-2 transition-all whitespace-nowrap px-1 cursor-pointer ${activeTab === 'DASHBOARD' ? 'text-indigo-600 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-900 border-transparent font-medium'}`}
              id="tab-dashboard"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              Painel Geral
            </button>

            <button
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`flex items-center gap-2 text-xs font-bold h-14 border-b-2 transition-all whitespace-nowrap px-1 cursor-pointer ${activeTab === 'TRANSACTIONS' ? 'text-indigo-600 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-900 border-transparent font-medium'}`}
              id="tab-transactions"
            >
              <Layers className="w-4 h-4 shrink-0" />
              Lançamentos & Importação
            </button>

            <button
              onClick={() => setActiveTab('ACCOUNTS_CATEGORIES')}
              className={`flex items-center gap-2 text-xs font-bold h-14 border-b-2 transition-all whitespace-nowrap px-1 cursor-pointer ${activeTab === 'ACCOUNTS_CATEGORIES' ? 'text-indigo-600 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-900 border-transparent font-medium'}`}
              id="tab-accounts"
            >
              <Wallet className="w-4 h-4 shrink-0" />
              Contas & Categorias
            </button>

            <button
              onClick={() => setActiveTab('SQL_VIEWER')}
              className={`flex items-center gap-2 text-xs font-bold h-14 border-b-2 transition-all whitespace-nowrap px-1 cursor-pointer ${activeTab === 'SQL_VIEWER' ? 'text-indigo-600 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-900 border-transparent font-medium'}`}
              id="tab-developer"
            >
              <Database className="w-4 h-4 shrink-0" />
              Central do Dev (SQL)
            </button>

          </div>
        </div>
      </nav>

      {/* 3. MAIN CONTENTS WRAPPER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Sincronizando Banco de Dados...</p>
          </div>
        ) : isLiveConnected && !currentUser ? (
          // AUTHENTICATION INTERFACE FOR SUPABASE LIVE
          <div className="max-w-md mx-auto my-12 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-6 border-b border-slate-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-3 shadow-md shadow-indigo-600/20">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-850">Acesso ao Banco de Dados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Este projeto está configurado em tempo real com regras de segurança de <b>Row Level Security (RLS)</b> no Supabase.
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Info Note */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-700 leading-relaxed">
                  🔒 Cada usuário possui isolamento completo de seus lançamentos, contas e categorias diretamente na tabela PostgreSQL do Supabase.
                </div>

                {authError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-red-800 text-xs">
                    <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Falha na Autenticação:</span> {authError}
                    </div>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === 'SIGNUP' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Seu Nome</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="Ex: João Silva"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="nome@exemplo.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {authLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    {authMode === 'SIGNIN' ? 'Entrar no Banco de Dados' : 'Registrar Nova Conta'}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    onClick={() => {
                      setAuthMode(authMode === 'SIGNIN' ? 'SIGNUP' : 'SIGNIN');
                      setAuthError('');
                    }}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    {authMode === 'SIGNIN'
                      ? 'Não tem uma conta? Cadastre-se aqui'
                      : 'Já tem uma conta? Faça login aqui'}
                  </button>
                </div>
              </div>

              {/* Back to Sandbox option */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Deseja testar sem conta?</span>
                <button
                  onClick={() => {
                    localStorage.removeItem('finance_override_supabase_url');
                    localStorage.removeItem('finance_override_supabase_key');
                    alert('Retornando ao ambiente demonstrativo local (Sandbox).');
                    window.location.reload();
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  Modo Demonstrativo (Local) →
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Show local sandbox help card if running locally */}
            {!isLiveConnected && activeTab === 'DASHBOARD' && (
              <div className="mb-6 bg-gradient-to-r from-indigo-50 to-indigo-100 border border-indigo-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-200/50 text-indigo-700 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900">✨ Modo Demonstrativo Ativo (LocalStorage)</h4>
                    <p className="text-xs text-indigo-700 mt-1">
                      O aplicativo está executando com um mecanismo local simulado preenchido com dados demonstrativos para visualização imediata dos relatórios. Você pode alternar para o banco de dados PostgreSQL do Supabase a qualquer momento.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all self-end md:self-auto shrink-0 shadow-sm cursor-pointer"
                  id="header-connect-supabase-btn"
                >
                  Conectar Supabase
                </button>
              </div>
            )}

            {/* TAB RENDERING */}
            {activeTab === 'DASHBOARD' && (
              <Dashboard
                accounts={accounts}
                categories={categories}
                transactions={transactions}
                userId={currentUser ? currentUser.id : 'usr-demo'}
              />
            )}

            {activeTab === 'TRANSACTIONS' && (
              <TransactionImport
                accounts={accounts}
                categories={categories}
                transactions={transactions}
                onRefresh={loadData}
                userId={currentUser ? currentUser.id : 'usr-demo'}
              />
            )}

            {activeTab === 'ACCOUNTS_CATEGORIES' && (
              <AccountsCategories
                accounts={accounts}
                categories={categories}
                onRefresh={loadData}
                userId={currentUser ? currentUser.id : 'usr-demo'}
              />
            )}

            {activeTab === 'SQL_VIEWER' && (
              <SqlViewer />
            )}
          </>
        )}
      </main>

      {/* 4. FOOTER CREDITS */}
      <footer className="h-10 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] font-semibold text-slate-400 shrink-0 uppercase tracking-wider">
        <div>v1.0.4-beta • finanCE Intelligence Engine</div>
        <div>© 2026 Arquiteto Full Stack Inc.</div>
      </footer>

      {/* 5. DATABASE CONFIGURATION MODAL OVERLAY */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 border border-slate-200 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-800">Conectar ao seu Banco Supabase</h4>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Para testar este MVP conectado diretamente a um banco Supabase em tempo real com regras de segurança de Row Level Security (RLS) ativas:
            </p>

            <ol className="text-xs text-slate-600 list-decimal pl-4 mb-4 space-y-1.5">
              <li>Crie um projeto grátis no <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline">Supabase</a>.</li>
              <li>Acesse o **SQL Editor** no painel do Supabase e execute o script SQL contido na aba <b>"Central do Dev"</b> para criar a estrutura das tabelas.</li>
              <li>Copie a <b>Project URL</b> e a <b>Anon Key</b> de API (encontrados em Settings &gt; API) e insira abaixo.</li>
            </ol>

            <form onSubmit={handleSaveCustomSupabase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">SUPABASE_URL (Project URL)</label>
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://xxxxxx.supabase.co"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">SUPABASE_ANON_KEY (Public API Key)</label>
                <textarea
                  rows={2}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-none"
                />
              </div>

              {isLiveConnected && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-emerald-800 text-xs">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Conexão Estabelecida!</span> Atualmente conectado ao Supabase remoto. Limpe os campos e envie o formulário se desejar desconectar e voltar ao Sandbox.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setInputUrl(''); setInputKey(''); }}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold"
                >
                  Desconectar / Limpar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="text-slate-500 hover:text-slate-700 text-xs font-semibold py-2 px-4"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm"
                    id="save-supabase-config-btn"
                  >
                    Salvar e Reiniciar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
