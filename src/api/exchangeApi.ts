import { EXCHANGE_ACTION_FLOW, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { EXCHANGE_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import type { Item } from '@/models/item';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'exchange_seed_lock',
    from_user_id: 'user_chen',
    to_user_id: 'user_lin',
    from_item_id: 'item_books',
    to_item_id: 'item_desk',
    status: ExchangeStatus.ACCEPTED,
    message: '设计书换置物架，已约好周末当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const itemIdsOf = (exchange: Exchange) => [exchange.from_item_id, exchange.to_item_id];

const assertItemsLockable = (items: (Item | undefined)[]) => {
  for (const item of items) {
    if (!item) throw new Error(EXCHANGE_MESSAGES.acceptItemMissing);
    if (item.status === ItemStatus.AVAILABLE) continue;
    if (item.status === ItemStatus.BOOKED) throw new Error(EXCHANGE_MESSAGES.acceptLockedByOther);
    if (item.status === ItemStatus.EXCHANGED) throw new Error(EXCHANGE_MESSAGES.acceptItemExchanged);
    if (item.status === ItemStatus.OFFLINE) throw new Error(EXCHANGE_MESSAGES.acceptItemOffline);
  }
};

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges;
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const itemIds = itemIdsOf(current);
    if (status === ExchangeStatus.ACCEPTED) {
      // 同意即锁定：双方物品都必须处于可交换状态，锁定中的物品不能再次被同意
      const items = await Promise.all(itemIds.map((itemId) => itemApi.detail(itemId)));
      assertItemsLockable(items);
      await itemApi.lockForExchange(itemIds, id);
    }
    if (status === ExchangeStatus.REJECTED) {
      // 拒绝/取消：释放本单占用的物品，物品回到可交换状态
      await itemApi.releaseExchangeLock(itemIds, id);
    }
    if (status === ExchangeStatus.COMPLETED) {
      // 完成：占用按业务结果终结为已交换
      await itemApi.completeExchangeItems(itemIds);
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  /** 对齐历史数据：已同意的交换补齐物品锁定，失效的占用标记释放回可交换 */
  async syncItemLocks(): Promise<void> {
    const exchanges = await this.list();
    const items = await itemApi.list();
    const accepted = exchanges.filter((item) => item.status === ExchangeStatus.ACCEPTED);
    const acceptedIds = new Set(accepted.map((item) => item.id));

    const staleIds = items
      .filter((item) => item.locked_by && !acceptedIds.has(item.locked_by) && item.status === ItemStatus.BOOKED)
      .map((item) => item.id);
    if (staleIds.length) {
      await itemApi.patchMany(staleIds, { status: ItemStatus.AVAILABLE, locked_by: null });
    }

    for (const exchange of accepted) {
      const ids = itemIdsOf(exchange);
      const related = items.filter((item) => ids.includes(item.id));
      const lockable = related
        .filter((item) => item.status === ItemStatus.AVAILABLE || (item.status === ItemStatus.BOOKED && !item.locked_by))
        .map((item) => item.id);
      if (lockable.length) {
        await itemApi.lockForExchange(lockable, exchange.id);
      }
    }
  },
};
