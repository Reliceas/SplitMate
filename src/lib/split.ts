export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  splitWith: string[];
};

export type Balance = {
  participantId: string;
  name: string;
  paid: number;
  share: number;
  net: number;
};

export type Transfer = {
  from: string;
  to: string;
  amount: number;
};

export function money(value: number) {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function calculateBalances(participants: Participant[], expenses: Expense[]): Balance[] {
  return participants.map((participant) => {
    const paid = expenses
      .filter((expense) => expense.paidBy === participant.id)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const share = expenses.reduce((sum, expense) => {
      if (!expense.splitWith.includes(participant.id) || expense.splitWith.length === 0) {
        return sum;
      }

      return sum + expense.amount / expense.splitWith.length;
    }, 0);

    return {
      participantId: participant.id,
      name: participant.name,
      paid,
      share,
      net: paid - share,
    };
  });
}

export function simplifyTransfers(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((balance) => balance.net < -0.5)
    .map((balance) => ({ name: balance.name, amount: -balance.net }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((balance) => balance.net > 0.5)
    .map((balance) => ({ name: balance.name, amount: balance.net }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.5) {
      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.5) {
      debtorIndex += 1;
    }

    if (creditor.amount <= 0.5) {
      creditorIndex += 1;
    }
  }

  return transfers;
}
