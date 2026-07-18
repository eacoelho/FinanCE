/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { Conta, Categoria, Lancamento, ParsedTransaction } from '../types';
import { dbService } from '../lib/database';
import { parseOFX, parseExcel } from '../utils/fileParser';
import { createInstallmentPurchase, addMonths } from '../utils/installments';
import {
  UploadCloud, FileSpreadsheet, Plus, ArrowLeftRight, Check, Trash2, Pencil,
  Calendar, ArrowUpRight, ArrowDownLeft, X, Filter, Search, AlertTriangle, RefreshCw
} from 'lucide-react';

interface TransactionImportProps {
  accounts: Conta[];
  categories: Categoria[];
  transactions: Lancamento[];
  onRefresh: () => void;
  userId?: string;
}

export default function TransactionImport({ accounts, categories, transactions, onRefresh, userId = 'usr-demo' }: TransactionImportProps) {
  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const [parsingError, setParsingError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staging list for reconciliation (REQUISITO B)
  const [importedList, setImportedList] = useState<ParsedTransaction[]>([]);
  const [reconciliationAccount, setReconciliationAccount] = useState<string>('');

  // Search & Filter UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7);
  });

  // Manual transaction form
  const [showManualForm, setShowManualForm] = useState(false);
  const [formType, setFormType] = useState<'MANUAL' | 'TRANSFER'>('MANUAL');
  const [loading, setLoading] = useState(false);

  // Manual Form inputs
  const [txConta, setTxConta] = useState('');
  const [txCategoria, setTxCategoria] = useState('');
  const [txData, setTxData] = useState(() => new Date().toISOString().split('T')[0]);
  const [txDataLancamento, setTxDataLancamento] = useState(() => new Date().toISOString().split('T')[0]);
  const [txIsParcelado, setTxIsParcelado] = useState(false);
  const [txNumParcelas, setTxNumParcelas] = useState(3);
  const [txIsRecorrente, setTxIsRecorrente] = useState(false);
  const [txNumRecorrencias, setTxNumRecorrencias] = useState(12);
  const [txValor, setTxValor] = useState('');
  const [txDescricao, setTxDescricao] = useState('');
  const [txFluxo, setTxFluxo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');

  // Transfer Form inputs (REQUISITO A)
  const [transOrigem, setTransOrigem] = useState('');
  const [transDestino, setTransDestino] = useState('');
  const [transValor, setTransValor] = useState('');
  const [transData, setTransData] = useState(() => new Date().toISOString().split('T')[0]);
  const [transDesc, setTransDesc] = useState('Transferência de Valores');

  // Editing state variables
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);

  const handleOpenEdit = (t: Lancamento) => {
    if (t.transferenciaId) {
      // It's a transfer! Let's find the counterpart
      const related = transactions.filter(x => x.transferenciaId === t.transferenciaId);
      const orig = related.find(x => x.valor < 0);
      const dest = related.find(x => x.valor >= 0);
      if (orig && dest) {
        setFormType('TRANSFER');
        setTransOrigem(orig.idConta);
        setTransDestino(dest.idConta);
        setTransValor(String(Math.abs(orig.valor)));
        setTransData(orig.dataPgto);
        const cleanedDesc = orig.descricao.replace(/\s*\(Origem\)\s*$/, '').replace(/\s*\(Destino\)\s*$/, '');
        setTransDesc(cleanedDesc);
        setEditingTransferId(t.transferenciaId);
        setEditingTxId(null);
        setShowManualForm(true);
      } else {
        alert('Não foi possível carregar as duas pontas desta transferência.');
      }
    } else {
      setFormType('MANUAL');
      setTxConta(t.idConta);
      setTxCategoria(t.idCategoria || '');
      setTxData(t.dataPgto);
      setTxDataLancamento(t.dataLancamento || t.dataPgto);
      setTxIsParcelado(false);
      setTxNumParcelas(3);
      setTxIsRecorrente(false);
      setTxNumRecorrencias(12);
      setTxValor(String(Math.abs(t.valor)));
      setTxDescricao(t.descricao);
      setTxFluxo(t.valor < 0 ? 'DESPESA' : 'RECEITA');
      setEditingTxId(t.idLancamento);
      setEditingTransferId(null);
      setShowManualForm(true);
    }
  };

  // Intelligent Category Matcher based on transaction description (Craftsmanship feature)
  const autoMatchCategory = (descricao: string, valor: number): string | undefined => {
    const descLower = descricao.toLowerCase();
    const isDespesa = valor < 0;

    if (!isDespesa) {
      // Receitas matching
      const salaryCat = categories.find(c => c.tipo === 'RECEITA' && (c.nome.toLowerCase().includes('salár') || c.nome.toLowerCase().includes('vencimento')));
      if (salaryCat && (descLower.includes('salario') || descLower.includes('vencimento') || descLower.includes('folha') || descLower.includes('corp'))) {
        return salaryCat.idCategoria;
      }
      const investCat = categories.find(c => c.tipo === 'RECEITA' && (c.nome.toLowerCase().includes('invest') || c.nome.toLowerCase().includes('divid')));
      if (investCat && (descLower.includes('rendimento') || descLower.includes('invest') || descLower.includes('divid') || descLower.includes('fii'))) {
        return investCat.idCategoria;
      }
    } else {
      // Despesas matching
      const foodCat = categories.find(c => c.tipo === 'DESPESA' && (c.nome.toLowerCase().includes('alim') || c.nome.toLowerCase().includes('mercado')));
      if (foodCat && (descLower.includes('supermercado') || descLower.includes('mercado') || descLower.includes('restaurante') || descLower.includes('iFood') || descLower.includes('padaria') || descLower.includes('pao de acucar') || descLower.includes('carrefour'))) {
        return foodCat.idCategoria;
      }
      const rentCat = categories.find(c => c.tipo === 'DESPESA' && (c.nome.toLowerCase().includes('mora') || c.nome.toLowerCase().includes('alug') || c.nome.toLowerCase().includes('condo')));
      if (rentCat && (descLower.includes('aluguel') || descLower.includes('condominio') || descLower.includes('iptu') || descLower.includes('luz') || descLower.includes('eletropaulo') || descLower.includes('agua'))) {
        return rentCat.idCategoria;
      }
      const transCat = categories.find(c => c.tipo === 'DESPESA' && (c.nome.toLowerCase().includes('trans') || c.nome.toLowerCase().includes('post') || c.nome.toLowerCase().includes('combust')));
      if (transCat && (descLower.includes('uber') || descLower.includes('99taxi') || descLower.includes('combustivel') || descLower.includes('posto') || descLower.includes('shell') || descLower.includes('ipiranga') || descLower.includes('metro'))) {
        return transCat.idCategoria;
      }
      const leisureCat = categories.find(c => c.tipo === 'DESPESA' && (c.nome.toLowerCase().includes('laz') || c.nome.toLowerCase().includes('viag') || c.nome.toLowerCase().includes('show') || c.nome.toLowerCase().includes('cinem')));
      if (leisureCat && (descLower.includes('cinema') || descLower.includes('netflix') || descLower.includes('spotify') || descLower.includes('show') || descLower.includes('hotel') || descLower.includes('passagem'))) {
        return leisureCat.idCategoria;
      }
    }

    // Default to first match of correct type or undefined
    const matchedTypeCats = categories.filter(c => c.tipo === (isDespesa ? 'DESPESA' : 'RECEITA'));
    if (matchedTypeCats.length > 0) {
      return matchedTypeCats[0].idCategoria;
    }
    return undefined;
  };

  // --- FILE HANDLING & PARSING (REQUISITO B.1) ---
  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;
    const file = files[0];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    setParsingError('');
    
    try {
      if (extension === '.ofx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const parsed = parseOFX(text);
          if (parsed.length === 0) {
            setParsingError('Nenhum lançamento válido encontrado no arquivo OFX.');
          } else {
            // Apply match intelligence
            const enriched = parsed.map(tx => {
              const alreadyExists = transactions.some(
                existing => existing.dataPgto === tx.data && Math.abs(existing.valor - tx.valor) < 0.01
              );
              return {
                ...tx,
                idCategoria: autoMatchCategory(tx.descricao, tx.valor),
                ignorar: alreadyExists ? true : tx.ignorar,
                isDuplicate: alreadyExists
              };
            });
            setImportedList(enriched);
            if (accounts.length > 0) {
              setReconciliationAccount(accounts[0].idConta);
            }
          }
        };
        reader.readAsText(file);
      } else if (extension === '.xlsx' || extension === '.xls') {
        const parsed = await parseExcel(file);
        if (parsed.length === 0) {
          setParsingError('Nenhum lançamento legível encontrado na planilha Excel.');
        } else {
          const enriched = parsed.map(tx => {
            const alreadyExists = transactions.some(
              existing => existing.dataPgto === tx.data && Math.abs(existing.valor - tx.valor) < 0.01
            );
            return {
              ...tx,
              idCategoria: autoMatchCategory(tx.descricao, tx.valor),
              ignorar: alreadyExists ? true : tx.ignorar,
              isDuplicate: alreadyExists
            };
          });
          setImportedList(enriched);
          if (accounts.length > 0) {
            setReconciliationAccount(accounts[0].idConta);
          }
        }
      } else {
        setParsingError('Formato de arquivo incompatível. Use arquivos .OFX, .XLSX ou .XLS.');
      }
    } catch (err: any) {
      console.error(err);
      setParsingError(`Falha ao ler arquivo: ${err.message || err}`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // --- RECONCILIATION LINE CONTROLS (REQUISITO B.2) ---
  const handleUpdateLineCategory = (id: string, catId: string) => {
    setImportedList(prev => prev.map(item => item.id === id ? { ...item, idCategoria: catId } : item));
  };

  const handleToggleIgnoreLine = (id: string) => {
    setImportedList(prev => prev.map(item => item.id === id ? { ...item, ignorar: !item.ignorar } : item));
  };

  const handleDeleteLine = (id: string) => {
    setImportedList(prev => prev.filter(item => item.id !== id));
  };

  // --- BULK PERSISTENCE SUBMIT (REQUISITO B.3) ---
  const handleConfirmReconciliation = async () => {
    if (!reconciliationAccount) {
      alert('Selecione uma conta de destino para as transações.');
      return;
    }

    const itemsToSave = importedList.filter(item => !item.ignorar);
    if (itemsToSave.length === 0) {
      alert('Não há lançamentos válidos para importar (todos marcados como ignorados).');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare entries for DB
      const dbEntries = itemsToSave.map(item => ({
        idConta: reconciliationAccount,
        idCategoria: item.idCategoria || undefined,
        dataPgto: item.data,
        dataLancamento: item.data,
        valor: item.valor,
        descricao: item.descricao
      }));

      // PERSIST IN BATCH
      await dbService.createBulkTransactions(userId, dbEntries);
      
      alert(`${dbEntries.length} lançamentos importados e conciliados com sucesso!`);
      setImportedList([]);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao processar bulk insert: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // --- SINGLE MANUAL TRANSACTION INSERTIONS ---
  const handleCreateManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txConta || !txDescricao || !txValor) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      const valorNum = parseFloat(txValor);
      const signedVal = txFluxo === 'RECEITA' ? Math.abs(valorNum) : -Math.abs(valorNum);

      if (editingTxId) {
        await dbService.updateTransaction(userId, editingTxId, {
          idConta: txConta,
          idCategoria: txCategoria || undefined,
          dataPgto: txData,
          dataLancamento: txDataLancamento,
          valor: signedVal,
          descricao: txDescricao
        });
        alert('Lançamento atualizado com sucesso!');
      } else {
        if (txIsParcelado) {
          const installmentRes = createInstallmentPurchase({
            totalAmount: Math.abs(valorNum),
            totalInstallments: txNumParcelas,
            firstDueDate: new Date(txData + 'T12:00:00'), // Avoid timezone offset errors
            description: txDescricao,
            userId: userId,
            accountId: txConta,
            categoryId: txCategoria || '',
          });

          const dbEntries = installmentRes.installments.map(inst => ({
            idConta: inst.accountId,
            idCategoria: inst.categoryId || undefined,
            dataPgto: inst.dueDate.toISOString().split('T')[0],
            dataLancamento: txDataLancamento,
            valor: txFluxo === 'RECEITA' ? inst.amount : -inst.amount,
            descricao: inst.description
          }));

          await dbService.createBulkTransactions(userId, dbEntries);
          alert(`Compra parcelada de ${txNumParcelas}x registrada com sucesso!`);
        } else if (txIsRecorrente) {
          const dbEntries = [];
          for (let i = 1; i <= txNumRecorrencias; i++) {
            const dueDate = addMonths(new Date(txData + 'T12:00:00'), i - 1);
            const currentStr = String(i).padStart(2, '0');
            const totalStr = String(txNumRecorrencias).padStart(2, '0');
            const formattedDesc = `${txDescricao} (Recorrência ${currentStr}/${totalStr})`;

            dbEntries.push({
              idConta: txConta,
              idCategoria: txCategoria || undefined,
              dataPgto: dueDate.toISOString().split('T')[0],
              dataLancamento: txDataLancamento,
              valor: signedVal,
              descricao: formattedDesc
            });
          }

          await dbService.createBulkTransactions(userId, dbEntries);
          alert(`Lançamentos recorrentes (${txNumRecorrencias}x) registrados com sucesso!`);
        } else {
          await dbService.createTransaction(userId, {
            idConta: txConta,
            idCategoria: txCategoria || undefined,
            dataPgto: txData,
            dataLancamento: txDataLancamento,
            valor: signedVal,
            descricao: txDescricao
          });
          alert('Lançamento registrado com sucesso!');
        }
      }

      setShowManualForm(false);
      setEditingTxId(null);
      // Reset
      setTxDescricao('');
      setTxValor('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar lançamento manual: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // --- TRANSFER OPERATION (REQUISITO A) ---
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transOrigem || !transDestino || !transValor) {
      alert('Preencha os campos obrigatórios da transferência.');
      return;
    }
    if (transOrigem === transDestino) {
      alert('A conta de origem e destino não podem ser as mesmas.');
      return;
    }

    try {
      setLoading(true);
      if (editingTransferId) {
        await dbService.updateTransfer(
          userId,
          editingTransferId,
          transOrigem,
          transDestino,
          parseFloat(transValor),
          transData,
          transDesc
        );
        alert('Transferência atualizada com sucesso!');
      } else {
        await dbService.createTransfer(
          userId,
          transOrigem,
          transDestino,
          parseFloat(transValor),
          transData,
          transDesc
        );
      }
      setShowManualForm(false);
      setEditingTransferId(null);
      setTransValor('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao processar transferência bancária: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // --- TRASH INDIVIDUAL ENTRIES FROM MAIN LOG ---
  const handleDeleteTransaction = async (idLancamento: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;
    try {
      await dbService.deleteTransaction(userId, idLancamento);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Erro ao deletar lançamento.');
    }
  };

  // --- LIST FILTERING AND RENDERING ---
  const monthsList = useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      if (t.dataPgto && t.dataPgto.length >= 7) {
        monthsSet.add(t.dataPgto.substring(0, 7));
      }
    });
    
    // Add current month if empty
    if (monthsSet.size === 0) {
      monthsSet.add(new Date().toISOString().substring(0, 7));
    }
    
    // Sort reverse chronologically (newest first)
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const activeMonth = useMemo(() => {
    if (monthsList.includes(selectedMonth)) {
      return selectedMonth;
    }
    return monthsList[0] || new Date().toISOString().substring(0, 7);
  }, [monthsList, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.descricao.toLowerCase().includes(searchQuery.toLowerCase());
      const matchAcc = filterAccount ? t.idConta === filterAccount : true;
      const matchMonth = t.dataPgto && t.dataPgto.substring(0, 7) === activeMonth;
      return matchSearch && matchAcc && matchMonth;
    });
  }, [transactions, searchQuery, filterAccount, activeMonth]);

  return (
    <div className="space-y-8 animate-fade-in" id="transactions-import-tab">
      
      {/* ========================================================
          CRITICAL REQUIREMENT B.2: THE RECONCILIATION / REVIEW STAGING SCREEN
          ======================================================== */}
      {importedList.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 animate-scale-in" id="reconciliation-panel">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <span className="bg-indigo-50 text-indigo-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-200">
                Interface de Conciliação
              </span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">Revisão de Lançamentos Importados</h2>
              <p className="text-xs text-slate-500 mt-0.5">Associe contas, ajuste as categorias e exclua/ignore linhas antes de persistir no banco.</p>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={() => setImportedList([])}
                className="text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-semibold py-2 px-4 rounded-xl transition-all duration-150"
                id="cancel-import-btn"
              >
                Descartar Lote
              </button>
              <button
                onClick={handleConfirmReconciliation}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all duration-150 shadow-sm"
                id="confirm-import-btn"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar Importação ({importedList.filter(i => !i.ignorar).length})
              </button>
            </div>
          </div>

          {/* Target Account Selector for Batch Imports (Requirement B.2) */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Conta de Destino Geral</label>
              <p className="text-xs text-slate-500">Selecione para qual conta bancária do sistema esses movimentos pertencem.</p>
            </div>
            <div className="sm:w-64">
              <select
                id="target-account-select"
                value={reconciliationAccount}
                onChange={(e) => setReconciliationAccount(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="">-- Selecione a Conta --</option>
                {accounts.map(acc => (
                  <option key={acc.idConta} value={acc.idConta}>{acc.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Staging table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data Movimento</th>
                  <th className="py-3 px-4">Descrição Original</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Categoria Correspondente</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {importedList.map(item => {
                  const isDespesa = item.valor < 0;
                  
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-100 ${item.ignorar ? 'bg-slate-50/50 text-slate-400 line-through opacity-60' : 'hover:bg-slate-50/30'}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
                          <button
                            onClick={() => handleToggleIgnoreLine(item.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${item.ignorar ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}
                            title="Clique para alternar inclusão"
                          >
                            {item.ignorar ? 'Ignorado' : 'Incluído'}
                          </button>
                          {item.isDuplicate && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200" title="Lançamento com mesma data de pagamento e valor já cadastrado no sistema">
                              Já Existe
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold">
                        {item.data}
                      </td>
                      <td className="py-3.5 px-4 font-medium max-w-[200px] truncate" title={item.descricao}>
                        {item.descricao}
                      </td>
                      <td className={`py-3.5 px-4 font-mono font-bold ${isDespesa ? 'text-rose-500' : 'text-indigo-500'}`}>
                        {isDespesa ? '-' : '+'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(item.valor))}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          disabled={item.ignorar}
                          value={item.idCategoria || ''}
                          onChange={(e) => handleUpdateLineCategory(item.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-[180px]"
                        >
                          <option value="">-- Sem Categoria --</option>
                          {categories
                            .filter(c => c.tipo === (isDespesa ? 'DESPESA' : 'RECEITA'))
                            .map(c => (
                              <option key={c.idCategoria} value={c.idCategoria}>
                                {c.nome}
                              </option>
                            ))
                          }
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleIgnoreLine(item.id)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
                            title={item.ignorar ? "Incluir Lançamento" : "Ignorar Lançamento"}
                          >
                            {item.ignorar ? "Incluir" : "Ignorar"}
                          </button>
                          <button
                            onClick={() => handleDeleteLine(item.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100"
                            title="Remover definitivamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ========================================================
            STANDARD LANDING VIEW (TRANSACTIONS LIST + FILE UPLOAD CONTROLS)
            ======================================================== */
        <div className="space-y-8">
          
          {/* Action Row & Import Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* File Drag & Drop import zone (Requirement B.1) */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-indigo-600" />
                  Importação e Conciliação Bancária
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Faça upload de arquivos bancários e automatize seus registros</p>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-8 px-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center space-y-3 ${dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'}`}
                id="drop-zone-import"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx, .xlsx, .xls"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  className="hidden"
                />
                
                <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                
                <div>
                  <p className="text-sm font-semibold text-slate-700">Arraste seu arquivo ou clique para selecionar</p>
                  <p className="text-xs text-slate-400 mt-1">Suporta arquivos bancários .OFX e planilhas Excel .XLSX / .XLS</p>
                </div>
              </div>

              {parsingError && (
                <div className="bg-red-50 text-red-800 border border-red-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{parsingError}</span>
                </div>
              )}
            </div>

            {/* In-app action shortcuts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800">Lançamentos Manuais</h3>
                <p className="text-xs text-slate-400 mt-0.5">Insira transações individuais ou transferências diretamente</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setFormType('MANUAL');
                    if (accounts.length > 0) setTxConta(accounts[0].idConta);
                    if (categories.length > 0) setTxCategoria(categories[0].idCategoria);
                    setTxDescricao('');
                    setTxValor('');
                    setTxData(new Date().toISOString().split('T')[0]);
                    setTxDataLancamento(new Date().toISOString().split('T')[0]);
                    setTxIsParcelado(false);
                    setTxNumParcelas(3);
                    setTxIsRecorrente(false);
                    setTxNumRecorrencias(12);
                    setEditingTxId(null);
                    setEditingTransferId(null);
                    setShowManualForm(true);
                  }}
                  className="w-full flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                  id="open-manual-tx-btn"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Registrar Lançamento
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-indigo-200">Manual</span>
                </button>

                {/* Requirement A: Transfer Button */}
                <button
                  onClick={() => {
                    setFormType('TRANSFER');
                    if (accounts.length > 1) {
                      setTransOrigem(accounts[0].idConta);
                      setTransDestino(accounts[1].idConta);
                    }
                    setTransValor('');
                    setTransDesc('Transferência de Valores');
                    setEditingTxId(null);
                    setEditingTransferId(null);
                    setShowManualForm(true);
                  }}
                  className="w-full flex items-center justify-between border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer"
                  id="open-transfer-btn"
                >
                  <span className="flex items-center gap-2 text-slate-800">
                    <ArrowLeftRight className="w-4 h-4 text-indigo-500" /> Transferência entre Contas
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Regra A</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-500">
                💡 <b>Regra de Transferência:</b> Ao realizar uma transferência, o sistema gerará automaticamente uma despesa na conta de origem e uma receita na conta de destino vinculadas.
              </div>
            </div>
          </div>

          {/* Transactions Log Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Histórico de Lançamentos</h3>
                <p className="text-xs text-slate-400 mt-0.5">Lista geral de entradas, saídas e movimentações registradas</p>
              </div>

              {/* Filters Panel */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar histórico..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Account Filter */}
                <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl py-1 px-2.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="bg-transparent border-none text-slate-600 focus:outline-none pr-2 font-medium"
                  >
                    <option value="">Todas as Contas</option>
                    {accounts.map(acc => (
                      <option key={acc.idConta} value={acc.idConta}>{acc.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Month Tabs Bar */}
            <div className="border-b border-slate-100 pb-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                {monthsList.map((m) => {
                  const isActive = m === activeMonth;
                  const [year, month] = m.split('-');
                  const monthNames = [
                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                  ];
                  const shortMonthNames = [
                    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
                  ];
                  const monthIdx = parseInt(month, 10) - 1;
                  const monthLabel = `${shortMonthNames[monthIdx]} ${year}`;
                  const fullMonthLabel = `${monthNames[monthIdx]} de ${year}`;

                  // Count transactions in this month
                  const monthTxs = transactions.filter(t => t.dataPgto && t.dataPgto.substring(0, 7) === m);
                  const count = monthTxs.length;

                  // Calculate net balance for the month
                  const netBalance = monthTxs.reduce((sum, t) => sum + t.valor, 0);
                  const isPositive = netBalance >= 0;

                  return (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(m)}
                      title={fullMonthLabel}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-150 cursor-pointer shrink-0 text-left ${
                        isActive
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider">
                          {monthLabel}
                        </p>
                        <p className={`text-[10px] font-mono font-medium ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {count} {count === 1 ? 'lançamento' : 'lançamentos'}
                        </p>
                      </div>
                      <div className="text-right border-l pl-2 border-current/10">
                        <p className={`text-xs font-mono font-bold ${
                          isActive
                            ? 'text-indigo-100'
                            : isPositive ? 'text-indigo-600' : 'text-rose-600'
                        }`}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(netBalance)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Fluxo</th>
                    <th className="py-3 px-4">Data Lanç. (Compra)</th>
                    <th className="py-3 px-4">Data Pgto. (Fluxo)</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Conta</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTransactions.map(t => {
                    const isDespesa = t.valor < 0;
                    const linkedAcc = accounts.find(a => a.idConta === t.idConta);
                    const linkedCat = categories.find(c => c.idCategoria === t.idCategoria);
                    
                    return (
                      <tr key={t.idLancamento} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          {t.transferenciaId ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase">
                              <ArrowLeftRight className="w-3 h-3" /> Transf
                            </span>
                          ) : isDespesa ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase">
                              <ArrowDownLeft className="w-3 h-3" /> Saída
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase">
                              <ArrowUpRight className="w-3 h-3" /> Entrada
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-400 text-[11px]">
                          {t.dataLancamento || t.dataPgto}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-600 text-[11px]">
                          {t.dataPgto}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {t.descricao}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {linkedAcc ? linkedAcc.nome : 'Sem conta'}
                        </td>
                        <td className="py-3 px-4">
                          {linkedCat ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                              style={{ backgroundColor: linkedCat.cor }}
                            >
                              {linkedCat.nome}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Isento / Transferência</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 font-mono font-bold text-sm ${isDespesa ? 'text-rose-600' : 'text-indigo-600'}`}>
                          {isDespesa ? '-' : '+'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(t.valor))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(t)}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                              title={t.transferenciaId ? "Editar transferência" : "Editar lançamento"}
                              id={`edit-tx-${t.idLancamento}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(t.idLancamento)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                              title={t.transferenciaId ? "Excluir ambas pontas da transferência" : "Deletar lançamento"}
                              id={`delete-tx-${t.idLancamento}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MANUAL INSERTION MODAL FOR SINGLE ENTRIES & TRANSFERS
          ======================================================== */}
      {showManualForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 border border-slate-200 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800">
                {formType === 'MANUAL'
                  ? (editingTxId ? 'Editar Lançamento' : 'Novo Lançamento Manual')
                  : (editingTransferId ? 'Editar Transferência' : 'Realizar Transferência entre Contas')
                }
              </h4>
              <button onClick={() => { setShowManualForm(false); setEditingTxId(null); setEditingTransferId(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formType === 'MANUAL' ? (
              /* STANDARD INDIVIDUAL TRANSACTION FORM */
              <form onSubmit={handleCreateManualTx} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Fluxo</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTxFluxo('RECEITA'); }}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${txFluxo === 'RECEITA' ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        disabled={!!editingTxId}
                      >
                        Receita
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTxFluxo('DESPESA'); }}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${txFluxo === 'DESPESA' ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        disabled={!!editingTxId}
                      >
                        Despesa
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Conta Bancária</label>
                    <select
                      value={txConta}
                      onChange={(e) => setTxConta(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">Selecione a Conta</option>
                      {accounts.map(acc => (
                        <option key={acc.idConta} value={acc.idConta}>{acc.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data do Lançamento (Compra)</label>
                    <input
                      type="date"
                      value={txDataLancamento}
                      onChange={(e) => setTxDataLancamento(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data do Pagamento (Impacto)</label>
                    <input
                      type="date"
                      value={txData}
                      onChange={(e) => setTxData(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
                    <select
                      value={txCategoria}
                      onChange={(e) => setTxCategoria(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">-- Sem Categoria --</option>
                      {categories.filter(c => c.tipo === txFluxo).map(cat => (
                        <option key={cat.idCategoria} value={cat.idCategoria}>{cat.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {txIsParcelado ? 'Valor Total da Compra (R$)' : 'Valor Bruto (R$)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={txValor}
                      onChange={(e) => setTxValor(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição do Lançamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Supermercado Carrefour"
                      value={txDescricao}
                      onChange={(e) => setTxDescricao(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Requirement: Purchase Installment option */}
                {!editingTxId && (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-4">
                    <div className="space-y-3">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={txIsParcelado}
                          onChange={(e) => {
                            setTxIsParcelado(e.target.checked);
                            if (e.target.checked) setTxIsRecorrente(false);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-700">Compra Parcelada (Dividir valor)</span>
                          <p className="text-[10px] text-slate-400">Aloca parcelas nos respectivos meses, considerando os centavos no vencimento final.</p>
                        </div>
                      </label>

                      {txIsParcelado && (
                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Qtd de Parcelas</label>
                            <input
                              type="number"
                              min="2"
                              max="120"
                              value={txNumParcelas}
                              onChange={(e) => setTxNumParcelas(parseInt(e.target.value) || 2)}
                              required={txIsParcelado}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <p className="text-[10px] text-slate-500 font-medium">
                              Cada parcela será de aprox.{' '}
                              <span className="font-bold text-slate-700">
                                R${' '}
                                {txValor && txNumParcelas > 1
                                  ? (parseFloat(txValor) / txNumParcelas).toFixed(2)
                                  : '0.00'}
                              </span>
                            </p>
                            <p className="text-[9px] text-indigo-500 font-semibold mt-0.5">
                              * Ajustado na última parcela.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200/60 my-2"></div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={txIsRecorrente}
                          onChange={(e) => {
                            setTxIsRecorrente(e.target.checked);
                            if (e.target.checked) setTxIsParcelado(false);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-700">Lançamento Recorrente Mensal (Repetir valor)</span>
                          <p className="text-[10px] text-slate-400">Gera lançamentos independentes e idênticos com vencimentos mensais consecutivos.</p>
                        </div>
                      </label>

                      {txIsRecorrente && (
                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Repetições (Qtd de Meses)</label>
                            <input
                              type="number"
                              min="2"
                              max="120"
                              value={txNumRecorrencias}
                              onChange={(e) => setTxNumRecorrencias(parseInt(e.target.value) || 2)}
                              required={txIsRecorrente}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <p className="text-[10px] text-slate-500 font-medium">
                              Serão gerados <span className="font-bold text-slate-700">{txNumRecorrencias}</span> lançamentos.
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Valor de cada mês:{' '}
                              <span className="font-bold text-indigo-600">
                                R$ {txValor ? parseFloat(txValor).toFixed(2) : '0.00'}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowManualForm(false); setEditingTxId(null); setEditingTransferId(null); }}
                    className="text-slate-500 hover:text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    id="submit-manual-tx"
                  >
                    {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {editingTxId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                  </button>
                </div>
              </form>
            ) : (
              /* REQUIREMENT A: SPECIALIZED ACCOUNT TRANSFER FORM */
              <form onSubmit={handleCreateTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">1. Conta Origem (Saída -)</label>
                    <select
                      value={transOrigem}
                      onChange={(e) => setTransOrigem(e.target.value)}
                      required
                      className="w-full bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2 text-xs text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-400 font-medium"
                    >
                      <option value="">Selecione Conta Origem</option>
                      {accounts.map(acc => (
                        <option key={acc.idConta} value={acc.idConta}>{acc.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">2. Conta Destino (Entrada +)</label>
                    <select
                      value={transDestino}
                      onChange={(e) => setTransDestino(e.target.value)}
                      required
                      className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                    >
                      <option value="">Selecione Conta Destino</option>
                      {accounts.map(acc => (
                        <option key={acc.idConta} value={acc.idConta}>{acc.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Valor Transferido (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={transValor}
                      onChange={(e) => setTransValor(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Data da Transferência</label>
                    <input
                      type="date"
                      value={transData}
                      onChange={(e) => setTransData(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição Descritiva</label>
                  <input
                    type="text"
                    value={transDesc}
                    onChange={(e) => setTransDesc(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="text-slate-500 hover:text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    id="submit-transfer"
                  >
                    {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {editingTransferId ? 'Salvar Alterações' : 'Confirmar Transferência'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
