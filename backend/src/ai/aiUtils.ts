/**
 * aiUtils.ts
 *
 * Miscellaneous helper functions for the AI (random choice, shuffle, min/max indices).
 */

export function randomChoice<T>(arr: T[]): T | undefined {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  export function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  export function indicesOfMin(arr: number[]): number[] {
    if (!arr || arr.length === 0) return [];
    let min = Infinity;
    let indices: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] < min) {
        min = arr[i];
        indices = [i];
      } else if (arr[i] === min) {
        indices.push(i);
      }
    }
    return indices;
  }
  
  export function indicesOfMax(arr: number[]): number[] {
    if (!arr || arr.length === 0) return [];
    let max = -Infinity;
    let indices: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > max) {
        max = arr[i];
        indices = [i];
      } else if (arr[i] === max) {
        indices.push(i);
      }
    }
    return indices;
  }
  