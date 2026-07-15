/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Conta, Categoria, Lancamento } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, AlertCircle } from 'lucide-react';

interface DashboardProps {
  accounts: Conta[];
  categories: Categoria[];
  transactions: Lancamento[];
}

export default function Dashboard({ accounts, categories, transactions }: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate distinct months available in transactions to populate filters
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      if (t.dataPgto && t.dataPgto.length >= 7) {
        months.add(t.dataPgto.substring(0, 7));
      }
    });
    // Add current month if empty
    const currentStr = new Date().toISOString().substring(0, 7);
    months.add(currentStr);
    
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Filter transactions for selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.dataPgto && t.dataPgto.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // --- METRIC CALCULATIONS ---
  const { totalReceitas, totalDespesas, saldoMensal } = useMemo(() => {
    let rec = 0;
    let des = 0;
    monthlyTransactions.forEach(t => {
      // Exclude transfers from absolute revenue/expenses to prevent inflation (Requirement A)
      if (t.transferenciaId) return;
      
      if (t.valor > 0) {
        rec += t.valor;
      } else {
        des += Math.abs(t.valor);
      }
    });
    return {
      totalReceitas: rec,
      totalDespesas: des,
      saldoMensal: rec - des
    };
  }, [monthlyTransactions]);

  // Total balance across all accounts based on initial balances + transaction history
  const totalBalance = useMemo(() => {
    let base = accounts.reduce((sum, acc) => sum + (acc.saldoInicial || 0), 0);
    // Add all transactions (transfers cancel themselves out as one is positive and one is negative)
    transactions.forEach(t => {
      base += t.valor;
    });
    return base;
  }, [accounts, transactions]);

  // --- CATEGORY EXPENSES BREAKDOWN ---
  const expensesByCategory = useMemo(() => {
    const map: Record<string, { category: Categoria; value: number }> = {};
    
    // Default "Outros" category if not found
    const fallbackCategory: Categoria = {
      idCategoria: 'cat-outros',
      idUsuario: 'usr-demo',
      nome: 'Outros / Sem Categoria',
      tipo: 'DESPESA',
      cor: '#64748b'
    };

    monthlyTransactions.forEach(t => {
      // Exclude transfers and revenue
      if (t.transferenciaId || t.valor >= 0) return;
      
      const catId = t.idCategoria || 'cat-outros';
      const cat = categories.find(c => c.idCategoria === catId) || fallbackCategory;
      const absVal = Math.abs(t.valor);
      
      if (!map[catId]) {
        map[catId] = { category: cat, value: 0 };
      }
      map[catId].value += absVal;
    });

    const list = Object.values(map).sort((a, b) => b.value - a.value);
    const sumAll = list.reduce((sum, item) => sum + item.value, 0);

    return {
      list,
      totalSpent: sumAll
    };
  }, [monthlyTransactions, categories]);

  // --- ANNUAL DATA CHART CALCULATIONS ---
  // Calculates month-by-month revenue vs expenses for the current year
  const annualChartData = useMemo(() => {
    const monthsName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date(selectedMonth).getFullYear();
    
    const monthlySummary = Array.from({ length: 12 }, (_, i) => ({
      monthIdx: i,
      label: monthsName[i],
      receita: 0,
      despesa: 0
    }));

    transactions.forEach(t => {
      // Exclude transfers
      if (t.transferenciaId) return;
      
      const txDate = new Date(t.dataPgto);
      if (txDate.getFullYear() === currentYear) {
        const mIdx = txDate.getMonth();
        if (t.valor > 0) {
          monthlySummary[mIdx].receita += t.valor;
        } else {
          monthlySummary[mIdx].despesa += Math.abs(t.valor);
        }
      }
    });

    // Find max value to scale the SVG chart correctly
    let maxVal = 1000;
    monthlySummary.forEach(m => {
      maxVal = Math.max(maxVal, m.receita, m.despesa);
    });

    return {
      year: currentYear,
      data: monthlySummary,
      maxVal: maxVal * 1.15 // padding top
    };
  }, [transactions, selectedMonth]);

  // --- SVG DONUT CHART COMPUTATION ---
  const donutSegments = useMemo(() => {
    let cumulativePercent = 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    
    return expensesByCategory.list.map(item => {
      const percent = expensesByCategory.totalSpent > 0 ? (item.value / expensesByCategory.totalSpent) : 0;
      const strokeDasharray = `${percent * circumference} ${circumference}`;
      const strokeDashoffset = -cumulativePercent * circumference;
      cumulativePercent += percent;
      
      return {
        id: item.category.idCategoria,
        name: item.category.nome,
        value: item.value,
        percent,
        color: item.category.cor || '#64748b',
        strokeDasharray,
        strokeDashoffset
      };
    });
  }, [expensesByCategory]);

  const formatCurrency = (v: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-tab">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Visão Geral de Finanças</h2>
          <p className="text-sm text-slate-500 mt-0.5">Monitore receitas, despesas e a saúde financeira das suas contas.</p>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            id="month-filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-150"
          >
            {availableMonths.map(m => {
              const [year, month] = m.split('-');
              const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
              const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              return (
                <option key={m} value={m}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Balance Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden" id="card-saldo-geral">
          <div className="absolute right-3 top-3 w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Consolidado</span>
          <div className="text-2xl font-bold font-mono mt-2 tracking-tight text-slate-900">
            {formatCurrency(totalBalance)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Soma de todas as contas cadastradas</p>
        </div>

        {/* Monthly Income Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between" id="card-receitas-mes">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Receitas no Mês</span>
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatCurrency(totalReceitas)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-indigo-600 font-bold">Filtro ativo:</span> {selectedMonth}
            </p>
          </div>
        </div>

        {/* Monthly Expense Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between" id="card-despesas-mes">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Despesas no Mês</span>
            <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatCurrency(totalDespesas)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-rose-600 font-bold">Exclui transferências</span> para evitar duplicidade
            </p>
          </div>
        </div>

        {/* Monthly Net Savings Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between" id="card-saldo-mes">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Mensal</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${saldoMensal >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tracking-tight ${saldoMensal >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatCurrency(saldoMensal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {saldoMensal >= 0 ? 'Lucro mensal positivo ✨' : 'Atenção, despesas superaram receitas!'}
            </p>
          </div>
        </div>
      </div>

      {/* Graphics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Category Expenses Breakdown (Col span 2) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between" id="section-gastos-categoria">
          <div>
            <h3 className="text-base font-bold text-slate-800">Gastos por Categoria</h3>
            <p className="text-xs text-slate-400 mt-0.5">Visão de despesas brutas consolidadas</p>
          </div>

          {expensesByCategory.list.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">Nenhum gasto registrado neste mês.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center gap-6 mt-6">
              {/* SVG Donut Chart */}
              <div className="flex justify-center relative items-center">
                <svg width="150" height="150" viewBox="0 0 120 120" className="transform -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="transparent" stroke="#f8fafc" strokeWidth="12" />
                  {donutSegments.map(seg => (
                    <circle
                      key={seg.id}
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
                {/* Center text */}
                <div className="absolute text-center flex flex-col justify-center items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Pago</span>
                  <span className="text-sm font-bold text-slate-700 font-mono mt-0.5">
                    {formatCurrency(expensesByCategory.totalSpent)}
                  </span>
                </div>
              </div>

              {/* Progress Legend list */}
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {expensesByCategory.list.map(item => {
                  const percent = expensesByCategory.totalSpent > 0 ? (item.value / expensesByCategory.totalSpent) * 100 : 0;
                  return (
                    <div key={item.category.idCategoria} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.category.cor || '#64748b' }} />
                          <span className="text-slate-600 truncate">{item.category.nome}</span>
                        </div>
                        <div className="font-mono text-slate-700 space-x-1">
                          <span>{formatCurrency(item.value)}</span>
                          <span className="text-slate-400 font-sans text-[10px]">({percent.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: item.category.cor || '#64748b',
                            width: `${percent}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Annual View (Col span 3) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between" id="section-visao-anual">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Desempenho Anual ({annualChartData.year})</h3>
              <div className="flex items-center gap-3.5 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-500 shrink-0" />
                  Receitas
                </div>
                <div className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded bg-rose-400 shrink-0" />
                  Despesas
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Comparativo mensal acumulado de receitas contra despesas brutas</p>
          </div>

          {/* SVG Custom Annual Bar Chart */}
          <div className="flex-1 mt-8 min-h-[220px] flex flex-col justify-end">
            <div className="relative w-full h-[180px] flex items-end justify-between px-2">
              
              {/* Horizontal grid lines */}
              <div className="absolute inset-x-0 top-0 h-full flex flex-col justify-between pointer-events-none">
                <div className="border-b border-slate-100 w-full h-0 text-[9px] text-slate-400 pt-0.5 select-none font-mono flex justify-end">
                  {formatCurrency(annualChartData.maxVal)}
                </div>
                <div className="border-b border-slate-100 w-full h-0 text-[9px] text-slate-400 pt-0.5 select-none font-mono flex justify-end">
                  {formatCurrency(annualChartData.maxVal * 0.66)}
                </div>
                <div className="border-b border-slate-100 w-full h-0 text-[9px] text-slate-400 pt-0.5 select-none font-mono flex justify-end">
                  {formatCurrency(annualChartData.maxVal * 0.33)}
                </div>
                <div className="border-b border-slate-200 w-full h-0 flex justify-end text-[9px] text-slate-400">
                  R$ 0,00
                </div>
              </div>

              {/* Data Bars */}
              {annualChartData.data.map(m => {
                const recHeight = (m.receita / annualChartData.maxVal) * 100;
                const desHeight = (m.despesa / annualChartData.maxVal) * 100;
                
                return (
                  <div key={m.monthIdx} className="flex flex-col items-center flex-1 h-full justify-end relative group px-1">
                    
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] rounded-lg p-2 flex flex-col gap-0.5 shadow-md pointer-events-none transition-opacity duration-150 z-20 font-mono whitespace-nowrap border border-slate-800">
                      <span className="font-sans font-bold text-slate-300 border-b border-slate-800 pb-0.5 mb-0.5">{m.label} ({annualChartData.year})</span>
                      <span className="text-indigo-400">Receitas: {formatCurrency(m.receita)}</span>
                      <span className="text-rose-400">Despesas: {formatCurrency(m.despesa)}</span>
                    </div>

                    <div className="flex items-end gap-1 w-full max-w-[28px] h-full justify-center">
                      {/* Revenue Bar */}
                      <div
                        className="w-2 md:w-3 bg-indigo-500 hover:bg-indigo-600 rounded-t transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max(recHeight, 2)}%` }}
                        title={`Receita: ${formatCurrency(m.receita)}`}
                      />
                      {/* Expense Bar */}
                      <div
                        className="w-2 md:w-3 bg-rose-400 hover:bg-rose-500 rounded-t transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max(desHeight, 2)}%` }}
                        title={`Despesa: ${formatCurrency(m.despesa)}`}
                      />
                    </div>
                    {/* X axis Label */}
                    <span className="text-[10px] font-semibold text-slate-400 mt-2">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
