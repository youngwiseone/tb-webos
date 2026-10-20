import type {StartupVoice} from './retro';

/** Use the TV's local clock, sampled once per startup/replay. */
export function startupGreeting(date = new Date()): string {
  const hour = date.getHours();
  return hour >= 5 && hour < 12 ? 'GOOD MORNING' : hour >= 12 && hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
}

export const STARTUP_DURATION: Record<StartupVoice,number> = {gba: 4400, ps2: 5200};
