// src/data/lessons.ts
//
// Robotku Academy (LMS) content seed + repository.
//
// This is the single source of lesson/group data for now. It is intentionally a
// plain module so it can later be swapped for a CMS/API without touching the UI:
// pages only ever talk to the repository functions at the bottom of this file
// (getGroups / getLessons / searchLessons / getLesson), never the raw arrays.

export type LessonStatus = 'live' | 'coming_soon' | 'subscribe'; // green | amber | pink

export interface LessonContent {
  slides?: string; // .pptx/.pdf/Google-Slides URL (rendered in the detail shell)
  videoEmbed?: string; // YouTube (no-cookie) embed URL
  practiceProjectId?: string; // deep-link target for /control/modes/code
  quizId?: string;
}

export interface Lesson {
  id: string;
  number?: number; // "1.", "2." — used for ordered Basics
  title: string;
  thumbnail: string; // cover image (graceful fallback if missing)
  levelType: string; // chip: "Robotku Basics" / "Level 1..4"
  concepts: string[]; // chips: Teamwork, Geometry, Motion Control, …
  status: LessonStatus;
  group: string; // Group.id this lesson belongs to
  content?: LessonContent;
  requiresSubscription?: boolean;
}

export interface Group {
  id: string;
  title: string;
  emoji?: string;
  order: number;
}

// ---- Groups (folder taxonomy) --------------------------------------------

export const GROUPS: Group[] = [
  { id: 'basics', title: 'Robotku Basics', emoji: '🤖', order: 1 },
  { id: 'reference-mechanisms', title: 'Reference Mechanisms', emoji: '⚙️', order: 2 },
  { id: 'design-thinking', title: 'Design Thinking', emoji: '💡', order: 3 },
  { id: 'sciences', title: 'Sciences', emoji: '🧲', order: 4 },
  { id: 'makerspace-robotics', title: 'Makerspace & Robotics', emoji: '🛠️', order: 5 },
  { id: 'ai-ml', title: 'AI & Machine Learning', emoji: '🌐', order: 6 },
  { id: 'sustainability', title: 'Sustainability', emoji: '♻️', order: 7 },
  { id: 'maths', title: 'Maths', emoji: '🧮', order: 8 },
  { id: 'languages', title: 'Languages', emoji: '🔤', order: 9 },
  { id: 'arts-music', title: 'Arts, Craft & Music', emoji: '🎨', order: 10 },
  { id: 'global-adventures', title: 'Global Adventures', emoji: '🌍', order: 11 },
];

// ---- Lessons (example content) -------------------------------------------
// Basics is ordered Part 1..6 (guest-visible). Other groups showcase both
// views and every status colour (live / coming_soon / subscribe).

