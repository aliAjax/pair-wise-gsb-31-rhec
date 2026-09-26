import { EXCHANGE_ACTION_FLOW, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { EXCHANGE_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';

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
    id: 'exchange_seed_compete',
    from_user_id: 'user_chen',
    to_user_id: 'user_lin',
    from_item_id: 'item_books',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '想用设计书换你的拍立得，书保存得很好。',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

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
      throw new Error(EXCHANGE_MESSAGES.targetItemUnavailable);
    }
    const sourceItem = await itemApi.detail(draft.from_item_id);
    if (!sourceItem || sourceItem.status !== ItemStatus.AVAILABLE) {
      throw new Error(EXCHANGE_MESSAGES.sourceItemUnavailable);
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
    const itemIds = [current.from_item_id, current.to_item_id];
    if (status === ExchangeStatus.ACCEPTED) {
      // 同意即锁定双方物品；任一物品已被其他交换占用时整体失败，不会出现部分锁定
      await itemApi.lockForExchange(itemIds, current.id);
    }
    if (status === ExchangeStatus.REJECTED) {
      // 拒绝/取消时释放本交换持有的占用，物品回到可交换状态
      await itemApi.releaseForExchange(itemIds, current.id);
    }
    if (status === ExchangeStatus.COMPLETED) {
      // 完成后占用按业务结果结算为已交换
      await itemApi.completeForExchange(itemIds);
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },
};
