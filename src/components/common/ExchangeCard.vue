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
        <em class="item-lock-tag" :class="itemLockTone(fromItem)">{{ itemLockLabel(fromItem) }}</em>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
        <em class="item-lock-tag" :class="itemLockTone(toItem)">{{ itemLockLabel(toItem) }}</em>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <p v-if="lockHint" class="exchange-card__hint">{{ lockHint }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate" class="exchange-card__actions">
        <button
          v-if="exchange.status === ExchangeStatus.PENDING"
          type="button"
          :disabled="!canAccept"
          @click="$emit('accept', exchange.id)"
        >
          同意
        </button>
        <button v-if="exchange.status === ExchangeStatus.PENDING" type="button" @click="$emit('reject', exchange.id)">
          拒绝
        </button>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED" type="button" @click="$emit('complete', exchange.id)">
          完成
        </button>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED" type="button" @click="$emit('reject', exchange.id)">
          拒绝
        </button>
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
import { formatDate, formatExchangeStatus, formatItemStatus, formatStatusMessage, statusToneClass } from '@/utils/formatters';

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
const canOperate = computed(
  () =>
    authStore.currentUser?.id === props.exchange.to_user_id ||
    (authStore.currentUser?.id === props.exchange.from_user_id && props.exchange.status === ExchangeStatus.ACCEPTED),
);

const lockedByThis = (item?: Item) =>
  Boolean(item && item.status === ItemStatus.BOOKED && item.locked_by === props.exchange.id);
const lockedByOther = (item?: Item) =>
  Boolean(item && item.status === ItemStatus.BOOKED && item.locked_by !== props.exchange.id);

/** 只有双方物品都可交换（或已被本单锁定）时才允许同意 */
const canAccept = computed(() =>
  [fromItem.value, toItem.value].every(
    (item) => item && (item.status === ItemStatus.AVAILABLE || lockedByThis(item)),
  ),
);

const lockDestination = (item?: Item) => {
  if (!item?.locked_by) return '';
  const holder = exchangeStore.byId(item.locked_by);
  if (!holder) return '';
  const from = props.users.find((user) => user.id === holder.from_user_id)?.nickname ?? '未知用户';
  const to = props.users.find((user) => user.id === holder.to_user_id)?.nickname ?? '未知用户';
  return `${from} → ${to}`;
};

const itemLockLabel = (item?: Item) => {
  if (!item) return '物品缺失';
  if (lockedByThis(item)) return '本单锁定中';
  if (lockedByOther(item)) return EXCHANGE_MESSAGES.lockedByOther;
  return formatItemStatus(item.status);
};

const itemLockTone = (item?: Item) => {
  if (!item) return 'status-muted';
  if (lockedByThis(item) || lockedByOther(item)) return 'status-wait';
  return statusToneClass(item.status);
};

/** 可操作状态说明：告诉物主为什么能/不能继续操作，以及占用去向 */
const lockHint = computed(() => {
  if (props.exchange.status === ExchangeStatus.ACCEPTED) {
    return EXCHANGE_MESSAGES.lockedByThis;
  }
  if (props.exchange.status !== ExchangeStatus.PENDING || canAccept.value) return '';
  const blocked = [fromItem.value, toItem.value].find(
    (item) => !item || (item.status !== ItemStatus.AVAILABLE && !lockedByThis(item)),
  );
  if (!blocked) return EXCHANGE_MESSAGES.acceptItemMissing;
  if (lockedByOther(blocked)) {
    const destination = lockDestination(blocked);
    return `「${blocked.title}」${EXCHANGE_MESSAGES.lockedByOther}${destination ? `（占用去向：${destination}）` : ''}，暂时无法同意`;
  }
  if (blocked.status === ItemStatus.EXCHANGED) return `「${blocked.title}」${EXCHANGE_MESSAGES.acceptItemExchanged}`;
  if (blocked.status === ItemStatus.OFFLINE) return `「${blocked.title}」${EXCHANGE_MESSAGES.acceptItemOffline}`;
  return '';
});
</script>
