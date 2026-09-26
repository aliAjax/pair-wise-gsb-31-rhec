/* eslint-disable no-console */
// 冒烟脚本：验证“同意即锁定、锁定不可再同意、拒绝/完成按结果释放”的状态机
import 'fake-indexeddb/auto';

const localStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => (localStore.has(key) ? (localStore.get(key) as string) : null),
  setItem: (key: string, value: string) => void localStore.set(key, String(value)),
  removeItem: (key: string) => void localStore.delete(key),
  clear: () => localStore.clear(),
  key: (index: number) => [...localStore.keys()][index] ?? null,
  get length() {
    return localStore.size;
  },
} as Storage;

const assert = (cond: boolean, label: string) => {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`ok - ${label}`);
};

const { exchangeApi } = await import('../src/api/exchangeApi');
const { itemApi } = await import('../src/api/itemApi');
const { ExchangeStatus } = await import('../src/constants/exchange');
const { ItemStatus } = await import('../src/constants/item');

const expectThrow = async (fn: () => Promise<unknown>, label: string) => {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  assert(threw, label);
};

// 1. 种子数据：两条指向同一物品 item_camera 的待确认请求都保留
const exchanges = await exchangeApi.list();
assert(exchanges.length === 2, '两条待确认请求均保留');
assert(
  exchanges.every((e) => e.status === ExchangeStatus.PENDING && e.to_item_id === 'item_camera'),
  '两条请求都待确认且目标都是拍立得',
);

// 1b. 锁定前先存在一条涉及 item_chair 的待确认请求（模拟历史遗留请求）
const third = await exchangeApi.create({
  from_user_id: 'user_me',
  to_user_id: 'user_chen',
  from_item_id: 'item_chair',
  to_item_id: 'item_books',
  message: '露营椅换设计书',
});

// 2. 同意第一单 → 双方物品锁定，占用去向记录为 exchange_seed
await exchangeApi.transition('exchange_seed', ExchangeStatus.ACCEPTED);
let camera = await itemApi.detail('item_camera');
let chair = await itemApi.detail('item_chair');
assert(camera?.status === ItemStatus.LOCKED && camera.locked_by_exchange_id === 'exchange_seed', '目标物品已锁定且记录占用去向');
assert(chair?.status === ItemStatus.LOCKED && chair.locked_by_exchange_id === 'exchange_seed', '发起方物品同步锁定');

// 3. 锁定中的物品不能再次被同意 / 再次发起
await expectThrow(
  () => exchangeApi.transition('exchange_seed_compete', ExchangeStatus.ACCEPTED),
  '第二单同意被拒绝（物品已被锁定）',
);
const stillPending = (await exchangeApi.list()).find((e) => e.id === 'exchange_seed_compete');
assert(stillPending?.status === ExchangeStatus.PENDING, '冲突请求仍是待确认，物主可继续处理');
await expectThrow(
  () =>
    exchangeApi.create({
      from_user_id: 'user_chen',
      to_user_id: 'user_lin',
      from_item_id: 'item_books',
      to_item_id: 'item_camera',
      message: '再试一次',
    }),
  '锁定中的物品不能再发起交换',
);

// 4. 重复同意同一单也被状态机拦截
await expectThrow(
  () => exchangeApi.transition('exchange_seed', ExchangeStatus.ACCEPTED),
  '同一单不能重复同意',
);

// 5. 拒绝涉及同一物品的待确认请求：不释放别人持有的锁定
await exchangeApi.transition(third.id, ExchangeStatus.REJECTED);
camera = await itemApi.detail('item_camera');
chair = await itemApi.detail('item_chair');
assert(
  camera?.status === ItemStatus.LOCKED && chair?.status === ItemStatus.LOCKED,
  '拒绝无关请求不影响已有锁定',
);

// 6. 取消已同意的交换 → 占用释放，双方物品回到可交换
await exchangeApi.transition('exchange_seed', ExchangeStatus.REJECTED);
camera = await itemApi.detail('item_camera');
chair = await itemApi.detail('item_chair');
assert(
  camera?.status === ItemStatus.AVAILABLE && !camera.locked_by_exchange_id,
  '取消后目标物品释放为可交换',
);
assert(
  chair?.status === ItemStatus.AVAILABLE && !chair.locked_by_exchange_id,
  '取消后发起方物品同步释放',
);

// 7. 释放后此前保留的待确认请求可以同意并完成 → 占用结算为已交换
await exchangeApi.transition('exchange_seed_compete', ExchangeStatus.ACCEPTED);
await exchangeApi.transition('exchange_seed_compete', ExchangeStatus.COMPLETED);
camera = await itemApi.detail('item_camera');
const books = await itemApi.detail('item_books');
assert(
  camera?.status === ItemStatus.EXCHANGED && !camera.locked_by_exchange_id,
  '完成后目标物品结算为已交换',
);
assert(
  books?.status === ItemStatus.EXCHANGED && !books.locked_by_exchange_id,
  '完成后发起方物品结算为已交换',
);

// 8. 终态不可再流转
await expectThrow(
  () => exchangeApi.transition('exchange_seed_compete', ExchangeStatus.ACCEPTED),
  '已完成单不可再操作',
);

console.log('\n全部冒烟断言通过');
