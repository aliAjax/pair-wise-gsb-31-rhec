<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出</span>
        <strong>{{ fromItem?.title ?? '未知物品' }}</strong>
        <small v-if="fromItemHint" class="lock-hint">{{ fromItemHint }}</small>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
        <small v-if="toItemHint" class="lock-hint">{{ toItemHint }}</small>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <p v-if="operateHint" class="operate-hint">{{ operateHint }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate" class="exchange-card__actions">
        <template v-if="exchange.status === ExchangeStatus.PENDING">
          <button type="button" :disabled="!itemsAvailable" @click="$emit('accept', exchange.id)">
            同意
          </button>
          <button type="button" @click="$emit('reject', exchange.id)">拒绝</button>
        </template>
        <template v-if="exchange.status === ExchangeStatus.ACCEPTED">
          <button type="button" @click="$emit('complete', exchange.id)">完成</button>
          <button type="button" @click="$emit('reject', exchange.id)">取消</button>
        </template>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { EXCHANGE_MESSAGES } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import {
  formatDate,
  formatExchangeStatus,
  formatLockDestination,
  formatStatusMessage,
  statusToneClass,
} from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  complete: [id: string];
}>();

const authStore = useAuthStore();
const exchangeStore = useExchangeStore();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));

const lockHintFor = (item?: Item) => {
  if (!item || item.status !== ItemStatus.LOCKED) return '';
  if (item.locked_by_exchange_id === props.exchange.id) return '本交换锁定中';
  return formatLockDestination(item, exchangeStore.exchanges, props.items);
};
const fromItemHint = computed(() => lockHintFor(fromItem.value));
const toItemHint = computed(() => lockHintFor(toItem.value));

const itemsAvailable = computed(
  () => fromItem.value?.status === ItemStatus.AVAILABLE && toItem.value?.status === ItemStatus.AVAILABLE,
);
const operateHint = computed(() => {
  if (props.exchange.status === ExchangeStatus.PENDING && !itemsAvailable.value) {
    return EXCHANGE_MESSAGES.pendingLockedHint;
  }
  if (props.exchange.status === ExchangeStatus.ACCEPTED) {
    return '双方物品已锁定，完成交换或取消后释放';
  }
  return '';
});

const canOperate = computed(
  () =>
    authStore.currentUser?.id === props.exchange.to_user_id ||
    (authStore.currentUser?.id === props.exchange.from_user_id && props.exchange.status === ExchangeStatus.ACCEPTED),
);
</script>
