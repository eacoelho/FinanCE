/**
 * Utility module for handling installment purchases (compras parceladas)
 * based on transaction groups and individual transactions.
 */

export interface TransactionGroup {
  idGroup: string;
  totalAmount: number;
  totalInstallments: number;
  description: string;
  userId: string;
  accountId: string;
  categoryId: string;
  createdAt: Date;
}

export interface TransactionInstallment {
  idTransaction: string;
  idGroup: string;
  installmentNumber: number;
  dueDate: Date;
  amount: number;
  description: string; // Formatted as "Description (01/10)"
  userId: string;
  accountId: string;
  categoryId: string;
  status: 'PENDING' | 'PAID';
}

export interface InstallmentGenerationResult {
  parentGroup: TransactionGroup;
  installments: TransactionInstallment[];
}

export interface InstallmentInput {
  totalAmount: number;
  totalInstallments: number;
  firstDueDate: Date;
  description: string;
  userId: string;
  accountId: string;
  categoryId: string;
}

/**
 * Robust helper to add calendar months to a base date.
 * Handles month overflow correctly (e.g. Jan 31st + 1 month results in Feb 28th/29th).
 */
export function addMonths(baseDate: Date, monthsToAdd: number): Date {
  const d = new Date(baseDate.getTime());
  const yearOffset = Math.floor((baseDate.getMonth() + monthsToAdd) / 12);
  const targetYear = baseDate.getFullYear() + yearOffset;
  const targetMonth = ((baseDate.getMonth() + monthsToAdd) % 12 + 12) % 12;

  d.setFullYear(targetYear, targetMonth, baseDate.getDate());

  // If the day overflows (e.g., Feb 30th -> March 2nd), adjust to the last day of the target month
  if (d.getMonth() !== targetMonth) {
    d.setDate(0);
  }
  return d;
}

/**
 * Utility function to generate unique string IDs (fallback UUIDs)
 */
function generateUUID(): string {
  // Simple custom UUID generator to be completely environment-agnostic (Node or Browser)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates an installment purchase structure with transaction groups and individual installments.
 * Distributes residual cents to the last installment and advances months safely.
 */
export function createInstallmentPurchase(input: InstallmentInput): InstallmentGenerationResult {
  const {
    totalAmount,
    totalInstallments,
    firstDueDate,
    description,
    userId,
    accountId,
    categoryId,
  } = input;

  if (totalInstallments <= 0) {
    throw new Error('O número de parcelas deve ser maior que zero.');
  }

  const groupId = generateUUID();
  const parentGroup: TransactionGroup = {
    idGroup: groupId,
    totalAmount,
    totalInstallments,
    description,
    userId,
    accountId,
    categoryId,
    createdAt: new Date(),
  };

  const installments: TransactionInstallment[] = [];
  const normalAmount = Math.round((totalAmount / totalInstallments) * 100) / 100;
  let accumulated = 0;

  for (let i = 1; i <= totalInstallments; i++) {
    let amount = normalAmount;

    if (i === totalInstallments) {
      // Rule 1: Residual difference gets added to the last installment to ensure perfect match
      amount = Math.round((totalAmount - accumulated) * 100) / 100;
    } else {
      accumulated = Math.round((accumulated + normalAmount) * 100) / 100;
    }

    // Rule 2: Increment month safely from the firstDueDate
    const dueDate = addMonths(firstDueDate, i - 1);

    // Rule 3: Output format with Description (01/10)
    const currentStr = String(i).padStart(2, '0');
    const totalStr = String(totalInstallments).padStart(2, '0');
    const formattedDescription = `${description} (${currentStr}/${totalStr})`;

    installments.push({
      idTransaction: generateUUID(),
      idGroup: groupId,
      installmentNumber: i,
      dueDate,
      amount,
      description: formattedDescription,
      userId,
      accountId,
      categoryId,
      status: 'PENDING',
    });
  }

  return {
    parentGroup,
    installments,
  };
}

// --- DEMO EXAMPLE OF USE (R$ 100,00 in 3x) ---
export function runDemoExample(): void {
  const result = createInstallmentPurchase({
    totalAmount: 100.00,
    totalInstallments: 3,
    firstDueDate: new Date('2026-01-31T00:00:00Z'),
    description: 'Compra de Notebook',
    userId: 'user-uuid-123',
    accountId: 'account-uuid-456',
    categoryId: 'category-uuid-789'
  });

  console.log('=== DEMO RESULTS FOR R$ 100,00 in 3 installments ===');
  console.log('Parent Group:', result.parentGroup);
  console.log('Installments breakdown:');
  result.installments.forEach(inst => {
    console.log(`- ${inst.description} | Due Date: ${inst.dueDate.toISOString().split('T')[0]} | Amount: R$ ${inst.amount.toFixed(2)}`);
  });
  
  const sumOfInstallments = result.installments.reduce((sum, inst) => sum + inst.amount, 0);
  console.log(`Sum of installments matches total: ${sumOfInstallments === 100.00 ? '✅ YES' : '❌ NO'} (${sumOfInstallments.toFixed(2)})`);
}
