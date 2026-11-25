// src/ailabs/robotSay.ts
//
// ONE place that decides where Fira's voice comes out when a program runs on a
// connected robot. Before this, the AI blocks (AI_SPEAK / AI_ASK / AI_CONVERSE)
// were only implemented in SimSink (laptop speechSynthesis). On a real robot the
// TransportSink streamed them raw to the firmware, which answers UNSUPPORTED — so
// the robot stayed silent and, in mirror mode, the laptop talked instead.

import { speakViaRobot, SPEAK_REASON_TEXT } from './robotVoice';
import { speak, ttsSupported, listenOnce, sttSupported } from './speech';
import { listenViaRobot, robotCanListen } from './micStt';
import { firaChat } from './brain';
import { showToast } from '../ui/toast';

let lastFallbackToast = 0;

/** Speak through the robot's speaker; fall back to the laptop and SAY WHY (throttled). */
export async function sayOnRobotOrLaptop(text: string): Promise<boolean> {
  const t = text.trim();
  if (!t) return false;
  const res = await speakViaRobot(t);
  if (res.ok) return true;
  if (typeof document !== 'undefined' && Date.now() - lastFallbackToast > 4000) {
    lastFallbackToast = Date.now();
    showToast(`Suara dari laptop: ${SPEAK_REASON_TEXT[res.reason]}${res.detail ? ` (${res.detail})` : ''}`, 'warn', 4500);
  }
  if (ttsSupported()) speak(t);
  return false;
}

/** Host-side execution of the AI blocks against a connected robot. */
export async function runAiBlockOnRobot(command: string, params: Record<string, unknown>): Promise<void> {
  if (command === 'AI_SPEAK') {
    await sayOnRobotOrLaptop(String(params.text ?? ''));
    return;
  }
  if (command === 'AI_ASK') {
    const q = String(params.question ?? '').trim();
    if (!q) return;
    try {
      const r = await firaChat([{ role: 'user', content: q }]);
      await sayOnRobotOrLaptop(r.content);
    } catch (e) {
      console.warn('[AI_ASK] chat failed', e);
    }
    return;
  }
  if (command === 'AI_CONVERSE') {
    let heard: string | null = null;
    if (robotCanListen()) heard = await listenViaRobot(3);     // robot mic first
    else if (sttSupported()) {
      const r = await listenOnce();
      heard = r.ok ? r.text ?? null : null;
    }
    if (!heard) return;
    try {
      const r = await firaChat([{ role: 'user', content: heard }]);
      await sayOnRobotOrLaptop(r.content);
    } catch (e) {
      console.warn('[AI_CONVERSE] chat failed', e);
    }
  }
}

export const HOST_AI_COMMANDS: ReadonlySet<string> = new Set(['AI_SPEAK', 'AI_ASK', 'AI_CONVERSE']);
