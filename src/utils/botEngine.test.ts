import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getXpRequiredForNextLevel,
  calculateLevelProgress,
  hasRolePermission,
  calculateMinesMultiplier,
  evaluateBlackjackHand,
  formatWelcomeTemplate,
  processBankTransfer,
  processShopPurchase,
  createInitialBotState,
} from './botEngine';

test('XP leveling curve and progress calculations work accurately', () => {
  assert.equal(getXpRequiredForNextLevel(0), 100);
  assert.equal(getXpRequiredForNextLevel(1), 155);
  assert.equal(getXpRequiredForNextLevel(2), 220);

  const level0 = calculateLevelProgress(50);
  assert.equal(level0.level, 0);
  assert.equal(level0.currentLevelXp, 50);
  assert.equal(level0.nextLevelXp, 100);
  assert.equal(level0.progressPercent, 50);

  const level2 = calculateLevelProgress(255); // 100 + 155 = 255 -> exact start of level 2
  assert.equal(level2.level, 2);
  assert.equal(level2.currentLevelXp, 0);
  assert.equal(level2.nextLevelXp, 220);
});

test('Role-based permission checks enforce hierarchy permissions', () => {
  const state = createInitialBotState();
  const admin = state.members.find((m) => m.id === 'mem-1')!;
  const citizen = state.members.find((m) => m.id === 'mem-4')!;
  const restricted = state.members.find((m) => m.id === 'mem-6')!;

  assert.equal(hasRolePermission(admin, state.roles, 'mod_ban'), true);
  assert.equal(hasRolePermission(citizen, state.roles, 'mod_ban'), false);
  assert.equal(hasRolePermission(citizen, state.roles, 'run_economy'), true);
  assert.equal(hasRolePermission(restricted, state.roles, 'run_economy'), false);
});

test('Aether Mines multiplier scales monotonically with revealed gems and bomb count', () => {
  const m0 = calculateMinesMultiplier(0, 3);
  assert.equal(m0, 1.0);

  const m1 = calculateMinesMultiplier(1, 3);
  const m3 = calculateMinesMultiplier(3, 3);
  const m3HighRisk = calculateMinesMultiplier(3, 8);

  assert.ok(m1 > 1.0);
  assert.ok(m3 > m1);
  assert.ok(m3HighRisk > m3);
});

test('Blackjack hand evaluation handles soft Aces and Blackjack accurately', () => {
  const bj = evaluateBlackjackHand([
    { rank: 'A', suit: '♠', value: 11 },
    { rank: 'K', suit: '♥', value: 10 },
  ]);
  assert.equal(bj.total, 21);
  assert.equal(bj.isBlackjack, true);
  assert.equal(bj.isBust, false);

  const softConversion = evaluateBlackjackHand([
    { rank: 'A', suit: '♠', value: 11 },
    { rank: '9', suit: '♦', value: 9 },
    { rank: '5', suit: '♣', value: 5 },
  ]);
  assert.equal(softConversion.total, 15);
  assert.equal(softConversion.isSoft, false);
  assert.equal(softConversion.isBust, false);
});

test('Economy bank transfer and shop purchase validate balances and levels', () => {
  const state = createInitialBotState();
  const member = state.members[0]; // wallet 14850, bank 62000, cap 100000

  const depOk = processBankTransfer(member, 'deposit', 5000);
  assert.equal(depOk.ok, true);
  assert.equal(depOk.updatedMember?.wallet, 9850);
  assert.equal(depOk.updatedMember?.bank, 67000);

  const depOverCap = processBankTransfer(member, 'deposit', 50000);
  assert.equal(depOverCap.ok, false);

  const item = state.shopItems[0]; // 1800 shards, +750 XP
  const purchase = processShopPurchase(member, item);
  assert.equal(purchase.ok, true);
  assert.equal(purchase.updatedMember?.wallet, member.wallet - item.price);
  assert.equal(purchase.updatedMember?.xp, member.xp + 750);
});

test('Welcome template formatter replaces all dynamic placeholders', () => {
  const res = formatWelcomeTemplate(
    'Hello {user}, welcome to {server} (#{member_count}) invited by {inviter} with {role}!',
    {
      user: '@nova',
      server: 'Aetherium',
      memberCount: 500,
      inviter: '@kaelen',
      role: 'Explorer',
    }
  );
  assert.equal(
    res,
    'Hello @nova, welcome to Aetherium (#500) invited by @kaelen with Explorer!'
  );
});