export const LESSONS: Lesson[] = [
  {
    id: 'basics-1',
    number: 1,
    title: 'Shapes & Structures',
    thumbnail: '/academy/thumbs/shapes.png',
    levelType: 'Robotku Basics',
    concepts: ['Teamwork', 'Geometry', 'Structures'],
    status: 'live',
    group: 'basics',
    content: { slides: 'https://docs.google.com/presentation/d/e/EXAMPLE/embed' },
  },
  {
    id: 'basics-2',
    number: 2,
    title: 'Intro to Connectors',
    thumbnail: '/academy/thumbs/connectors.png',
    levelType: 'Robotku Basics',
    concepts: ['Structures', 'Fine Motor'],
    status: 'live',
    group: 'basics',
  },
  {
    id: 'basics-3',
    number: 3,
    title: 'Intro to Electronics',
    thumbnail: '/academy/thumbs/electronics.png',
    levelType: 'Robotku Basics',
    concepts: ['Motion Control', 'Circuits'],
    status: 'live',
    group: 'basics',
  },
  {
    id: 'basics-4',
    number: 4,
    title: 'Build a Basic Robot',
    thumbnail: '/academy/thumbs/basic-robot.png',
    levelType: 'Robotku Basics',
    concepts: ['Teamwork', 'Assembly'],
    status: 'live',
    group: 'basics',
    content: { videoEmbed: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ' },
  },
  {
    id: 'basics-5',
    number: 5,
    title: 'Robot Mechanisms',
    thumbnail: '/academy/thumbs/mechanisms.png',
    levelType: 'Robotku Basics',
    concepts: ['Mechanisms', 'Motion Control'],
    status: 'live',
    group: 'basics',
  },
  {
    id: 'basics-6',
    number: 6,
    title: 'Block Coding',
    thumbnail: '/academy/thumbs/blockcoding.png',
    levelType: 'Robotku Basics',
    concepts: ['Coding', 'Logic'],
    status: 'live',
    group: 'basics',
    content: { practiceProjectId: 'starter-move' },
  },
  {
    id: 'mech-pulley',
    title: 'Building a Belt & Pulley',
    thumbnail: '/academy/thumbs/pulley.png',
    levelType: 'Level 1',
    concepts: ['Mechanisms', 'Force & Motion'],
    status: 'live',
    group: 'reference-mechanisms',
  },
  {
    id: 'mech-gearbox',
    title: 'Gear Ratios & Torque',
    thumbnail: '/academy/thumbs/gearbox.png',
    levelType: 'Level 2',
    concepts: ['Mechanisms', 'Maths'],
    status: 'coming_soon',
    group: 'reference-mechanisms',
  },
  {
    id: 'design-empathy',
    title: 'Design Thinking: Empathy Map',
    thumbnail: '/academy/thumbs/empathy.png',
    levelType: 'Level 1',
    concepts: ['Design Thinking', 'Teamwork'],
    status: 'live',
    group: 'design-thinking',
  },
  {
    id: 'sci-magnets',
    title: 'Magnets & Electromagnets',
    thumbnail: '/academy/thumbs/magnets.png',
    levelType: 'Level 2',
    concepts: ['Physics', 'Circuits'],
    status: 'coming_soon',
    group: 'sciences',
  },
  {
    id: 'maker-3dprint',
    title: 'Intro to 3D Printing',
    thumbnail: '/academy/thumbs/3dprint.png',
    levelType: 'Level 3',
    concepts: ['Making', 'Design'],
    status: 'subscribe',
    group: 'makerspace-robotics',
    requiresSubscription: true,
  },
  {
    id: 'ai-cv',
    title: 'Building a Computer Vision Model',
    thumbnail: '/academy/thumbs/cv.png',
    levelType: 'Level 4',
    concepts: ['AI', 'Critical Thinking'],
    status: 'coming_soon',
    group: 'ai-ml',
  },
  {
    id: 'sus-farm',
    title: 'Learning about Sustainable Farming',
    thumbnail: '/academy/thumbs/farm.png',
    levelType: 'Level 4',
    concepts: ['Sustainability', 'Problem Solving'],
    status: 'subscribe',
    group: 'sustainability',
    requiresSubscription: true,
  },
  {
    id: 'maths-symmetry',
    title: 'Symmetry & Patterns',
    thumbnail: '/academy/thumbs/symmetry.png',
    levelType: 'Level 1',
    concepts: ['Geometry', 'Maths'],
    status: 'live',
    group: 'maths',
  },
];

// ---- Repository ----------------------------------------------------------
// The UI depends only on these functions. Swap the bodies for fetch()/CMS
// calls later; the async signatures already leave room for that.

export interface LessonFilter {
  level?: string; // "All" | "Robotku Basics" | "Level 1".."Level 4"
  q?: string; // free-text search over title/concepts
  guest?: boolean; // guest = only live Basics
}

const LEVEL_ALL = 'All';

function visibleToGuest(l: Lesson): boolean {
  return l.group === 'basics' && l.status === 'live';
}

export async function getGroups(): Promise<Group[]> {
  return [...GROUPS].sort((a, b) => a.order - b.order);
}

export async function getLessons(filter: LessonFilter = {}): Promise<Lesson[]> {
  const { level, q, guest } = filter;
  const needle = q?.trim().toLowerCase();

  return LESSONS.filter((l) => {
    if (guest && !visibleToGuest(l)) return false;
    if (level && level !== LEVEL_ALL && l.levelType !== level) return false;
    if (needle) {
      const hay = `${l.title} ${l.concepts.join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
}

export async function searchLessons(q: string, guest = false): Promise<Lesson[]> {
  return getLessons({ q, guest });
}

export async function getLesson(id: string): Promise<Lesson | undefined> {
  return LESSONS.find((l) => l.id === id);
}

// Level options for the <LevelSelect/> dropdown.
export const LEVEL_OPTIONS = [
  LEVEL_ALL,
  'Robotku Basics',
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
];
