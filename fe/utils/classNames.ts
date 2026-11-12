/**
 * Utility function to conditionally merge Tailwind CSS class names.
 *
 * Combines class names using `clsx`, then intelligently resolves Tailwind conflicts
 * using `tailwind-merge`. Useful in React components for dynamic styling.
 *
 * Example usage:
 *   cn('p-4', isActive && 'bg-blue-500', 'text-sm')
 *   → 'p-4 bg-blue-500 text-sm'
 *
 * @param inputs - List of class names (strings, conditionals, arrays)
 * @returns A single resolved class name string
 *
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
