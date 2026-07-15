/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Conta, Categoria } from '../types';
import { dbService } from '../lib/database';
import { Plus, Edit2, Trash2, X, Wallet, Tag, Palette, Check, RefreshCw } from 'lucide-react';

interface AccountsCategoriesProps {
  accounts: Conta[];
  categories: Categoria[];
  onRefresh: () => void;
  userId?: string;
}

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
  '#14b8a6', // Teal
  '#f97316'  // Orange
];

export default function AccountsCategories({ accounts, categories, onRefresh, userId = 'usr-demo' }: AccountsCategoriesProps) {
  // Account Form State
  const [showAccForm, setShowAccForm] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Conta | null>(null);
  const [accNome, setAccNome] = useState('');
  const [accInstituicao, setAccInstituicao] = useState('Outros');
  const [accSaldoInicial, setAccSaldoInicial] = useState('0');

  // Category Form State
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [catCor, setCatCor] = useState(PRESET_COLORS[0]);

  const [loading, setLoading] = useState(false);

  // --- ACCOUNT OPERATIONS ---
  const handleOpenAccCreate = () => {
    setEditingAcc(null);
    setAccNome('');
    setAccInstituicao('Outros');
    setAccSaldoInicial('0');
    setShowAccForm(true);
  };

  const handleOpenAccEdit = (acc: Conta) => {
    setEditingAcc(acc);
    setAccNome(acc.nome);
    setAccInstituicao(acc.instituicao || 'Outros');
    setAccSaldoInicial(String(acc.saldoInicial || 0));
    setShowAccForm(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNome.trim()) return;

    try {
      setLoading(true);
      if (editingAcc) {
        await dbService.updateAccount(userId, editingAcc.idConta, accNome, accInstituicao);
      } else {
        await dbService.createAccount(userId, accNome, accInstituicao, parseFloat(accSaldoInicial) || 0);
      }
      setShowAccForm(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (idConta: string) => {
    if (!confirm('Deseja realmente deletar esta conta? Todos os lançamentos vinculados a ela serão deletados permanentemente.')) return;
    try {
      setLoading(true);
      await dbService.deleteAccount(userId, idConta);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir conta.');
    } finally {
      setLoading(false);
    }
  };

  // --- CATEGORY OPERATIONS ---
  const handleOpenCatCreate = () => {
    setEditingCat(null);
    setCatNome('');
    setCatTipo('DESPESA');
    setCatCor(PRESET_COLORS[0]);
    setShowCatForm(true);
  };

  const handleOpenCatEdit = (cat: Categoria) => {
    setEditingCat(cat);
    setCatNome(cat.nome);
    setCatTipo(cat.tipo);
    setCatCor(cat.cor || PRESET_COLORS[0]);
    setShowCatForm(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNome.trim()) return;

    try {
      setLoading(true);
      if (editingCat) {
        await dbService.updateCategory(userId, editingCat.idCategoria, catNome, catTipo, catCor);
      } else {
        await dbService.createCategory(userId, catNome, catTipo, catCor);
      }
      setShowCatForm(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar categoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (idCategoria: string) => {
    if (!confirm('Deseja realmente excluir esta categoria? Lançamentos associados ficarão sem categoria.')) return;
    try {
      setLoading(true);
      await dbService.deleteCategory(userId, idCategoria);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir categoria.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in" id="accounts-categories-tab">
      
      {/* 1. SECTION: ACCOUNTS (CONTAS) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              Gerenciar Contas Bancárias
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Adicione ou modifique carteiras e contas ativas</p>
          </div>
          
          <button
            onClick={handleOpenAccCreate}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3.5 rounded-xl transition-all duration-150 cursor-pointer shadow-sm"
            id="add-account-btn"
          >
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        </div>

        {/* Acc list */}
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {accounts.map(acc => (
            <div key={acc.idConta} className="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:bg-slate-50/50 transition-all duration-150 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                  {acc.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">{acc.nome}</h4>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span>Instituição:</span> <span className="font-medium text-slate-500">{acc.instituicao || 'Outros'}</span>
                    {acc.saldoInicial !== undefined && acc.saldoInicial > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>Inicial: <b className="font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.saldoInicial)}</b></span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={() => handleOpenAccEdit(acc)}
                  className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Editar"
                  id={`edit-acc-${acc.idConta}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteAccount(acc.idConta)}
                  className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Excluir"
                  id={`delete-acc-${acc.idConta}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {accounts.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">Nenhuma conta cadastrada.</p>
          )}
        </div>

        {/* Modal/Form Overlay or Inline Form */}
        {showAccForm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-xl animate-scale-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h4 className="font-bold text-slate-800">{editingAcc ? 'Editar Conta' : 'Criar Nova Conta'}</h4>
                <button onClick={() => setShowAccForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome da Conta (ex: Carteira, Itaú, Nubank)</label>
                  <input
                    type="text"
                    value={accNome}
                    onChange={(e) => setAccNome(e.target.value)}
                    required
                    placeholder="Ex: Conta Principal"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Instituição Financeira</label>
                  <select
                    value={accInstituicao}
                    onChange={(e) => setAccInstituicao(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Itaú">Itaú</option>
                    <option value="Bradesco">Bradesco</option>
                    <option value="Santander">Santander</option>
                    <option value="Banco do Brasil">Banco do Brasil</option>
                    <option value="Caixa">Caixa Econômica</option>
                    <option value="Nubank">Nubank</option>
                    <option value="Inter">Banco Inter</option>
                    <option value="Dinheiro">Dinheiro Físico</option>
                    <option value="Outros">Outra Instituição</option>
                  </select>
                </div>

                {!editingAcc && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo de Entrada (Inicial)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={accSaldoInicial}
                      onChange={(e) => setAccSaldoInicial(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAccForm(false)}
                    className="text-slate-500 hover:text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                    id="submit-acc-form"
                  >
                    {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Salvar Conta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 2. SECTION: CATEGORIES (CATEGORIAS) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-600" />
              Categorias de Lançamento
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Defina rótulos para classificar receitas ou despesas</p>
          </div>

          <button
            onClick={handleOpenCatCreate}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3.5 rounded-xl transition-all duration-150 cursor-pointer shadow-sm"
            id="add-category-btn"
          >
            <Plus className="w-4 h-4" /> Nova Categoria
          </button>
        </div>

        {/* Categories list */}
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {categories.map(cat => (
            <div key={cat.idCategoria} className="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:bg-slate-50/50 transition-all duration-150 group">
              <div className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded-full shrink-0 border border-white shadow-xs flex items-center justify-center text-white text-[9px]"
                  style={{ backgroundColor: cat.cor }}
                >
                  {cat.nome.substring(0, 1).toUpperCase()}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">{cat.nome}</h4>
                  <p className="text-[10px] uppercase font-bold tracking-wider mt-0.5">
                    {cat.tipo === 'RECEITA' ? (
                      <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Receita</span>
                    ) : (
                      <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Despesa</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={() => handleOpenCatEdit(cat)}
                  className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Editar"
                  id={`edit-cat-${cat.idCategoria}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.idCategoria)}
                  className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Excluir"
                  id={`delete-cat-${cat.idCategoria}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {categories.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">Nenhuma categoria cadastrada.</p>
          )}
        </div>

        {/* Category Modal Form */}
        {showCatForm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-xl animate-scale-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h4 className="font-bold text-slate-800">{editingCat ? 'Editar Categoria' : 'Criar Nova Categoria'}</h4>
                <button onClick={() => setShowCatForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome da Categoria</label>
                  <input
                    type="text"
                    value={catNome}
                    onChange={(e) => setCatNome(e.target.value)}
                    required
                    placeholder="Ex: Alimentação, Lazer"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Fluxo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCatTipo('RECEITA')}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${catTipo === 'RECEITA' ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      Receita
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatTipo('DESPESA')}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${catTipo === 'DESPESA' ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      Despesa
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-500" /> Cor Visual Identificadora
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCatCor(color)}
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-white hover:scale-110 active:scale-95 transition-transform shadow-xs relative shrink-0 cursor-pointer"
                        style={{ backgroundColor: color }}
                      >
                        {catCor === color && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCatForm(false)}
                    className="text-slate-500 hover:text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                    id="submit-cat-form"
                  >
                    {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Salvar Categoria
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
