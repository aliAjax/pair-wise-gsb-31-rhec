import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import { EXCHANGE_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { useItemStore } from '@/stores/itemStore';
import { message } from '@/utils/message';

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
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
      } finally {
        this.loading = false;
      }
    },
    async refreshAfterTransition() {
      this.exchanges = await exchangeApi.list();
      // 物品锁定/释放发生在同一次流转里，同步刷新物品列表让状态 pill 和占用提示立即更新
      await useItemStore().hydrate();
    },
    async runTransition(id: string, status: ExchangeStatus, successText: string) {
      try {
        await exchangeApi.transition(id, status);
        message(successText, 'success');
      } catch (error) {
        message(error instanceof Error ? error.message : '操作失败', 'error');
      } finally {
        await this.refreshAfterTransition();
      }
    },
    async create(draft: ExchangeDraft) {
      try {
        const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
        message(EXCHANGE_MESSAGES.created, 'success');
        return exchange;
      } catch (error) {
        message(error instanceof Error ? error.message : '操作失败', 'error');
        return null;
      } finally {
        this.exchanges = await exchangeApi.list();
      }
    },
    async accept(id: string) {
      await this.runTransition(id, ExchangeStatus.ACCEPTED, EXCHANGE_MESSAGES.acceptLocked);
    },
    async reject(id: string) {
      const current = this.exchanges.find((item) => item.id === id);
      const successText =
        current?.status === ExchangeStatus.ACCEPTED
          ? EXCHANGE_MESSAGES.cancelReleased
          : EXCHANGE_MESSAGES.rejectReleased;
      await this.runTransition(id, ExchangeStatus.REJECTED, successText);
    },
    async complete(id: string) {
      await this.runTransition(id, ExchangeStatus.COMPLETED, EXCHANGE_MESSAGES.completed);
    },
  },
});
