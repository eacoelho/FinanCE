/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedTransaction } from '../types';
import * as XLSX from 'xlsx';

/**
 * Parses an OFX file content and returns a list of candidate transactions.
 */
export function parseOFX(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // Extract all <STMTTRN> blocks
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmttrnRegex.exec(text)) !== null) {
    const block = match[1];
    
    // Extract fields within the STMTTRN block
    const trnamtMatch = /<TRNAMT>([^<\r\n]+)/i.exec(block);
    const dtpostedMatch = /<DTPOSTED>([^<\r\n]+)/i.exec(block);
    const nameMatch = /<NAME>([^<\r\n]+)/i.exec(block);
    const memoMatch = /<MEMO>([^<\r\n]+)/i.exec(block);
    
    if (trnamtMatch && dtpostedMatch) {
      const valor = parseFloat(trnamtMatch[1].trim());
      
      // Parse DTPOSTED (typically YYYYMMDD...)
      const rawDate = dtpostedMatch[1].trim();
      let data = new Date().toISOString().split('T')[0];
      if (rawDate.length >= 8) {
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        data = `${year}-${month}-${day}`;
      }
      
      // Use MEMO if available, otherwise NAME, otherwise fallback
      const descricao = (memoMatch ? memoMatch[1] : nameMatch ? nameMatch[1] : 'Transação Importada').trim();
      
      transactions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        data,
        descricao,
        valor,
        ignorar: false
      });
    }
  }
  
  return transactions;
}

/**
 * Parses an Excel file (.xlsx / .xls) and extracts transactions.
 * Assumes sheet columns include keywords like "data", "descrição", "valor" or similar.
 */
export async function parseExcel(file: File): Promise<ParsedTransaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve([]);
          return;
        }
        
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to JSON array
        const rows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        if (rows.length === 0) {
          resolve([]);
          return;
        }
        
        // Let's identify the headers row and column indices
        let headerIndex = -1;
        let colDate = -1;
        let colDesc = -1;
        let colVal = -1;
        
        // Find header row by scanning first 10 rows for keywords
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          
          const strRow = row.map(v => String(v).toLowerCase());
          const dateIdx = strRow.findIndex(v => v.includes('data') || v.includes('date') || v.includes('dt'));
          const descIdx = strRow.findIndex(v => v.includes('desc') || v.includes('hist') || v.includes('nome') || v.includes('memo') || v.includes('detalhe') || v.includes('origem'));
          const valIdx = strRow.findIndex(v => v.includes('val') || v.includes('quant') || v.includes('amo') || v.includes('pago') || v.includes('recebido'));
          
          if (dateIdx !== -1 && descIdx !== -1 && valIdx !== -1) {
            headerIndex = r;
            colDate = dateIdx;
            colDesc = descIdx;
            colVal = valIdx;
            break;
          }
        }
        
        // Fallbacks if we can't find clear headers: guess col 0 = date, col 1 = desc, col 2 = value
        if (headerIndex === -1) {
          headerIndex = 0;
          colDate = 0;
          colDesc = 1;
          colVal = 2;
        }
        
        const transactions: ParsedTransaction[] = [];
        
        for (let r = headerIndex + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !Array.isArray(row) || row.length <= Math.max(colDate, colDesc, colVal)) continue;
          
          let rawDate = row[colDate];
          let rawDesc = row[colDesc];
          let rawVal = row[colVal];
          
          if (!rawDate || !rawDesc || rawVal === undefined || rawVal === null) continue;
          
          // Parse Value
          let valor = 0;
          if (typeof rawVal === 'number') {
            valor = rawVal;
          } else {
            valor = parseFloat(String(rawVal).replace(/[^\d.,-]/g, '').replace(',', '.'));
          }
          if (isNaN(valor)) continue;
          
          // Parse Date
          let dataStr = '';
          if (typeof rawDate === 'number') {
            // Excel serial date number
            const dateObj = XLSX.SSF.parse_date_code(rawDate);
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            dataStr = `${dateObj.y}-${m}-${d}`;
          } else {
            const parsedD = new Date(rawDate);
            if (!isNaN(parsedD.getTime())) {
              dataStr = parsedD.toISOString().split('T')[0];
            } else {
              // Try standard format regexes
              const strDate = String(rawDate).trim();
              const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(strDate);
              if (ddmmyyyy) {
                dataStr = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
              } else {
                dataStr = new Date().toISOString().split('T')[0]; // fallback
              }
            }
          }
          
          const descricao = String(rawDesc).trim();
          
          transactions.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
            data: dataStr,
            descricao,
            valor,
            ignorar: false
          });
        }
        
        resolve(transactions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
