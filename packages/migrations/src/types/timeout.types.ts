export interface TimeoutManager {
  getRemainingTimeMs: () => number;
  threshold: number;
  shouldStop: () => boolean;
}
