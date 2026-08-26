// src/templates/galleryBridge.ts
//
// Tiny bridge so the Blockly Templates flyout button (registered deep in the
// toolbox, before React mounts its handlers) can ask the editor to open the
// gallery. BlockCoding registers the opener; the flyout button calls it.

let opener: (() => void) | null = null;

export function setGalleryOpener(fn: (() => void) | null): void {
  opener = fn;
}

export function openTemplateGallery(): void {
  opener?.();
}
