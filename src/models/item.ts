import { ItemCondition, ItemStatus } from '@/constants/item';

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  condition: ItemCondition;
  images: string[];
  status: ItemStatus;
  /** 占用去向：锁定该物品的交换单 id，未锁定时为 null */
  locked_by?: string | null;
  location: string;
  created_at: string;
}

export type ItemDraft = Omit<Item, 'id' | 'status' | 'created_at'> & {
  status?: ItemStatus;
};
