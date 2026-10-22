// =====================================================================
//  КАРТИНКИ СЦЕН — рисуются кодом (SVG), файлов-картинок нет.
//  В story.js у сцены пишется art: "имя", где имя — ключ из ART ниже.
// =====================================================================

const ART = (() => {
  const W = 360, H = 180;
  const DARK = "#050403";

  // предсказуемый «случайный» генератор, чтобы картинка не менялась
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DEFS = `
    <radialGradient id="gY"><stop offset="0" stop-color="#ffd98a" stop-opacity=".85"/><stop offset="1" stop-color="#d9a441" stop-opacity="0"/></radialGradient>
    <radialGradient id="gR"><stop offset="0" stop-color="#ff6a50" stop-opacity=".9"/><stop offset="1" stop-color="#c8473a" stop-opacity="0"/></radialGradient>
    <radialGradient id="gG"><stop offset="0" stop-color="#d4ff8a" stop-opacity=".9"/><stop offset="1" stop-color="#7fa65a" stop-opacity="0"/></radialGradient>
    <radialGradient id="gW"><stop offset="0" stop-color="#fff4dd" stop-opacity=".95"/><stop offset="1" stop-color="#ffe0a0" stop-opacity="0"/></radialGradient>
    <radialGradient id="gB"><stop offset="0" stop-color="#9fd0e0" stop-opacity=".6"/><stop offset="1" stop-color="#4a7a8a" stop-opacity="0"/></radialGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2a24"/><stop offset="1" stop-color="#6e5d44"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a2c"/><stop offset="1" stop-color="#0a1112"/></linearGradient>
    <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#14110d" stop-opacity="0"/><stop offset="1" stop-color="#14110d" stop-opacity=".95"/></linearGradient>`;

  const wrap = (body, bg = "#0d0b08") =>
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}` +
    `<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;

  // ---------- кирпичики ----------
  const flicker = (dur) =>
    `<animate attributeName="opacity" values="1;.7;.95;.75;1" dur="${dur}s" repeatCount="indefinite"/>`;

  const glow = (x, y, r, g = "gY", dur = 0, op = 1) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})" opacity="${op}">${dur ? flicker(dur) : ""}</circle>`;

  const tint = (color, op) => `<rect width="${W}" height="${H}" fill="${color}" opacity="${op}"/>`;

  function tunnel() {
    const cols = ["#221c15", "#1a1510", "#13100c", "#0c0a07", "#060504"];
    let s = "";
    cols.forEach((c, i) => {
      const hw = 190 - i * 34, wall = 70 + i * 10, apex = 2 + i * 22;
      s += `<path d="M${180 - hw},${H} L${180 - hw},${wall} Q180,${2 * apex - wall} ${180 + hw},${wall} L${180 + hw},${H}Z" fill="${c}" stroke="#2a2219" stroke-width="1.5"/>`;
    });
    s += `<path d="M0,${H} L130,124 L230,124 L${W},${H}Z" fill="#100d0a"/>`;
    for (let k = 0; k <= 7; k++) {
      const t = Math.pow(k / 7, 1.8), y = 124 + 56 * t;
      const xl = 170 - 60 * t, xr = 190 + 60 * t;
      s += `<line x1="${xl - 8 * t - 2}" y1="${y}" x2="${xr + 8 * t + 2}" y2="${y}" stroke="#2e261d" stroke-width="${1 + 3 * t}"/>`;
    }
    s += `<g stroke="#5a4a38" stroke-width="2"><line x1="110" y1="${H}" x2="170" y2="124"/><line x1="250" y1="${H}" x2="190" y2="124"/></g>`;
    return s;
  }

  function figure(x, y, h, c = DARK) {
    const r = h * 0.1;
    return `<g fill="${c}"><circle cx="${x}" cy="${y - h + r}" r="${r}"/>` +
      `<path d="M${x - h * 0.17},${y - h * 0.72} Q${x},${y - h * 0.8} ${x + h * 0.17},${y - h * 0.72} ` +
      `L${x + h * 0.13},${y - h * 0.36} L${x + h * 0.11},${y} L${x + h * 0.03},${y} L${x},${y - h * 0.32} ` +
      `L${x - h * 0.03},${y} L${x - h * 0.11},${y} L${x - h * 0.13},${y - h * 0.36}Z"/></g>`;
  }

  function robe(x, y, h, c = DARK) {
    const r = h * 0.12;
    return `<g fill="${c}"><path d="M${x - h * 0.26},${y} Q${x - h * 0.2},${y - h * 0.6} ${x - r},${y - h + r * 1.4} ` +
      `Q${x},${y - h - r * 0.4} ${x + r},${y - h + r * 1.4} Q${x + h * 0.2},${y - h * 0.6} ${x + h * 0.26},${y}Z"/>` +
      `<ellipse cx="${x}" cy="${y - h + r * 1.6}" rx="${r * 0.55}" ry="${r * 0.7}" fill="#000"/></g>`;
  }

  function eyes(x, y, s = 1, g = "gR", col = "#ff7060", blink = 0) {
    const anim = blink
      ? `<animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.9;.95;1" dur="${blink}s" repeatCount="indefinite"/>`
      : "";
    return `<g>${anim}${glow(x, y, 9 * s, g, 0, 0.8)}` +
      `<circle cx="${x - 2.6 * s}" cy="${y}" r="${1.3 * s}" fill="${col}"/><circle cx="${x + 2.6 * s}" cy="${y}" r="${1.3 * s}" fill="${col}"/></g>`;
  }

  function ash(n, seed = 1, color = "#bfb5a0") {
    const r = rng(seed);
    let s = "";
    for (let i = 0; i < n; i++) {
      const x = (r() * W).toFixed(1), d = (4 + r() * 6).toFixed(1), b = (-r() * 10).toFixed(1), sz = (0.6 + r() * 1.3).toFixed(1);
      s += `<circle cx="${x}" cy="-5" r="${sz}" fill="${color}" opacity=".55">` +
        `<animate attributeName="cy" from="-5" to="${H + 5}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></circle>`;
    }
    return s;
  }

  function drips(seed = 2, n = 4) {
    const r = rng(seed);
    let s = "";
    for (let i = 0; i < n; i++) {
      const x = (60 + r() * 240).toFixed(0), y0 = (20 + r() * 40).toFixed(0), d = (1.5 + r() * 2).toFixed(1), b = (-r() * 3).toFixed(1);
      s += `<rect x="${x}" y="${y0}" width="1.2" height="4" fill="#7fa0a8" opacity=".6">` +
        `<animate attributeName="y" from="${y0}" to="${H}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></rect>`;
    }
    return s;
  }

  function skyline(seed, color, base, maxH) {
    const r = rng(seed);
    let s = "", x = -10;
    while (x < W) {
      const w = 20 + r() * 40, h = 30 + r() * maxH, top = base - h, j1 = r() * 12, j2 = r() * 16;
      s += `<path d="M${x},${H} L${x},${top + j1} L${x + w * 0.3},${top} L${x + w * 0.55},${top + j2} L${x + w * 0.8},${top + 4} L${x + w},${top + j1 * 1.5} L${x + w},${H}Z" fill="${color}"/>`;
      for (let wy = top + 14; wy < base - 8; wy += 12)
        for (let wx = x + 5; wx < x + w - 6; wx += 9)
          if (r() < 0.35) s += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="6" fill="#0a0806" opacity=".8"/>`;
      x += w + r() * 6;
    }
    return s;
  }

  function fire(x, y, s = 1) {
    return glow(x, y - 8 * s, 45 * s, "gY", 1.3) +
      `<g transform="translate(${x},${y}) scale(${s})">` +
      `<path d="M-9,0 Q-11,-13 -2,-24 Q0,-13 4,-17 Q11,-9 9,0Z" fill="#e0782f">` +
      `<animateTransform attributeName="transform" type="scale" values="1 1;1.05 1.18;.95 .92;1 1" dur=".7s" repeatCount="indefinite"/></path>` +
      `<path d="M-4,0 Q-5,-8 0,-14 Q4,-7 4,0Z" fill="#ffd27a"/>` +
      `<path d="M-14,1 L14,1" stroke="#3a2a1a" stroke-width="3"/></g>`;
  }

  function candle(x, y, s = 1) {
    return glow(x, y - 6 * s, 14 * s, "gY", 0.9 + (x % 7) / 10) +
      `<rect x="${x - 1.5 * s}" y="${y - 5 * s}" width="${3 * s}" height="${6 * s}" fill="#d8c9a8"/>` +
      `<ellipse cx="${x}" cy="${y - 7 * s}" rx="${1.2 * s}" ry="${2.2 * s}" fill="#ffd27a"/>`;
  }

  function stationWall(base = "#1d1812") {
    let s = `<rect width="${W}" height="${H}" fill="${base}"/>`;
    for (let i = 0; i < 4; i++) {
      const cx = 45 + i * 90;
      s += `<path d="M${cx - 32},150 L${cx - 32},72 Q${cx},28 ${cx + 32},72 L${cx + 32},150Z" fill="#0c0a07"/>`;
    }
    s += `<rect y="150" width="${W}" height="30" fill="#120f0b"/>`;
    return s;
  }

  function lights(seed = 5) {
    const r = rng(seed);
    let s = `<path d="M0,28 Q90,52 180,30 Q270,52 360,28" stroke="#2a2219" fill="none"/>`;
    for (let i = 0; i < 14; i++) {
      const t = i / 13, x = t * 360;
      const y = 28 + 12 * Math.abs(Math.sin(t * Math.PI * 2));
      s += glow(x.toFixed(0), y.toFixed(0), 7, "gY", (1 + r() * 2).toFixed(1));
    }
    return s;
  }

  function robot(x, y, s = 1) {
    const g = (d) => `transform="translate(${x},${y}) scale(${s})"`;
    return `<g ${g()}>` +
      `<rect x="-22" y="-30" width="12" height="30" fill="#1f1b16" stroke="#3a3026"/>` +
      `<rect x="10" y="-30" width="12" height="30" fill="#1f1b16" stroke="#3a3026"/>` +
      `<rect x="-30" y="-82" width="60" height="54" rx="5" fill="#2f2a24" stroke="#4a4034" stroke-width="2"/>` +
      `<rect x="-20" y="-70" width="40" height="8" fill="#1a1612"/><rect x="-20" y="-56" width="40" height="3" fill="#1a1612"/>` +
      `<rect x="-46" y="-78" width="14" height="40" rx="3" fill="#26211b" stroke="#3a3026"/>` +
      `<rect x="32" y="-78" width="14" height="40" rx="3" fill="#26211b" stroke="#3a3026"/>` +
      `<path d="M-46,-38 l-4,10 M-34,-38 l4,10 M34,-38 l-4,10 M46,-38 l4,10" stroke="#5a4a38" stroke-width="3"/>` +
      `<rect x="-18" y="-108" width="36" height="24" rx="4" fill="#2f2a24" stroke="#4a4034" stroke-width="2"/>` +
      `<line x1="10" y1="-108" x2="14" y2="-122" stroke="#5a4a38" stroke-width="2"/>` +
      `<circle cx="14" cy="-123" r="2.5" fill="#c8473a">${flicker(0.8)}</circle>` +
      `${glow(0, -96, 22, "gR")}<circle cx="0" cy="-96" r="5" fill="#ff5a45">` +
      `<animate attributeName="r" values="4;6;4" dur="1.6s" repeatCount="indefinite"/></circle></g>`;
  }

  function cartridges(cx, cy, n, seed = 9) {
    const r = rng(seed);
    let s = "";
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI, rad = r() * 55;
      const x = cx + Math.cos(a) * rad * 1.4 - 0, y = cy - Math.sin(a) * rad * 0.45;
      const rot = (r() * 180).toFixed(0);
      s += `<g transform="translate(${x.toFixed(0)},${y.toFixed(0)}) rotate(${rot})"><rect x="-2.5" y="-7" width="5" height="11" rx="1" fill="#d9a441"/><rect x="-2.5" y="-9" width="5" height="3" rx="2" fill="#8a6a3a"/></g>`;
    }
    return s;
  }

  function medcase(x, y, s = 1, open = false) {
    return `<g transform="translate(${x},${y}) scale(${s})">` +
      `<rect x="-30" y="-20" width="60" height="38" rx="4" fill="#4a4a3e" stroke="#2a2a22" stroke-width="2"/>` +
      `<path d="M-10,-20 L-10,-27 L10,-27 L10,-20" fill="none" stroke="#2a2a22" stroke-width="3"/>` +
      (open
        ? `<rect x="-30" y="-48" width="60" height="26" rx="4" fill="#3a3a30" stroke="#2a2a22" stroke-width="2" transform="skewX(-12)"/><rect x="-26" y="-16" width="52" height="30" fill="#14110d"/>`
        : `<rect x="-4" y="-12" width="8" height="22" fill="#c8473a"/><rect x="-11" y="-5" width="22" height="8" fill="#c8473a"/>`) +
      `</g>`;
  }

  // ---------- картинки сцен ----------
  return {
    train: () => wrap(
      tunnel() +
      `<polygon points="150,140 210,140 300,180 60,180" fill="#ffe0a0" opacity=".12">${flicker(2.5)}</polygon>` +
      `<path d="M138,150 L138,82 Q138,64 156,62 L204,62 Q222,64 222,82 L222,150Z" fill="#1c1712" stroke="#3a3026" stroke-width="2"/>` +
      `<rect x="146" y="74" width="30" height="26" rx="3" fill="#0a0806"/><rect x="184" y="74" width="30" height="26" rx="3" fill="#0a0806"/>` +
      `<rect x="160" y="64" width="40" height="8" fill="#d9a441" opacity=".85"/>` +
      `<rect x="150" y="128" width="60" height="6" fill="#2a2219"/>` +
      glow(156, 138, 26, "gW", 2.2) + glow(204, 138, 26, "gW", 2.6) +
      `<circle cx="156" cy="138" r="4" fill="#fff4dd"/><circle cx="204" cy="138" r="4" fill="#fff4dd"/>`
    ),

    bunker: () => wrap(
      `<rect y="12" width="${W}" height="7" fill="#2a2219"/><rect y="24" width="${W}" height="4" fill="#241d16"/>` +
      `<g transform="translate(260,98)"><circle r="64" fill="#2b241b" stroke="#3a3026" stroke-width="6"/>` +
      `<circle r="47" fill="#231d16" stroke="#3a3026" stroke-width="3"/>` +
      [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="${(Math.cos(a * Math.PI / 180) * 55).toFixed(1)}" cy="${(Math.sin(a * Math.PI / 180) * 55).toFixed(1)}" r="3" fill="#5a4a38"/>`).join("") +
      `<circle r="16" fill="none" stroke="#5a4a38" stroke-width="4"/><path d="M-16,0 H16 M0,-16 V16" stroke="#5a4a38" stroke-width="3"/></g>` +
      `<rect x="20" y="140" width="80" height="12" fill="#2a2219"/><rect x="24" y="152" width="4" height="20" fill="#2a2219"/><rect x="92" y="152" width="4" height="20" fill="#2a2219"/>` +
      `<line x1="120" y1="0" x2="120" y2="38" stroke="#3a3026" stroke-width="2"/><rect x="113" y="38" width="14" height="7" fill="#3a3026"/>` +
      glow(120, 50, 80, "gY", 3) +
      figure(150, 172, 86) + `<line x1="168" y1="110" x2="174" y2="172" stroke="${DARK}" stroke-width="3"/>`,
      "#1c1712"
    ),

    tunnel: () => wrap(tunnel() + glow(180, 112, 22, "gY", 4, 0.6) + drips(3)),

    rats: () => {
      const r = rng(11);
      let s = tunnel();
      for (let i = 0; i < 16; i++) {
        const x = 70 + r() * 220, y = 118 + r() * 50, sc = 0.5 + (y - 118) / 60;
        s += `<ellipse cx="${x.toFixed(0)}" cy="${(y + 5 * sc).toFixed(0)}" rx="${(12 * sc).toFixed(1)}" ry="${(6 * sc).toFixed(1)}" fill="${DARK}"/>`;
        s += eyes(x.toFixed(0), y.toFixed(0), sc, "gR", "#ff7060", (2 + r() * 3).toFixed(1));
      }
      return wrap(s + tint("#c8473a", 0.06));
    },

    market: () => wrap(
      stationWall() + lights() +
      `<path d="M20,150 L50,108 L80,150Z" fill="#2a2219"/><path d="M250,150 L292,100 L334,150Z" fill="#241d16"/>` +
      fire(120, 162, 1.1) + fire(300, 164, 0.9) +
      figure(80, 172, 60) + figure(150, 170, 54) + figure(200, 174, 66) + figure(250, 172, 58) + figure(330, 175, 62)
    ),

    shop: () => wrap(
      `<rect width="${W}" height="${H}" fill="#1d1812"/>` +
      [40, 70, 100].map((y) => `<rect x="20" y="${y}" width="320" height="3" fill="#3a3026"/>`).join("") +
      [[40, 36], [110, 36], [200, 36], [60, 66], [160, 66], [250, 66]].map(([x, y]) =>
        `<path d="M${x},${y} h50 v-4 h-30 l-6,-4 h-8 l-6,4 h-0 Z" fill="#0a0806"/>`).join("") +
      [[290, 96], [310, 96], [270, 96]].map(([x, y]) => `<rect x="${x}" y="${y - 14}" width="12" height="14" fill="#3a3530"/>`).join("") +
      figure(180, 150, 90) +
      `<rect y="118" width="${W}" height="62" fill="#2a2219"/><rect y="116" width="${W}" height="4" fill="#5a4a38"/>` +
      `<rect x="60" y="104" width="30" height="14" fill="#4a3a2a"/>` + medcase(250, 104, 0.45) +
      glow(180, 20, 90, "gY", 3, 0.9)
    ),

    sam: () => wrap(
      stationWall("#17130e") + glow(60, 140, 50, "gY", 1.3, 0.6) + glow(300, 145, 40, "gY", 1.7, 0.5) +
      figure(180, 215, 195, "#080605") +
      `<rect x="146" y="10" width="68" height="6" rx="2" fill="#080605"/><rect x="160" y="-10" width="40" height="22" rx="4" fill="#080605"/>` +
      glow(188, 46, 10, "gY", 1.2) + `<rect x="186" y="44" width="4" height="4" fill="#ffd27a"/>` +
      `<line x1="250" y1="90" x2="262" y2="${H}" stroke="#080605" stroke-width="5"/>`
    ),

    lisa: () => wrap(
      stationWall("#17130e") + fire(70, 165, 0.8) +
      `<rect x="215" y="0" width="34" height="${H}" fill="#2a2219"/><rect x="211" y="0" width="42" height="10" fill="#3a3026"/>` +
      figure(196, 175, 120) +
      `<line x1="182" y1="80" x2="240" y2="6" stroke="${DARK}" stroke-width="4"/><rect x="214" y="22" width="16" height="5" fill="${DARK}" transform="rotate(-52 222 24)"/>` +
      `<path d="M184,71 Q196,78 208,71 L210,78 Q196,86 182,78Z" fill="#c8473a"/><path d="M206,76 L214,100 L206,98Z" fill="#c8473a"/>`
    ),

    marfa: () => wrap(
      stationWall("#17130e") + candle(222, 150, 2.2) + robe(160, 172, 100, "#0a0806") +
      `<rect x="200" y="150" width="50" height="4" fill="#2a2219"/>`
    ),

    gosha: () => {
      let sparks = "";
      const r = rng(4);
      for (let i = 0; i < 6; i++) {
        const x = 250 + r() * 40, y = 70 + r() * 20, d = (0.3 + r() * 0.8).toFixed(2);
        sparks += `<line x1="${x}" y1="${y}" x2="${x + (r() - 0.5) * 20}" y2="${y - r() * 16}" stroke="#ffd27a" stroke-width="1.5">` +
          `<animate attributeName="opacity" values="0;1;0;0" dur="${d}s" repeatCount="indefinite"/></line>`;
      }
      return wrap(
        `<rect width="${W}" height="${H}" fill="#1a1611"/>` +
        `<path d="M0,20 Q180,40 360,20" stroke="#2a2219" stroke-width="2" fill="none"/>` +
        [60, 140, 220, 300].map((x, i) => glow(x, 28 + (i % 2) * 6, 14, "gY", 0.5 + i * 0.3, 0.7)).join("") +
        `<rect x="200" y="78" width="130" height="80" rx="4" fill="#2a2219" stroke="#3a3026" stroke-width="2"/>` +
        [92, 102, 112, 122].map((y) => `<rect x="212" y="${y}" width="50" height="4" fill="#14110d"/>`).join("") +
        `<circle cx="300" cy="110" r="14" fill="#14110d" stroke="#5a4a38" stroke-width="3"/>` +
        `<circle cx="314" cy="92" r="3" fill="#c8473a">${flicker(0.4)}</circle>` + sparks + glow(270, 80, 30, "gY", 0.3, 0.5) +
        `<rect y="158" width="${W}" height="22" fill="#120f0b"/>` +
        figure(130, 172, 96) + `<path d="M150,110 L176,96 L180,100 L172,104" stroke="${DARK}" stroke-width="4" fill="none"/>`
      );
    },

    fork: () => wrap(
      `<rect width="${W}" height="${H}" fill="#1a1611"/>` +
      [[70, "#0a0806"], [180, "#0c0907"], [290, "#081012"]].map(([cx, c]) =>
        `<path d="M${cx - 40},160 L${cx - 40},80 Q${cx},34 ${cx + 40},80 L${cx + 40},160Z" fill="${c}" stroke="#2a2219" stroke-width="3"/>`).join("") +
      [0, 1, 2, 3, 4, 5].map((i) => `<line x1="${44 + i * 2}" y1="${150 - i * 13}" x2="${96 - i * 2}" y2="${150 - i * 13}" stroke="#3a3026" stroke-width="2"/>`).join("") +
      glow(70, 60, 30, "gW", 0, 0.35) +
      candle(170, 140, 1.3) + candle(186, 136, 1) + candle(196, 142, 1.1) +
      [0, 1, 2].map((i) => `<line x1="${265 + i * 6}" y1="${140 + i * 5}" x2="${300 + i * 8}" y2="${140 + i * 5}" stroke="#3a6070" opacity=".5"><animate attributeName="x1" values="${265 + i * 6};${272 + i * 6};${265 + i * 6}" dur="${2 + i}s" repeatCount="indefinite"/></line>`).join("") +
      `<g font-family="PT Mono, monospace" font-size="9" fill="#9a8b74" text-anchor="middle">` +
      `<text x="70" y="30">↑ ВЫХОД</text><text x="180" y="30">«ТИХАЯ»</text><text x="290" y="30">ТОННЕЛЬ 2 →</text></g>` +
      `<rect y="160" width="${W}" height="20" fill="#120f0b"/>`
    ),

    surface: () => wrap(
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + glow(270, 50, 60, "gW", 0, 0.25) +
      `<circle cx="270" cy="50" r="16" fill="#cbb98f" opacity=".5"/>` +
      skyline(3, "#3a332a", 150, 70) + skyline(7, "#1a1612", 168, 100) +
      `<rect y="166" width="${W}" height="14" fill="#15120e"/>` + ash(45, 5)
    ),

    ruins: () => wrap(
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + skyline(13, "#3a332a", 140, 60) +
      `<rect y="150" width="${W}" height="30" fill="#1d1914"/>` +
      `<g transform="rotate(-5 220 140)"><rect x="140" y="112" width="160" height="42" rx="6" fill="#3b3226" stroke="#241d16" stroke-width="2"/>` +
      [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${150 + i * 24}" y="120" width="16" height="12" fill="#14110d"/>`).join("") +
      `<circle cx="170" cy="110" r="10" fill="#14110d"/><circle cx="270" cy="110" r="10" fill="#14110d"/></g>` +
      `<path d="M20,160 L30,138 L80,136 L96,152 L96,162Z" fill="#2a241c"/>` +
      fire(120, 162, 0.5) + ash(40, 8)
    ),

    flooded: () => wrap(
      tunnel() + glow(180, 104, 26, "gY", 3, 0.7) +
      `<rect y="128" width="${W}" height="52" fill="url(#water)" opacity=".92"/>` +
      `<ellipse cx="180" cy="140" rx="10" ry="22" fill="url(#gY)" opacity=".35"/>` +
      [136, 146, 158, 172].map((y, i) => `<line x1="${120 - i * 20}" y1="${y}" x2="${240 + i * 20}" y2="${y}" stroke="#3a6070" opacity=".35"><animate attributeName="x1" values="${120 - i * 20};${130 - i * 20};${120 - i * 20}" dur="${2 + i * 0.7}s" repeatCount="indefinite"/></line>`).join("") +
      drips(6, 6)
    ),

    marauders: () => wrap(
      tunnel() + `<rect y="128" width="${W}" height="52" fill="url(#water)" opacity=".92"/>` +
      fire(250, 112, 0.6) +
      figure(120, 160, 78) + figure(180, 156, 88) + figure(245, 160, 76) +
      `<line x1="98" y1="160" x2="104" y2="72" stroke="${DARK}" stroke-width="3"/><path d="M101,72 l3,-12 l3,12Z" fill="#5a4a38"/>` +
      `<line x1="206" y1="156" x2="214" y2="56" stroke="${DARK}" stroke-width="3"/><path d="M211,56 l3,-12 l3,12Z" fill="#5a4a38"/>` +
      tint("#c8473a", 0.05)
    ),

    tihaya: () => {
      const r = rng(21);
      let s = `<rect width="${W}" height="${H}" fill="#120e0a"/>` +
        `<ellipse cx="180" cy="58" rx="56" ry="24" fill="none" stroke="#6b2a22" stroke-width="4"/>` +
        `<circle cx="180" cy="58" r="13" fill="#6b2a22"/><circle cx="180" cy="58" r="5" fill="#120e0a"/>` +
        `<path d="M150,80 v14 M172,82 v20 M200,81 v10" stroke="#6b2a22" stroke-width="2"/>` + glow(180, 58, 70, "gR", 4, 0.15);
      for (let i = 0; i < 22; i++) s += candle((15 + r() * 330).toFixed(0), (128 + r() * 10).toFixed(0), 0.8 + r() * 0.5);
      for (let i = 0; i < 7; i++) s += robe(30 + i * 50, 156, 44, "#0a0806");
      for (let i = 0; i < 6; i++) s += robe(55 + i * 50, 182, 52, DARK);
      return wrap(s);
    },

    tihaya_empty: () => {
      const r = rng(22);
      let s = `<rect width="${W}" height="${H}" fill="#120e0a"/>` +
        `<ellipse cx="180" cy="58" rx="56" ry="24" fill="none" stroke="#6b2a22" stroke-width="4"/>` +
        `<circle cx="180" cy="58" r="13" fill="#6b2a22"/><circle cx="180" cy="58" r="5" fill="#120e0a"/>`;
      for (let i = 0; i < 6; i++) s += candle((15 + r() * 330).toFixed(0), (140 + r() * 20).toFixed(0), 0.9);
      s += `<rect x="80" y="160" width="60" height="6" fill="#2a2219" transform="rotate(12 110 163)"/>`;
      return wrap(s);
    },

    sect: () => wrap(
      `<rect width="${W}" height="${H}" fill="#120e0a"/>` +
      `<ellipse cx="180" cy="50" rx="56" ry="24" fill="none" stroke="#8a2a22" stroke-width="4"/><circle cx="180" cy="50" r="13" fill="#8a2a22"/>` +
      glow(180, 50, 90, "gR", 1.5, 0.3) +
      robe(90, 182, 120) + robe(180, 186, 140) + robe(270, 182, 120) +
      `<line x1="120" y1="120" x2="134" y2="100" stroke="#5a4a38" stroke-width="3"/>` +
      `<line x1="240" y1="122" x2="226" y2="102" stroke="#5a4a38" stroke-width="3"/>` +
      tint("#c8473a", 0.08)
    ),

    petka: () => wrap(
      `<rect width="${W}" height="${H}" fill="#120e0a"/>` +
      `<g opacity=".35">${robe(240, 170, 160, "#000")}</g>` +
      candle(200, 160, 1.8) +
      `<circle cx="150" cy="118" r="10" fill="${DARK}"/><path d="M134,168 Q132,128 150,126 Q168,128 166,168Z" fill="${DARK}"/>` +
      `<ellipse cx="150" cy="168" rx="24" ry="5" fill="${DARK}"/>`
    ),

    blockpost: () => wrap(
      tunnel() +
      `<rect x="222" y="66" width="76" height="86" fill="#2a241c" stroke="#3a3026" stroke-width="2"/>` +
      `<rect x="232" y="80" width="56" height="26" fill="#0e0c09"/>` +
      `<rect x="226" y="50" width="68" height="14" fill="#1b2633"/>` +
      `<text x="260" y="61" font-family="PT Mono, monospace" font-size="10" fill="#8aa0b8" text-anchor="middle">ПОЛИЦИЯ</text>` +
      `<rect x="244" y="118" width="32" height="30" fill="#3a3530" stroke="#1a1612"/><circle cx="260" cy="133" r="6" fill="none" stroke="#9a8b74" stroke-width="2"/>` +
      `<line x1="70" y1="160" x2="70" y2="70" stroke="#3a3026" stroke-width="4"/><circle cx="70" cy="66" r="10" fill="#2a241c" stroke="#5a4a38" stroke-width="2"/>` +
      [0, 1, 2].map((row) => [0, 1, 2, 3 - row].map((i) => `<rect x="${20 + i * 30 + row * 15}" y="${160 - row * 12}" width="30" height="14" rx="6" fill="#4a3f30" stroke="#2a2219"/>`).join("")).join("") +
      [0, 1].map((row) => [0, 1, 2].map((i) => `<rect x="${110 + i * 30 + row * 15}" y="${166 - row * 12}" width="30" height="14" rx="6" fill="#4a3f30" stroke="#2a2219"/>`).join("")).join("") +
      eyes(180, 108, 0.6, "gG", "#c6ff7a", 5)
    ),

    hunter: () => wrap(
      tunnel() + glow(190, 110, 110, "gG", 3, 0.18) +
      `<path d="M128,${H} Q118,118 160,92 Q200,72 232,98 Q252,122 244,${H}Z" fill="${DARK}" stroke="#2a3020" stroke-width="1.5"/>` +
      `<ellipse cx="158" cy="104" rx="20" ry="15" fill="${DARK}" stroke="#2a3020" stroke-width="1.5"/>` +
      `<path d="M150,112 Q112,140 102,176" stroke="${DARK}" stroke-width="9" stroke-linecap="round" fill="none"/>` +
      `<path d="M232,112 Q268,145 272,176" stroke="${DARK}" stroke-width="9" stroke-linecap="round" fill="none"/>` +
      `<path d="M96,176 l-6,4 M102,178 l0,6 M108,176 l6,4 M266,176 l-6,4 M272,178 l0,6 M278,176 l6,4" stroke="#2a3020" stroke-width="2"/>` +
      eyes(156, 102, 1.2, "gG", "#c6ff7a", 4) +
      `<path d="M146,112 l4,6 l4,-6 l4,6 l4,-6" stroke="#9a8b74" stroke-width="1.2" fill="none"/>`
    ),

    gate: () => wrap(
      `<rect width="${W}" height="${H}" fill="#1a1611"/>` +
      `<text x="180" y="26" font-family="PT Mono, monospace" font-size="13" letter-spacing="3" fill="#5a4a38" text-anchor="middle">БОТАНИЧЕСКАЯ</text>` +
      `<rect x="110" y="40" width="140" height="120" fill="#0a0806" stroke="#3a3026" stroke-width="4"/>` +
      `<rect x="30" y="70" width="44" height="56" fill="#2a2219" stroke="#3a3026" stroke-width="2"/>` +
      [80, 92, 104].map((y) => `<rect x="38" y="${y}" width="28" height="6" fill="#14110d"/>`).join("") +
      `<circle cx="66" cy="118" r="2.5" fill="#7fa65a">${flicker(1)}</circle>` +
      robot(180, 160, 1) + `<rect y="160" width="${W}" height="20" fill="#120f0b"/>`
    ),

    robot: () => wrap(
      `<rect width="${W}" height="${H}" fill="#120f0b"/>` + glow(180, 70, 140, "gR", 2, 0.25) +
      `<polygon points="180,50 60,180 300,180" fill="#ff5a45" opacity=".08"><animate attributeName="opacity" values=".02;.12;.02" dur="1.6s" repeatCount="indefinite"/></polygon>` +
      robot(180, 200, 1.5)
    ),

    medbay: () => wrap(
      `<rect width="${W}" height="${H}" fill="#1e1d1a"/>` +
      `<rect x="100" y="8" width="160" height="6" fill="#d8e0d0" opacity=".7">${flicker(0.35)}</rect>` + glow(180, 12, 120, "gW", 0.35, 0.25) +
      `<rect x="20" y="40" width="70" height="110" fill="#2a2a24" stroke="#3a3a30" stroke-width="2"/>` +
      [60, 90, 120].map((y) => `<rect x="26" y="${y}" width="58" height="2" fill="#3a3a30"/>`).join("") +
      `<rect x="34" y="50" width="8" height="10" fill="#5a6a5a"/><rect x="50" y="80" width="6" height="10" fill="#6a5a4a"/>` +
      `<rect x="280" y="40" width="60" height="110" fill="#2a2a24" stroke="#3a3a30" stroke-width="2"/>` +
      `<rect x="300" y="60" width="20" height="6" fill="#c8473a"/><rect x="307" y="53" width="6" height="20" fill="#c8473a"/>` +
      `<rect x="110" y="140" width="140" height="8" fill="#3a3a30"/><rect x="120" y="148" width="6" height="32" fill="#3a3a30"/><rect x="234" y="148" width="6" height="32" fill="#3a3a30"/>` +
      glow(180, 122, 40, "gR", 1.8, 0.5) + medcase(180, 120, 0.9)
    ),

    thugs: () => wrap(
      stationWall("#17130e") + glow(180, 120, 60, "gY", 1.4, 0.4) +
      figure(180, 150, 70, "#0a0806") + glow(184, 92, 5, "gY", 1) +
      figure(95, 192, 170) + figure(265, 192, 175) +
      tint("#c8473a", 0.07)
    ),

    home: () => wrap(
      `<rect width="${W}" height="${H}" fill="#1c1712"/>` +
      glow(220, 100, 130, "gW", 4, 0.8) +
      `<circle cx="220" cy="98" r="58" fill="#ffe7b8" opacity=".55"/>` +
      `<ellipse cx="300" cy="98" rx="18" ry="64" fill="#2b241b" stroke="#3a3026" stroke-width="4"/>` +
      figure(200, 158, 80) + figure(238, 158, 46) + figure(256, 158, 40) + figure(176, 158, 50) +
      figure(90, 178, 94) + `<rect x="0" y="158" width="${W}" height="22" fill="#14110d" opacity=".7"/>`
    ),

    trick: () => wrap(
      stationWall("#17130e") + glow(180, 120, 90, "gY", 2, 0.4) +
      medcase(120, 128, 1.3, true) + cartridges(250, 150, 40) +
      `<text x="120" y="70" font-family="PT Mono, monospace" font-size="30" fill="#d9a441" text-anchor="middle">?</text>`
    ),

    rich: () => wrap(
      tunnel() + glow(180, 112, 18, "gY", 3, 0.5) + figure(180, 126, 28) +
      glow(110, 165, 60, "gY", 2, 0.35) + cartridges(110, 172, 60, 17) +
      `<path d="M262,180 L268,166 L292,166 L298,180Z" fill="#2a2219"/>`
    ),

    dead: () => wrap(
      tunnel() + tint("#000", 0.45) +
      `<polygon points="150,166 260,140 270,172" fill="#ffe0a0" opacity=".14"><animate attributeName="opacity" values=".16;.04;.14;0;.1" dur="4s" repeatCount="indefinite"/></polygon>` +
      `<rect x="134" y="162" width="20" height="8" rx="2" fill="#2a2219" transform="rotate(-12 144 166)"/>` +
      tint("#c8473a", 0.07)
    ),
  };
})();
