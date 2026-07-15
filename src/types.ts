/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Usuario {
  idUsuario: string;
  nome: string;
  email: string;
}

export interface Conta {
  idConta: string;
  idUsuario: string;
  nome: string;
  instituicao?: string;
  saldoInicial?: number;
}

export interface Categoria {
  idCategoria: string;
  idUsuario: string;
  nome: string;
  tipo: 'RECEITA' | 'DESPESA';
  cor?: string; // hex color code
}

export interface Lancamento {
  idLancamento: string;
  idUsuario: string;
  idConta: string;
  idCategoria?: string;
  dataPgto: string; // YYYY-MM-DD
  dataLancamento: string; // YYYY-MM-DD
  valor: number; // positive for income, negative for expense
  descricao: string;
  transferenciaId?: string; // To link transfer transactions (source & destination) together
}

export interface ParsedTransaction {
  id: string; // temporary unique ID
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  idCategoria?: string;
  ignorar: boolean;
}
