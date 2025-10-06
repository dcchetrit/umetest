/**
 * Utility functions for Firestore operations
 */

/**
 * Filter out undefined values to prevent Firestore errors
 * Recursively processes nested objects to ensure no undefined values are passed to Firestore
 */
export function filterUndefined(obj: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        filtered[key] = filterUndefined(value);
      } else {
        filtered[key] = value;
      }
    }
  }
  return filtered;
}

/**
 * Alternative approach using Object.fromEntries for simple objects
 * Use this for objects without nested structures
 */
export function filterUndefinedSimple(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}