// src/templates/galleryBridge.ts
//
// Tiny bridge so the Blockly Templates flyout button (registered deep in the
// toolbox, before React mounts its handlers) can ask the editor to open the
// gallery. BlockCoding registers the opener; the flyout button calls it.

import type { BlockSpec } from './authoring';

let opener: (() => void) | null = null;
let lcdBlockInserter: ((program: BlockSpec[], label?: string) => void) | null = null;

export function setGalleryOpener(fn: (() => void) | null): void {
  opener = fn;
}

export function openTemplateGallery(): void {
  opener?.();
}

export function setLcdBlockInserter(fn: ((program: BlockSpec[], label?: string) => void) | null): void {
  lcdBlockInserter = fn;
}

export function insertLcdBlock(program: BlockSpec[], label?: string): void {
  lcdBlockInserter?.(program, label);
}

