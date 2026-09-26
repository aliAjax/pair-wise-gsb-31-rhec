import dayjs from 'dayjs';

import { ExchangeStatus } from '@/constants/exchange';
import { ItemCondition, ItemStatus } from '@/constants/item';
import { STATUS_MESSAGE_MAP } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';

export const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');

export const formatItemStatus = (status: ItemStatus) => {
  const map: Record<ItemStatus, string> = {
    [ItemStatus.AVAILABLE]: '可交换',
    [ItemStatus.LOCKED]: '锁定中',
    [ItemStatus.EXCHANGED]: '已交换',
    [ItemStatus.OFFLINE]: '已下架',
  };
  return map[status];
};

export const formatExchangeStatus = (status: ExchangeStatus) => {
  const map: Record<ExchangeStatus, string> = {
    [ExchangeStatus.PENDING]: '待确认',
    [ExchangeStatus.ACCEPTED]: '已同意',
    [ExchangeStatus.REJECTED]: '已拒绝',
    [ExchangeStatus.COMPLETED]: '已完成',
  };
  return map[status];
};

export const formatCondition = (condition: ItemCondition) => {
  const map: Record<ItemCondition, string> = {
    [ItemCondition.NEW]: '全新',
    [ItemCondition.LIKE_NEW]: '九成新',
    [ItemCondition.GOOD]: '八成新',
    [ItemCondition.WORN]: '战损',
  };
  return map[condition];
};

export const formatCreditLevel = (score: number) => {
  if (score >= 90) return '守约达人';
  if (score >= 75) return '稳定交换';
  if (score >= 60) return '新晋用户';
  return '需谨慎';
};

export const statusToneClass = (status: ItemStatus | ExchangeStatus) => {
  if (status === ItemStatus.AVAILABLE || status === ExchangeStatus.ACCEPTED) return 'status-good';
  if (status === ItemStatus.OFFLINE || status === ExchangeStatus.REJECTED) return 'status-muted';
  if (status === ItemStatus.EXCHANGED || status === ExchangeStatus.COMPLETED) return 'status-done';
  if (status === ItemStatus.LOCKED || status === ExchangeStatus.PENDING) return 'status-wait';
  return 'status-wait';
};

export const formatStatusMessage = (status: ItemStatus | ExchangeStatus) => STATUS_MESSAGE_MAP[status];

export const findLockingExchange = (item: Item, exchanges: Exchange[]) =>
  exchanges.find((exchange) => exchange.id === item.locked_by_exchange_id);

export const formatLockDestination = (item: Item, exchanges: Exchange[], items: Item[]) => {
  if (item.status !== ItemStatus.LOCKED) return '';
  const exchange = findLockingExchange(item, exchanges);
  if (!exchange) return STATUS_MESSAGE_MAP[ItemStatus.LOCKED];
  const counterpartId = exchange.from_item_id === item.id ? exchange.to_item_id : exchange.from_item_id;
  const counterpart = items.find((entry) => entry.id === counterpartId);
  const counterpartTitle = counterpart?.title ?? '另一件物品';
  return `被与「${counterpartTitle}」的交换占用（${formatExchangeStatus(exchange.status)}）`;
};
