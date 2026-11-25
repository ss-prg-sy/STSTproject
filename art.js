/*
 * 怪物の絵（SVG）
 * もとの「運動でモンスターを倒すダイエットゲーム」でBさんが描いた4体を、そのまま使っています。
 * 絵を直したいときは、このファイルの MONSTERS の parts を編集してください。
 */
(() => {
  "use strict";


  // ---------- 怪物データ（第3段階：薄暗い森・恐め獣寄り） ----------
  // 各怪物は名前・落とすおとしもの(drop)・体パーツ(parts)を持つ。
  // 表示は「共通defs ＋ 森背景 ＋ parts」を組み立てて1枚のSVGにする。

  const MONSTER_DEFS = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5a5b9e"/><stop offset="40%" stop-color="#c66b7a"/><stop offset="70%" stop-color="#ff9d5c"/><stop offset="100%" stop-color="#ffd08a"/></linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a8a4a"/><stop offset="100%" stop-color="#4e5c30"/></linearGradient>
    <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9c7a6a"/><stop offset="100%" stop-color="#6e5548"/></linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff2c0" stop-opacity="1"/><stop offset="60%" stop-color="#ffbf6a" stop-opacity="0.6"/><stop offset="100%" stop-color="#ffbf6a" stop-opacity="0"/></radialGradient>
    <radialGradient id="eyeglow" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="#fff6c9"/><stop offset="35%" stop-color="#ffd24d"/><stop offset="75%" stop-color="#e8891f"/><stop offset="100%" stop-color="#7a3d0c"/></radialGradient>
    <radialGradient id="eyehalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffcf5a" stop-opacity="0.85"/><stop offset="100%" stop-color="#ffcf5a" stop-opacity="0"/></radialGradient>
    <radialGradient id="redglow" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="#ffe0d0"/><stop offset="40%" stop-color="#ff6b5a"/><stop offset="100%" stop-color="#7a1a10"/></radialGradient>
    <radialGradient id="redhalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff6b5a" stop-opacity="0.85"/><stop offset="100%" stop-color="#ff6b5a" stop-opacity="0"/></radialGradient>
    <radialGradient id="mBody" cx="42%" cy="22%" r="86%"><stop offset="0%" stop-color="#faf6ee"/><stop offset="50%" stop-color="#ddd4c2"/><stop offset="100%" stop-color="#8c8474"/></radialGradient>
    <radialGradient id="mMuz" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="#f7f2e8"/><stop offset="100%" stop-color="#b5ac9c"/></radialGradient>
    <radialGradient id="pBody" cx="42%" cy="24%" r="86%"><stop offset="0%" stop-color="#f5d97e"/><stop offset="50%" stop-color="#cea24a"/><stop offset="100%" stop-color="#7a5a28"/></radialGradient>
    <radialGradient id="pTop" cx="45%" cy="30%" r="75%"><stop offset="0%" stop-color="#8a5a34"/><stop offset="100%" stop-color="#4c301b"/></radialGradient>
    <radialGradient id="dBody" cx="42%" cy="22%" r="88%"><stop offset="0%" stop-color="#a6dcb0"/><stop offset="50%" stop-color="#5fa06c"/><stop offset="100%" stop-color="#2c5238"/></radialGradient>
    <radialGradient id="dBelly" cx="50%" cy="35%" r="70%"><stop offset="0%" stop-color="#dcefc0"/><stop offset="100%" stop-color="#8fb877"/></radialGradient>
    <radialGradient id="oBody" cx="45%" cy="24%" r="84%"><stop offset="0%" stop-color="#faf5ec"/><stop offset="55%" stop-color="#ddd5c2"/><stop offset="100%" stop-color="#9c9482"/></radialGradient>
    <radialGradient id="oShell" cx="50%" cy="40%" r="70%"><stop offset="0%" stop-color="#ef6a5a"/><stop offset="100%" stop-color="#8e2820"/></radialGradient>
    <filter id="blur1"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="blur2"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="softsh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="4"/><feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="fur" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.4" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="furedge" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.85 0.5" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="scale" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="turbulence" baseFrequency="0.15 0.15" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4"/></filter>
  `;

  const FOREST_BG = `
    <rect width="300" height="270" fill="url(#sky)"/>
    <circle cx="150" cy="130" r="78" fill="url(#sun)"/>
    <circle cx="150" cy="130" r="28" fill="#fff0b8" opacity="0.9"/>
    <g fill="#e88a6a" opacity="0.45"><ellipse cx="66" cy="52" rx="30" ry="9"/><ellipse cx="228" cy="42" rx="26" ry="8"/></g>
    <path d="M0 170 Q80 132 160 164 Q230 188 300 162 L300 270 L0 270 Z" fill="url(#hill)"/>
    <path d="M0 200 Q150 182 300 204 L300 270 L0 270 Z" fill="url(#grass)"/>
    <g stroke="#3d491f" stroke-width="2" stroke-linecap="round">
      <path d="M34 232 l-3 -11"/><path d="M39 232 l2 -13"/><path d="M64 236 l-2 -10"/><path d="M244 232 l2 -12"/><path d="M266 235 l-2 -10"/><path d="M270 235 l3 -13"/>
    </g>
    <ellipse cx="150" cy="238" rx="66" ry="12" fill="#2a3016" opacity="0.4" filter="url(#blur1)"/>
  `;

  const MONSTERS = [
    {
      name: "モチグマ",
      drop: "のびもち",
      parts: `<g transform="translate(150,150)">
        <ellipse cx="-40" cy="62" rx="21" ry="17" fill="url(#mBody)" filter="url(#softsh)"/><ellipse cx="40" cy="62" rx="21" ry="17" fill="url(#mBody)" filter="url(#softsh)"/>
        <g filter="url(#furedge)"><path d="M0 -2 C-40 -2 -52 22 -49 47 C-46 72 -24 80 0 80 C24 80 46 72 49 47 C52 22 40 -2 0 -2 Z" fill="url(#mBody)"/></g>
        <ellipse cx="-35" cy="46" rx="14" ry="26" fill="url(#mBody)" filter="url(#softsh)" transform="rotate(10 -35 46)"/><ellipse cx="35" cy="46" rx="14" ry="26" fill="url(#mBody)" filter="url(#softsh)" transform="rotate(-10 35 46)"/>
        <g fill="#221e1a"><path d="M-44 70 l-3 7 l4 -2 Z"/><path d="M-38 72 l-2 7 l4 -2 Z"/><path d="M44 70 l3 7 l-4 -2 Z"/><path d="M38 72 l2 7 l-4 -2 Z"/></g>
        <path d="M-26 -42 Q-36 -60 -18 -52 Z" fill="url(#mBody)" filter="url(#softsh)"/><path d="M26 -42 Q36 -60 18 -52 Z" fill="url(#mBody)" filter="url(#softsh)"/>
        <g filter="url(#furedge)"><path d="M0 -54 C-28 -54 -35 -30 -33 -10 C-31 12 -16 24 0 24 C16 24 31 12 33 -10 C35 -30 28 -54 0 -54 Z" fill="url(#mBody)"/></g>
        <ellipse cx="-14" cy="-18" rx="10" ry="8" fill="#39342d" opacity="0.6"/><ellipse cx="14" cy="-18" rx="10" ry="8" fill="#39342d" opacity="0.6"/>
        <circle cx="-14" cy="-18" r="10" fill="url(#eyehalo)"/><circle cx="14" cy="-18" r="10" fill="url(#eyehalo)"/><circle cx="-14" cy="-18" r="5.2" fill="url(#eyeglow)"/><circle cx="14" cy="-18" r="5.2" fill="url(#eyeglow)"/>
        <ellipse cx="-14" cy="-18" rx="1.4" ry="4.4" fill="#180d03"/><ellipse cx="14" cy="-18" rx="1.4" ry="4.4" fill="#180d03"/>
        <ellipse cx="0" cy="4" rx="15" ry="12" fill="url(#mMuz)" filter="url(#softsh)"/><ellipse cx="0" cy="-2" rx="5.5" ry="4" fill="#241f1a"/>
        <path d="M-10 10 Q0 17 10 10" fill="none" stroke="#241f1a" stroke-width="2.4" stroke-linecap="round"/><path d="M-5 12 l-2 7 l4 -3 Z" fill="#f3efe6"/><path d="M5 12 l2 7 l-4 -3 Z" fill="#f3efe6"/>
      </g>`,
    },
    {
      name: "ドカプリン",
      drop: "ぷるゼリー",
      parts: `<g transform="translate(150,150)">
        <ellipse cx="-42" cy="66" rx="20" ry="15" fill="url(#pBody)" filter="url(#softsh)"/><ellipse cx="42" cy="66" rx="20" ry="15" fill="url(#pBody)" filter="url(#softsh)"/>
        <path d="M-52 6 L52 6 L44 70 Q0 84 -44 70 Z" fill="url(#pBody)" filter="url(#softsh)"/>
        <path d="M-52 8 Q-40 -8 -30 6 Q-16 -14 0 4 Q16 -14 30 6 Q40 -8 52 8 Q40 22 0 20 Q-40 22 -52 8 Z" fill="url(#pTop)" filter="url(#softsh)"/>
        <path d="M-30 6 l-3 12 M0 4 l0 14 M30 6 l3 12" stroke="#2a1a0e" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="-16" cy="30" rx="9" ry="8" fill="#2a1608" opacity="0.6"/><ellipse cx="16" cy="30" rx="9" ry="8" fill="#2a1608" opacity="0.6"/>
        <circle cx="-16" cy="30" r="10" fill="url(#redhalo)"/><circle cx="16" cy="30" r="10" fill="url(#redhalo)"/><circle cx="-16" cy="30" r="5" fill="url(#redglow)"/><circle cx="16" cy="30" r="5" fill="url(#redglow)"/>
        <ellipse cx="-16" cy="30" rx="1.4" ry="4" fill="#1a0603"/><ellipse cx="16" cy="30" rx="1.4" ry="4" fill="#1a0603"/>
        <path d="M-14 48 Q0 58 14 48" fill="none" stroke="#2a1a0e" stroke-width="2.5" stroke-linecap="round"/><path d="M-8 50 l-2 8 l4 -3 Z" fill="#f3efe6"/><path d="M8 50 l2 8 l-4 -3 Z" fill="#f3efe6"/><path d="M0 51 l-2 6 l4 0 Z" fill="#f3efe6"/>
      </g>`,
    },
    {
      name: "ネボスケ竜",
      drop: "ねぼけうろこ",
      parts: `<g transform="translate(150,150)">
        <ellipse cx="-46" cy="60" rx="20" ry="14" fill="url(#dBody)" filter="url(#softsh)"/><ellipse cx="46" cy="60" rx="20" ry="14" fill="url(#dBody)" filter="url(#softsh)"/>
        <g filter="url(#scale)"><path d="M-6 8 C-52 6 -64 30 -58 50 C-52 70 -24 76 4 74 C40 72 58 56 56 38 C54 20 34 10 -6 8 Z" fill="url(#dBody)"/></g>
        <ellipse cx="6" cy="52" rx="26" ry="20" fill="url(#dBelly)" opacity="0.85"/>
        <g fill="#2f5a3c"><path d="M-34 6 l-8 -16 l14 8 Z"/><path d="M-14 2 l-6 -18 l14 10 Z"/><path d="M8 2 l-4 -18 l14 12 Z"/></g>
        <g filter="url(#scale)"><ellipse cx="30" cy="24" rx="26" ry="21" fill="url(#dBody)" filter="url(#softsh)"/></g>
        <path d="M44 24 Q64 22 62 34 Q58 42 44 38 Z" fill="url(#dBody)"/><ellipse cx="60" cy="30" rx="2.5" ry="2" fill="#1e2f22"/>
        <path d="M20 6 Q14 -8 26 -4 Z" fill="#dfe6c8"/><path d="M38 6 Q34 -10 46 -2 Z" fill="#dfe6c8"/>
        <ellipse cx="26" cy="22" rx="8" ry="7" fill="#1e3327" opacity="0.6"/><circle cx="26" cy="22" r="9" fill="url(#eyehalo)"/><circle cx="26" cy="22" r="4.6" fill="url(#eyeglow)"/><ellipse cx="26" cy="22" rx="1.3" ry="4" fill="#140d02"/>
        <path d="M48 38 l-1 7 l4 -4 Z" fill="#f3efe6"/><path d="M40 40 l-1 6 l3 -3 Z" fill="#f3efe6"/>
      </g>`,
    },
    {
      name: "オニギリガニ",
      drop: "こめつぶ",
      parts: `<g transform="translate(150,150)">
        <g stroke="#7e2018" stroke-width="5" stroke-linecap="round" fill="none"><path d="M-30 60 Q-46 66 -52 78"/><path d="M-24 66 Q-38 74 -42 86"/><path d="M30 60 Q46 66 52 78"/><path d="M24 66 Q38 74 42 86"/></g>
        <path d="M-44 40 Q-64 34 -60 20 Q-52 12 -46 24 Q-40 16 -36 28 Z" fill="url(#oShell)" filter="url(#softsh)"/><path d="M44 40 Q64 34 60 20 Q52 12 46 24 Q40 16 36 28 Z" fill="url(#oShell)" filter="url(#softsh)"/>
        <path d="M-40 44 Q-30 30 -18 40 Z" fill="url(#oShell)" opacity="0.9"/><path d="M40 44 Q30 30 18 40 Z" fill="url(#oShell)" opacity="0.9"/>
        <path d="M0 -40 Q-34 -34 -40 48 Q0 60 40 48 Q34 -34 0 -40 Z" fill="url(#oBody)" filter="url(#softsh)"/>
        <path d="M-30 20 L30 20 L24 52 Q0 60 -24 52 Z" fill="#22301f"/>
        <ellipse cx="-14" cy="2" rx="9" ry="8" fill="#34302a" opacity="0.5"/><ellipse cx="14" cy="2" rx="9" ry="8" fill="#34302a" opacity="0.5"/>
        <circle cx="-14" cy="2" r="9" fill="url(#eyehalo)"/><circle cx="14" cy="2" r="9" fill="url(#eyehalo)"/><circle cx="-14" cy="2" r="4.6" fill="url(#eyeglow)"/><circle cx="14" cy="2" r="4.6" fill="url(#eyeglow)"/>
        <ellipse cx="-14" cy="2" rx="1.3" ry="3.8" fill="#140d02"/><ellipse cx="14" cy="2" rx="1.3" ry="3.8" fill="#140d02"/>
        <path d="M-10 30 Q0 38 10 30" fill="none" stroke="#141a12" stroke-width="2.4" stroke-linecap="round"/><path d="M-5 32 l-2 7 l4 -3 Z" fill="#f3efe6"/><path d="M5 32 l2 7 l-4 -3 Z" fill="#f3efe6"/>
      </g>`,
    },
  ];

  window.ART = { MONSTER_DEFS, FOREST_BG, MONSTERS };
})();
