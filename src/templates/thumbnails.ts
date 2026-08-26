// src/templates/thumbnails.ts
//
// Inline animated SVG thumbnails for the Template Gallery. Kept as pure strings so
// a card can render one with dangerouslySetInnerHTML and it animates on its own
// (SMIL) — no per-card JS, no external assets. viewBox is a 8:5 card.

const W = 160;
const H = 100;

function frame(inner: string, bg = '#EEF2FF'): string {
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="${bg}"/>
  ${inner}
</svg>`;
}

const robot = (fill = '#4F46E5') =>
  `<g><rect x="-7" y="-7" width="14" height="14" rx="4" fill="${fill}"/><circle cx="0" cy="-2" r="2" fill="#fff"/></g>`;

/** Robot dot travelling along a path, which stays drawn behind it. */
export function motionThumb(pathD: string, color = '#4F46E5', dur = 3): string {
  return frame(`
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" stroke-dasharray="4 4"/>
    <g>${robot(color)}
      <animateMotion dur="${dur}s" repeatCount="indefinite" rotate="auto" path="${pathD}"/>
    </g>`);
}

/** A single-line motion demo: robot slides forward, a glyph pops, a note rings. */
export function helloThumb(): string {
  return frame(`
    <g transform="translate(30,50)">${robot('#4F46E5')}
      <animateTransform attributeName="transform" type="translate" values="30,50; 96,50; 96,50" keyTimes="0;0.5;1" dur="3s" repeatCount="indefinite"/>
    </g>
    <g transform="translate(120,34)" opacity="0">
      <circle r="12" fill="#22C55E"/><path d="M-5 0a5 4 0 0 0 10 0" stroke="#fff" stroke-width="2" fill="none"/>
      <circle cx="-4" cy="-3" r="1.6" fill="#fff"/><circle cx="4" cy="-3" r="1.6" fill="#fff"/>
      <animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.55;0.7;1" dur="3s" repeatCount="indefinite"/>
    </g>
    <g stroke="#F97316" stroke-width="2" fill="none" opacity="0.9">
      <path d="M116 70q6 -6 0 -12"><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.7;0.85;1" dur="3s" repeatCount="indefinite"/></path>
    </g>`, '#F5F3FF');
}

/** 5x5 LED matrix flickering between frames. */
export function matrixThumb(color = '#3B82F6'): string {
  const cells: string[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 52 + c * 12;
      const y = 22 + r * 12;
      const delay = ((r + c) % 4) * 0.4;
      cells.push(
        `<rect x="${x}" y="${y}" width="9" height="9" rx="2" fill="${color}"><animate attributeName="opacity" values="0.15;1;0.15" dur="1.6s" begin="${delay}s" repeatCount="indefinite"/></rect>`,
      );
    }
  }
  return frame(cells.join(''), '#EFF6FF');
}

/** Bouncing equaliser bars for sound/music templates. */
export function soundThumb(color = '#F97316'): string {
  const bars = [0, 1, 2, 3, 4].map((i) => {
    const x = 40 + i * 18;
    const d = 0.2 * i;
    return `<rect x="${x}" y="30" width="12" height="40" rx="4" fill="${color}">
      <animate attributeName="height" values="16;44;16" dur="1s" begin="${d}s" repeatCount="indefinite"/>
      <animate attributeName="y" values="62;28;62" dur="1s" begin="${d}s" repeatCount="indefinite"/></rect>`;
  });
  return frame(bars.join(''), '#FFF7ED');
}

/** Robot with a sweeping ultrasonic cone meeting an obstacle. */
export function sensorThumb(color = '#8B5CF6'): string {
  return frame(`
    <g transform="translate(36,50)">${robot(color)}</g>
    <g transform="translate(43,50)">
      <path d="M0 0 L48 -20 L48 20 Z" fill="${color}" opacity="0.18">
        <animateTransform attributeName="transform" type="rotate" values="-18 0 0; 18 0 0; -18 0 0" dur="2.4s" repeatCount="indefinite"/>
      </path>
    </g>
    <circle cx="120" cy="50" r="12" fill="#EF4444">
      <animate attributeName="r" values="12;9;12" dur="2.4s" repeatCount="indefinite"/>
    </circle>`, '#F5F3FF');
}

/** Camera body with a scanning line + a bounding box — for AI templates. */
export function aiThumb(color = '#EC2D8F'): string {
  return frame(`
    <rect x="34" y="28" width="92" height="52" rx="8" fill="#fff" stroke="${color}" stroke-width="3"/>
    <circle cx="80" cy="54" r="15" fill="none" stroke="${color}" stroke-width="3"/>
    <line x1="38" y1="30" x2="38" y2="78" stroke="${color}" stroke-width="3" opacity="0.6">
      <animate attributeName="x1" values="38;122;38" dur="2.4s" repeatCount="indefinite"/>
      <animate attributeName="x2" values="38;122;38" dur="2.4s" repeatCount="indefinite"/>
    </line>
    <rect x="64" y="40" width="30" height="28" rx="4" fill="none" stroke="#22C55E" stroke-width="2.5">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.4s" repeatCount="indefinite"/>
    </rect>`, '#FDF2F8');
}

/** Countdown digits for the variables challenge. */
export function counterThumb(color = '#CA8A04'): string {
  const digits = ['3', '2', '1'].map(
    (d, i) =>
      `<text x="80" y="66" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="52" font-weight="800" fill="${color}" opacity="0">${d}
      <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.5;1" dur="3s" begin="${i}s" repeatCount="indefinite"/></text>`,
  );
  return frame(digits.join(''), '#FEFCE8');
}

/** Looping arrow to convey a reusable function called N times. */
export function funcThumb(color = '#565386'): string {
  return frame(`
    <g transform="translate(80,50)">
      <path d="M-26 0a26 26 0 1 1 8 18" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
      <path d="M-20 24 l2 -14 l13 6 z" fill="${color}"/>
      <text x="0" y="7" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="20" font-weight="800" fill="${color}">4×
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite"/>
      </text>
    </g>`, '#EEEEFB');
}
