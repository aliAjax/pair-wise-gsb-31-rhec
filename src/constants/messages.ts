import { ExchangeStatus } from './exchange';
import { ItemStatus } from './item';

export const PAGE_MESSAGES = {
  homeEmpty: '暂时没有符合条件的闲置物品',
  publishReady: '发布后会同步写入 localStorage 和 IndexedDB',
  exchangeEmpty: '还没有交换请求，先去首页挑一件合眼缘的物品',
  profileUpdated: '个人资料已更新',
};

export const FORM_MESSAGES = {
  requiredTitle: '物品标题不能为空',
  requiredDescription: '请描述你希望交换的物品',
  requiredPhone: '请填写联系方式',
  imageLimit: '最多上传 4 张图片',
  exchangeNeedOwnItem: '请先发布一件可交换物品',
};

export const EXCHANGE_MESSAGES = {
  acceptLockedByOther: '物品正被其他交换占用，暂时无法同意',
  acceptItemExchanged: '物品已完成交换，无法同意该请求',
  acceptItemOffline: '物品已下架，无法同意该请求',
  acceptItemMissing: '关联物品不存在，无法同意该请求',
  lockedByThis: '本单已锁定双方物品，等待完成',
  lockedByOther: '正被另一笔交换占用',
  itemLockedPanel: '物品已被一笔进行中的交换锁定',
  lockReleased: '已释放双方物品占用',
  offlineBlocked: '物品正在交换中，暂时无法下架',
};

export const LOG_MESSAGES = {
  storageHydrated: 'storage hydrated with status maps',
  itemStatusUsed: `ItemStatus includes ${ItemStatus.AVAILABLE}, ${ItemStatus.BOOKED}, ${ItemStatus.EXCHANGED}, ${ItemStatus.OFFLINE}`,
  exchangeStatusUsed: `ExchangeStatus includes ${ExchangeStatus.PENDING}, ${ExchangeStatus.ACCEPTED}, ${ExchangeStatus.REJECTED}, ${ExchangeStatus.COMPLETED}`,
};

export const STATUS_MESSAGE_MAP = {
  [ItemStatus.AVAILABLE]: '这件物品可发起交换',
  [ItemStatus.BOOKED]: '物品已被交换锁定，等待交换结果',
  [ItemStatus.EXCHANGED]: '这件物品已完成交换',
  [ItemStatus.OFFLINE]: '这件物品已下架',
  [ExchangeStatus.PENDING]: '等待对方确认',
  [ExchangeStatus.ACCEPTED]: '交换已同意，双方物品已锁定',
  [ExchangeStatus.REJECTED]: '交换请求已拒绝，物品占用已释放',
  [ExchangeStatus.COMPLETED]: '交换流程已完成',
};
