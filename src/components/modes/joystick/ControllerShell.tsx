// src/components/modes/joystick/ControllerShell.tsx
// Inline SVG component rendering the original 1600x900 RobotKu Pad molded chassis.

import React from 'react';

interface ControllerShellProps {
  ledColor?: string;
}

export function ControllerShell({ ledColor = '#38bdf8' }: ControllerShellProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1600 900"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rkShellGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f1f2f5" />
          <stop offset="100%" stopColor="#dcdee4" />
        </linearGradient>

        <linearGradient id="rkShellShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="rkCoreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2d33" />
          <stop offset="100%" stopColor="#16171b" />
        </linearGradient>

        <linearGradient id="rkBumperGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3c43" />
          <stop offset="100%" stopColor="#1c1d21" />
        </linearGradient>

        <linearGradient id="rkScreenGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#15171d" />
          <stop offset="100%" stopColor="#0a0b0e" />
        </linearGradient>

        <linearGradient id="rkScreenSheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <radialGradient id="rkWellGrad" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#0e0f12" />
          <stop offset="100%" stopColor="#23252b" />
        </radialGradient>

        <radialGradient id="rkLightWell" cx="0.5" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#d9dbe1" />
          <stop offset="100%" stopColor="#f4f5f8" />
        </radialGradient>

        <linearGradient id="rkLedBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ledColor} stopOpacity="0" />
          <stop offset="50%" stopColor={ledColor} stopOpacity="1" />
          <stop offset="100%" stopColor={ledColor} stopOpacity="0" />
        </linearGradient>

        <filter id="rkDropShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="28" />
        </filter>

        <filter id="rkInnerShade" x="-10%" y="-10%" width="120%" height="120%">
          <feOffset dy="-10" />
          <feGaussianBlur stdDeviation="14" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="out" result="edge" />
          <feFlood floodColor="#9aa0ad" floodOpacity="0.45" />
          <feComposite in2="edge" operator="in" result="shade" />
          <feComposite in="shade" in2="SourceGraphic" operator="in" />
        </filter>

        <filter id="rkLedGlow" x="-20%" y="-400%" width="140%" height="900%">
          <feGaussianBlur stdDeviation="6" />
        </filter>

        <path
          id="rkBodyPath"
          d="M420 140 H1180 C1300 140 1380 170 1420 240 C1470 330 1500 520 1510 660
             C1520 780 1470 830 1400 830 C1340 830 1310 790 1280 740 C1230 680 1150 662 1050 662
             H550 C450 662 370 680 320 740 C290 790 260 830 200 830 C130 830 80 780 90 660
             C100 520 130 330 180 240 C220 170 300 140 420 140 Z"
        />
        <clipPath id="rkBodyClip">
          <use href="#rkBodyPath" />
        </clipPath>
      </defs>

      {/* Ground soft shadow */}
      <ellipse cx="800" cy="850" rx="620" ry="28" fill="#000" opacity="0.18" filter="url(#rkDropShadow)" />

      {/* Shoulder bumpers (behind body) */}
      <path
        d="M230 205 C260 140 330 110 420 110 H560 C590 110 600 130 590 150 H300 C270 150 245 170 230 205 Z"
        fill="url(#rkBumperGrad)"
      />
      <path
        d="M1370 205 C1340 140 1270 110 1180 110 H1040 C1010 110 1000 130 1010 150 H1300 C1330 150 1355 170 1370 205 Z"
        fill="url(#rkBumperGrad)"
      />

      {/* Shell body */}
      <use href="#rkBodyPath" fill="url(#rkShellGrad)" />
      <use href="#rkBodyPath" fill="#fff" filter="url(#rkInnerShade)" />
      <g clipPath="url(#rkBodyClip)">
        {/* Top highlight */}
        <path
          d="M300 150 H1300 C1360 160 1400 200 1420 250 H180 C200 200 240 160 300 150 Z"
          fill="url(#rkShellShine)"
          opacity="0.8"
        />
        {/* Ergonomic parting line */}
        <path
          d="M120 470 C300 440 470 452 520 470 M1080 470 C1130 452 1300 440 1480 470"
          stroke="#c9ccd4"
          strokeWidth="2"
          fill="none"
          opacity="0.7"
        />
      </g>
      <use href="#rkBodyPath" fill="none" stroke="#c4c7cf" strokeWidth="2" />

      {/* Dark inner core panel (holds thumbsticks & speaker) */}
      <rect x="440" y="468" width="720" height="160" rx="52" fill="url(#rkCoreGrad)" />
      <path d="M492 470 H1108" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" />

      {/* Analog stick wells */}
      <circle cx="620" cy="555" r="72" fill="url(#rkWellGrad)" />
      <circle cx="620" cy="555" r="72" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="3" />
      <circle cx="980" cy="555" r="72" fill="url(#rkWellGrad)" />
      <circle cx="980" cy="555" r="72" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="3" />

      {/* Home button seat & speaker grille dots */}
      <circle cx="800" cy="585" r="26" fill="#0d0e11" stroke="#3a3c43" strokeWidth="2" />
      <g fill="#0b0c0f" opacity="0.9">
        <circle cx="770" cy="512" r="4" /><circle cx="785" cy="512" r="4" /><circle cx="800" cy="512" r="4" /><circle cx="815" cy="512" r="4" /><circle cx="830" cy="512" r="4" />
        <circle cx="777" cy="526" r="4" /><circle cx="792" cy="526" r="4" /><circle cx="808" cy="526" r="4" /><circle cx="823" cy="526" r="4" />
      </g>

      {/* D-Pad & Action button recesses */}
      <circle cx="330" cy="330" r="118" fill="url(#rkLightWell)" opacity="0.9" />
      <circle cx="330" cy="330" r="118" fill="none" stroke="#c6c9d1" strokeWidth="2" />
      <circle cx="1270" cy="330" r="118" fill="url(#rkLightWell)" opacity="0.9" />
      <circle cx="1270" cy="330" r="118" fill="none" stroke="#c6c9d1" strokeWidth="2" />

      {/* Small pill seats (gear / mode) */}
      <rect x="490" y="182" width="16" height="44" rx="8" fill="#d6d8de" />
      <rect x="1094" y="182" width="16" height="44" rx="8" fill="#d6d8de" />

      {/* Center monitor frame & bezel */}
      <rect x="516" y="152" width="568" height="302" rx="34" fill="#c3c6ce" />
      <rect x="528" y="164" width="544" height="278" rx="26" fill="url(#rkScreenGrad)" />
      <rect x="528" y="164" width="544" height="278" rx="26" fill="url(#rkScreenSheen)" />
      <rect x="528.5" y="164.5" width="543" height="277" rx="25.5" fill="none" stroke="#ffffff" strokeOpacity="0.08" />

      {/* LED light bar under the monitor */}
      <rect x="620" y="459" width="360" height="6" rx="3" fill="url(#rkLedBar)" filter="url(#rkLedGlow)" />
      <rect x="640" y="460" width="320" height="4" rx="2" fill="url(#rkLedBar)" />
    </svg>
  );
}
