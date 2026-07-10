import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class names and resolve conflicting Tailwind utilities (last wins).
 * The standard helper used across all UI components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
