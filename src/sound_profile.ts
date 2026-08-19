export interface SoundProfile {
  name: string;
  id: number;
  assetPath: string;
}

export const SOUND_MAPPING: SoundProfile[] = [
  { name: "Beep",    id: 1, assetPath: "sounds/beep.mp3" },
  { name: "Siren",   id: 2, assetPath: "sounds/siren.mp3" },
  { name: "Success", id: 3, assetPath: "sounds/success.mp3" },
  { name: "Error",   id: 4, assetPath: "sounds/error.mp3" },
];