import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { itemApi } from '@/api/itemApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { message } from '@/utils/message';

import { useItemStore } from './itemStore';

export const useExchangeStore = defineStore('exchanges', {
  state: () => ({
    exchanges: [] as Exchange[],
    statusFilter: 'all' as ExchangeStatus | 'all',
    loading: false,
  }),
  getters: {
    sent: (state) => (userId: string) => state.exchanges.filter((item) => item.from_user_id === userId),
    received: (state) => (userId: string) => state.exchanges.filter((item) => item.to_user_id === userId),
    filtered: (state) => {
      if (state.statusFilter === 'all') return state.exchanges;
      return state.exchanges.filter((item) => item.status === state.statusFilter);
    },
    byId: (state) => (id: string) => state.exchanges.find((item) => item.id === id),
  },
  actions: {
    async refreshAll() {
      this.exchanges = await exchangeApi.list();
      const itemStore = useItemStore();
      itemStore.items = await itemApi.list();
    },
    async hydrate() {
      this.loading = true;
      try {
        await exchangeApi.syncItemLocks();
        await this.refreshAll();
      } finally {
        this.loading = false;
      }
    },
    async create(draft: ExchangeDraft) {
      const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
      await this.refreshAll();
      message('交换请求已发出', 'success');
      return exchange;
    },
    async accept(id: string) {
      try {
        await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
        await this.refreshAll();
        message('已同意交换，双方物品已锁定', 'success');
        return true;
      } catch (error) {
        await this.refreshAll();
        message(error instanceof Error ? error.message : '操作失败', 'error');
        return false;
      }
    },
    async reject(id: string) {
      try {
        await exchangeApi.transition(id, ExchangeStatus.REJECTED);
        await this.refreshAll();
        message('已拒绝交换，相关物品占用已释放', 'success');
        return true;
      } catch (error) {
        await this.refreshAll();
        message(error instanceof Error ? error.message : '操作失败', 'error');
        return false;
      }
    },
    async complete(id: string) {
      try {
        await exchangeApi.transition(id, ExchangeStatus.COMPLETED);
        await this.refreshAll();
        message('交换已完成，双方物品状态已更新', 'success');
        return true;
      } catch (error) {
        await this.refreshAll();
        message(error instanceof Error ? error.message : '操作失败', 'error');
        return false;
      }
    },
  },
});
