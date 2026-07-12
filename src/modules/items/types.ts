import type { Tables, InsertDto, Enums } from '@/lib/supabase/database.types'

export type Item = Tables<'items'>
export type ItemInsert = InsertDto<'items'>
export type ItemType = Enums<'item_type'>
export type ItemState = Enums<'item_state'>
