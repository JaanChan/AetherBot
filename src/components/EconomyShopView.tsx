import React, { useState } from 'react';
import { BotDatabaseState, ShopItem, TransactionRecord } from '../types/bot';
import {
  processBankTransfer,
  processShopPurchase,
  hasRolePermission,
} from '../utils/botEngine';
import {
  Wallet,
  Landmark,
  ShoppingBag,
  ArrowRightLeft,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface EconomyShopViewProps {
  state: BotDatabaseState;
  onUpdateState: (updater: (prev: BotDatabaseState) => BotDatabaseState) => void;
}

export const EconomyShopView: React.FC<EconomyShopViewProps> = ({
  state,
  onUpdateState,
}) => {
  const activeMember =
    state.members.find((m) => m.id === state.activeMemberId) || state.members[0];

  const [transferAmount, setTransferAmount] = useState<string>('1000');
  const [transferDirection, setTransferDirection] = useState<
    'deposit' | 'withdraw'
  >('deposit');
  const [bankFeedback, setBankFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [shopCategory, setShopCategory] = useState<
    'all' | 'boost' | 'utility' | 'role' | 'cosmetic'
  >('all');
  const [shopFeedback, setShopFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Add custom shop item state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('2500');
  const [newItemEffect, setNewItemEffect] = useState('+10% XP Boost');
  const [newItemCategory, setNewItemCategory] = useState<
    'boost' | 'utility' | 'role' | 'cosmetic'
  >('boost');
  const [newItemLevel, setNewItemLevel] = useState('2');

  const [txSearch, setTxSearch] = useState('');

  const totalServerCirculation = state.members.reduce(
    (sum, m) => sum + m.wallet + m.bank,
    0
  );

  const handleBankOperation = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(transferAmount);
    const result = processBankTransfer(activeMember, transferDirection, num);
    if (!result.ok || !result.updatedMember) {
      setBankFeedback({
        type: 'err',
        text: result.error || 'Transfer failed.',
      });
      return;
    }

    const updated = result.updatedMember;
    const tx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      memberId: activeMember.id,
      memberName: activeMember.displayName,
      type: 'transfer',
      amount: transferDirection === 'deposit' ? -num : num,
      description: `${
        transferDirection === 'deposit' ? 'Deposited' : 'Withdrew'
      } ${num.toLocaleString()} ◈ ${
        transferDirection === 'deposit' ? 'into Bank Vault' : 'from Bank Vault'
      }`,
      timestamp: new Date().toISOString(),
    };

    onUpdateState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
      transactions: [tx, ...prev.transactions].slice(0, 50),
    }));

    setBankFeedback({
      type: 'ok',
      text: `Successfully ${
        transferDirection === 'deposit' ? 'deposited' : 'withdrew'
      } ${num.toLocaleString()} ◈.`,
    });
  };

  const handleBuyItem = (item: ShopItem) => {
    const res = processShopPurchase(activeMember, item);
    if (!res.ok || !res.updatedMember) {
      setShopFeedback({
        type: 'err',
        text: res.error || 'Purchase declined.',
      });
      return;
    }

    const updated = res.updatedMember;
    const tx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      memberId: activeMember.id,
      memberName: activeMember.displayName,
      type: 'shop_buy',
      amount: -item.price,
      description: `Purchased ${item.name} (${item.effectLabel}) from /shop`,
      timestamp: new Date().toISOString(),
    };

    onUpdateState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
      transactions: [tx, ...prev.transactions].slice(0, 50),
    }));

    setShopFeedback({
      type: 'ok',
      text: `Purchased "${item.name}" for ${item.price.toLocaleString()} ◈! Added to ${activeMember.displayName}'s inventory.`,
    });
  };

  const handleCreateShopItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newItemName.trim();
    const priceNum = Math.floor(Number(newItemPrice));
    const lvlNum = Math.max(1, Math.floor(Number(newItemLevel)));

    if (!trimmedName || !Number.isFinite(priceNum) || priceNum <= 0) {
      setShopFeedback({
        type: 'err',
        text: 'Please provide a valid item name and positive Shard price.',
      });
      return;
    }

    const created: ShopItem = {
      id: `item-${Date.now()}`,
      name: trimmedName,
      description: `Custom guild item configured via Economy Console (${newItemEffect.trim() || 'Utility Perk'}).`,
      price: priceNum,
      category: newItemCategory,
      effectLabel: newItemEffect.trim() || 'Server Perk',
      requiredLevel: lvlNum,
    };

    onUpdateState((prev) => ({
      ...prev,
      shopItems: [...prev.shopItems, created],
    }));

    setNewItemName('');
    setShopFeedback({
      type: 'ok',
      text: `Added "${created.name}" (${created.price.toLocaleString()} ◈) to the Server Shop and synced to cogs/economy.py.`,
    });
  };

  const filteredItems = state.shopItems.filter((item) =>
    shopCategory === 'all' ? true : item.category === shopCategory
  );

  const filteredTransactions = state.transactions.filter(
    (tx) =>
      tx.memberName.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.description.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.type.toLowerCase().includes(txSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Economy Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">
            {activeMember.displayName} · Wallet
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-emerald-400 mt-1">
            {activeMember.wallet.toLocaleString()} ◈
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Liquid Aether Shards for games & shop
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Protected Bank Vault</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1">
            {activeMember.bank.toLocaleString()}{' '}
            <span className="text-sm text-slate-500">
              / {activeMember.bankCapacity.toLocaleString()} ◈
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Immune to heist & robbery losses
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Total Guild Circulation</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-indigo-300 mt-1">
            {totalServerCirculation.toLocaleString()} ◈
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across {state.members.length} tracked guild members
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Active Inventory Items</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-amber-300 mt-1">
            {activeMember.inventory.length} Owned
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {activeMember.inventory.length > 0
              ? activeMember.inventory.join(' · ')
              : 'No items owned yet'}
          </div>
        </div>
      </div>

      {/* Two-Column Split: Left = Vault Banking & Add Shop Item, Right = Interactive Item Shop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Vault Transfer & Admin Item Creator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleBankOperation}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Vault Banking (/deposit & /withdraw)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Move Aether Shards between liquid wallet and protected storage
                </p>
              </div>
              <Landmark className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setTransferDirection('deposit')}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  transferDirection === 'deposit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Deposit to Vault
              </button>
              <button
                type="button"
                onClick={() => setTransferDirection('withdraw')}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  transferDirection === 'withdraw'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Withdraw to Wallet
              </button>
            </div>

            <div>
              <label
                htmlFor="bank-transfer-amount"
                className="block text-xs text-slate-400 mb-1"
              >
                Transfer Amount (◈ Aether Shards)
              </label>
              <div className="flex gap-2">
                <input
                  id="bank-transfer-amount"
                  type="number"
                  min={1}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTransferAmount(
                      String(
                        transferDirection === 'deposit'
                          ? Math.min(
                              activeMember.wallet,
                              activeMember.bankCapacity - activeMember.bank
                            )
                          : activeMember.bank
                      )
                    )
                  }
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-300"
                >
                  Max
                </button>
              </div>
            </div>

            {bankFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  bankFeedback.type === 'ok'
                    ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-700/60 text-rose-300'
                }`}
              >
                {bankFeedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{bankFeedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Execute {transferDirection === 'deposit' ? 'Deposit' : 'Withdrawal'}
            </button>
          </form>

          {/* Add New Shop Item Form */}
          <form
            onSubmit={handleCreateShopItem}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5"
          >
            <div className="pb-2.5 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">
                Create Custom Server Shop Item
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                New items immediately appear in /shop and sync to cogs/economy.py
              </p>
            </div>

            <div>
              <label
                htmlFor="new-item-name"
                className="block text-xs text-slate-400 mb-1"
              >
                Item Name
              </label>
              <input
                id="new-item-name"
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Quantum Double-XP Elixir"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="new-item-price"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Price (◈)
                </label>
                <input
                  id="new-item-price"
                  type="number"
                  min={50}
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="new-item-category"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Category
                </label>
                <select
                  id="new-item-category"
                  value={newItemCategory}
                  onChange={(e) =>
                    setNewItemCategory(
                      e.target.value as 'boost' | 'utility' | 'role' | 'cosmetic'
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100"
                >
                  <option value="boost">Boost</option>
                  <option value="utility">Utility</option>
                  <option value="role">Role Pass</option>
                  <option value="cosmetic">Cosmetic</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="new-item-level"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Req. Level
                </label>
                <input
                  id="new-item-level"
                  type="number"
                  min={1}
                  value={newItemLevel}
                  onChange={(e) => setNewItemLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="new-item-effect"
                className="block text-xs text-slate-400 mb-1"
              >
                Effect Summary
              </label>
              <input
                id="new-item-effect"
                type="text"
                value={newItemEffect}
                onChange={(e) => setNewItemEffect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item to Server Catalog
            </button>
          </form>
        </div>

        {/* Right: Server Shop Catalog (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Aetherium Server Shop (/shop & /buy)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Purchasing as {activeMember.displayName} (Lv.{activeMember.level} ·{' '}
                {activeMember.wallet.toLocaleString()} ◈ available)
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {(['all', 'boost', 'utility', 'role', 'cosmetic'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setShopCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                      shopCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {shopFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                shopFeedback.type === 'ok'
                  ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-700/60 text-rose-300'
              }`}
            >
              {shopFeedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{shopFeedback.text}</span>
            </div>
          )}

          <div className="divide-y divide-slate-800">
            {filteredItems.map((item) => {
              const alreadyOwned =
                activeMember.inventory.includes(item.name) &&
                (item.category === 'role' || item.category === 'cosmetic');
              return (
                <div
                  key={item.id}
                  className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-indigo-300 font-mono">
                        {item.effectLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="text-[11px] text-slate-500">
                      Category: <span className="capitalize">{item.category}</span> ·
                      Requires Level {item.requiredLevel}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-mono tabular-nums font-semibold text-emerald-400">
                        {item.price.toLocaleString()} ◈
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Lv.{item.requiredLevel}+
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyOwned}
                      onClick={() => handleBuyItem(item)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      {alreadyOwned ? 'Owned' : `Buy ${item.name.split(' ')[0]}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: High-Density Economy Transaction Ledger */}
      <section
        aria-label="Economy Transaction Ledger"
        className="bg-slate-900 border border-slate-800 rounded-xl p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Persistent Economy Audit Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time log of all minted, wagered, transferred, and spent Aether Shards
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Filter transactions"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Filter by member or action..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Member</th>
                <th className="py-2.5 px-4 font-medium">Event Type</th>
                <th className="py-2.5 px-4 font-medium">Description</th>
                <th className="py-2.5 px-4 font-medium text-right">Shard Delta</th>
                <th className="py-2.5 pl-4 font-medium text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-950/60 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-slate-100 whitespace-nowrap">
                    {tx.memberName}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                    {tx.type}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300">{tx.description}</td>
                  <td
                    className={`py-2.5 px-4 font-mono tabular-nums font-semibold text-right whitespace-nowrap ${
                      tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} ◈
                  </td>
                  <td className="py-2.5 pl-4 font-mono tabular-nums text-slate-500 text-right whitespace-nowrap">
                    {new Date(tx.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
