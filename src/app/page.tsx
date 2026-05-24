"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  Check,
  Copy,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  Expense,
  Participant,
  calculateBalances,
  money,
  simplifyTransfers,
} from "@/lib/split";

const initialParticipants: Participant[] = [
  { id: "amir", name: "Амир" },
  { id: "ali", name: "Али" },
  { id: "dani", name: "Даник" },
];

const initialExpenses: Expense[] = [
  {
    id: "taxi",
    title: "Такси до центра",
    amount: 12000,
    paidBy: "amir",
    splitWith: ["amir", "ali", "dani"],
  },
  {
    id: "coffee",
    title: "Кофе и десерты",
    amount: 7800,
    paidBy: "ali",
    splitWith: ["amir", "ali", "dani"],
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const [eventName, setEventName] = useState("Поездка в Алматы");
  const [participants, setParticipants] = useState(initialParticipants);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [participantName, setParticipantName] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [paidBy, setPaidBy] = useState(initialParticipants[0].id);
  const [splitWith, setSplitWith] = useState<string[]>(initialParticipants.map((item) => item.id));
  const [copied, setCopied] = useState(false);

  const total = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const balances = useMemo(
    () => calculateBalances(participants, expenses),
    [participants, expenses],
  );

  const transfers = useMemo(() => simplifyTransfers(balances), [balances]);

  const telegramText = useMemo(() => {
    const lines = [
      `SplitMate · ${eventName}`,
      `Общая сумма: ${money(total)}`,
      "",
      transfers.length > 0 ? "Кто кому переводит:" : "Все в расчёте. Долгов нет.",
      ...transfers.map((transfer) => `${transfer.from} → ${transfer.to}: ${money(transfer.amount)}`),
    ];

    return lines.join("\n");
  }, [eventName, total, transfers]);

  function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = participantName.trim();

    if (!name) {
      return;
    }

    const participant = { id: uid(), name };
    setParticipants((current) => [...current, participant]);
    setSplitWith((current) => [...current, participant.id]);
    setParticipantName("");
  }

  function removeParticipant(id: string) {
    setParticipants((current) => current.filter((participant) => participant.id !== id));
    setExpenses((current) =>
      current.filter((expense) => expense.paidBy !== id).map((expense) => ({
        ...expense,
        splitWith: expense.splitWith.filter((participantId) => participantId !== id),
      })),
    );
    setSplitWith((current) => current.filter((participantId) => participantId !== id));

    if (paidBy === id) {
      const next = participants.find((participant) => participant.id !== id);
      setPaidBy(next?.id ?? "");
    }
  }

  function toggleSplitWith(id: string) {
    setSplitWith((current) =>
      current.includes(id)
        ? current.filter((participantId) => participantId !== id)
        : [...current, id],
    );
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = expenseTitle.trim();
    const amount = Number(expenseAmount);

    if (!title || !paidBy || !Number.isFinite(amount) || amount <= 0 || splitWith.length === 0) {
      return;
    }

    setExpenses((current) => [
      {
        id: uid(),
        title,
        amount,
        paidBy,
        splitWith,
      },
      ...current,
    ]);
    setExpenseTitle("");
    setExpenseAmount("");
    setSplitWith(participants.map((participant) => participant.id));
  }

  function removeExpense(id: string) {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  }

  async function copySummary() {
    await navigator.clipboard.writeText(telegramText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-4 py-5 text-slate-50">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-cyan-100">
              <Sparkles size={14} />
              Telegram Mini App
            </div>
            <div className="rounded-full bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-200">
              MVP ready
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tight">SplitMate</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
            Делите расходы за поездки, кафе и подарки. Приложение считает баланс и показывает минимальные переводы между друзьями.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Stat icon={<Users size={16} />} label="Участники" value={participants.length.toString()} />
            <Stat icon={<ReceiptText size={16} />} label="Расходы" value={expenses.length.toString()} />
            <Stat icon={<Banknote size={16} />} label="Итого" value={money(total)} />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Событие</label>
        <input
          value={eventName}
          onChange={(event) => setEventName(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-base font-bold outline-none transition focus:border-cyan-300/60"
        />
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Участники</h2>
          <Users className="text-cyan-200" size={20} />
        </div>

        <form onSubmit={addParticipant} className="flex gap-2">
          <input
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            placeholder="Имя друга"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          />
          <button className="rounded-2xl bg-cyan-300 px-4 text-slate-950 transition active:scale-95" type="submit">
            <Plus size={20} />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {participants.map((participant) => (
            <button
              key={participant.id}
              onClick={() => removeParticipant(participant.id)}
              className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm transition hover:border-red-300/40 hover:bg-red-400/10"
              type="button"
            >
              {participant.name}
              <Trash2 className="opacity-40 group-hover:text-red-200 group-hover:opacity-100" size={13} />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Новый расход</h2>
          <ReceiptText className="text-cyan-200" size={20} />
        </div>

        <form onSubmit={addExpense} className="space-y-3">
          <input
            value={expenseTitle}
            onChange={(event) => setExpenseTitle(event.target.value)}
            placeholder="Например: Ужин"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          />
          <input
            value={expenseAmount}
            onChange={(event) => setExpenseAmount(event.target.value)}
            placeholder="Сумма в ₸"
            inputMode="numeric"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          />

          <select
            value={paidBy}
            onChange={(event) => setPaidBy(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none transition focus:border-cyan-300/60"
          >
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                Заплатил: {participant.name}
              </option>
            ))}
          </select>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-300">Разделить между</p>
            <div className="flex flex-wrap gap-2">
              {participants.map((participant) => {
                const active = splitWith.includes(participant.id);

                return (
                  <button
                    key={participant.id}
                    onClick={() => toggleSplitWith(participant.id)}
                    className={`rounded-full border px-3 py-2 text-sm transition active:scale-95 ${
                      active
                        ? "border-cyan-200/50 bg-cyan-300 text-slate-950"
                        : "border-white/10 bg-white/10 text-slate-300"
                    }`}
                    type="button"
                  >
                    {participant.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-3 font-black text-slate-950 transition active:scale-[0.98]"
            type="submit"
          >
            <Plus size={18} />
            Добавить расход
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">История расходов</h2>
          <Banknote className="text-cyan-200" size={20} />
        </div>

        <div className="space-y-2">
          {expenses.map((expense) => {
            const payer = participants.find((participant) => participant.id === expense.paidBy)?.name ?? "—";

            return (
              <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{expense.title}</p>
                  <p className="text-xs text-slate-400">{payer} оплатил · {expense.splitWith.length} чел.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="font-black text-cyan-100">{money(expense.amount)}</p>
                  <button onClick={() => removeExpense(expense.id)} className="rounded-full p-2 text-slate-500 transition hover:bg-red-400/10 hover:text-red-200" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Баланс</h2>
          <ArrowRightLeft className="text-cyan-200" size={20} />
        </div>

        <div className="space-y-2">
          {balances.map((balance) => (
            <div key={balance.participantId} className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
              <div className="flex items-center justify-between">
                <p className="font-bold">{balance.name}</p>
                <p className={`font-black ${balance.net >= 0 ? "text-emerald-200" : "text-orange-200"}`}>
                  {balance.net >= 0 ? "+" : ""}{money(balance.net)}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <span>Оплатил: {money(balance.paid)}</span>
                <span>Доля: {money(balance.share)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 mt-4 rounded-[1.6rem] border border-cyan-200/20 bg-cyan-300/[0.08] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Кто кому должен</h2>
          <Send className="text-cyan-200" size={20} />
        </div>

        {transfers.length > 0 ? (
          <div className="space-y-2">
            {transfers.map((transfer) => (
              <div key={`${transfer.from}-${transfer.to}-${transfer.amount}`} className="flex items-center justify-between rounded-2xl bg-slate-950/45 p-3">
                <p className="text-sm">
                  <span className="font-bold">{transfer.from}</span>
                  <span className="text-slate-500"> → </span>
                  <span className="font-bold">{transfer.to}</span>
                </p>
                <p className="font-black text-cyan-100">{money(transfer.amount)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-300/10 p-4 text-sm text-emerald-100">
            Все расходы уже сбалансированы. Никто никому не должен.
          </div>
        )}

        <button
          onClick={copySummary}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-slate-950 transition active:scale-[0.98]"
          type="button"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "Скопировано" : "Скопировать итог для Telegram"}
        </button>
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
      <div className="mb-2 text-cyan-200">{icon}</div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}
