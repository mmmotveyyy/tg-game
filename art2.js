// =====================================================================
//  КАРТИНКИ ГЛАВЫ 2 (рисуются кодом, инструменты — из art.js)
// =====================================================================

(() => {
  const { W, H, DARK, rng, wrap, flicker, glow, tint, tunnel, figure, eyes, ash, drips, skyline, fire, stationWall, lights, robot } = ART.kit;

  // сутулая фигура упыря
  function hunch(x, y, s, c = "#3a3630") {
    return `<g transform="translate(${x},${y}) scale(${s})" fill="${c}">` +
      `<path d="M-14,0 Q-18,-30 -4,-44 Q10,-52 16,-36 Q20,-20 14,0Z"/>` +
      `<circle cx="-6" cy="-44" r="8"/>` +
      `<path d="M-8,-30 Q-22,-16 -24,0" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<circle cx="-9" cy="-45" r="1.4" fill="#e8f0d0"/><circle cx="-4" cy="-45" r="1.4" fill="#e8f0d0"/></g>`;
  }

  // вода с волной
  function water(y, color = "#1d2a2c", op = 0.88) {
    return `<path fill="${color}" opacity="${op}"><animate attributeName="d" dur="4s" repeatCount="indefinite" values="` +
      `M0,${y} Q90,${y - 4} 180,${y} T360,${y} L360,${H} L0,${H}Z;` +
      `M0,${y} Q90,${y + 4} 180,${y} T360,${y} L360,${H} L0,${H}Z;` +
      `M0,${y} Q90,${y - 4} 180,${y} T360,${y} L360,${H} L0,${H}Z"/></path>` +
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#4a7a8a" opacity=".3"/>`;
  }

  function wagon(x, y, w, h) {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#2a2420" stroke="#3a3026" stroke-width="2"/>`;
    for (let wx = x + 8; wx < x + w - 14; wx += 22) s += `<rect x="${wx}" y="${y + 8}" width="14" height="${h * 0.35}" fill="#0e0c09"/>`;
    s += `<circle cx="${x + 16}" cy="${y + h + 2}" r="5" fill="#14110d"/><circle cx="${x + w - 16}" cy="${y + h + 2}" r="5" fill="#14110d"/>`;
    return s;
  }

  Object.assign(ART, {
    flood: () => wrap(
      `<rect y="12" width="${W}" height="7" fill="#2a2219"/>` +
      `<g transform="translate(260,92)"><circle r="60" fill="#2b241b" stroke="#3a3026" stroke-width="6"/>` +
      `<circle r="44" fill="#231d16" stroke="#3a3026" stroke-width="3"/><circle r="15" fill="none" stroke="#5a4a38" stroke-width="4"/></g>` +
      `<path d="M120,14 L126,40 L118,62 L128,90" stroke="#0a0806" stroke-width="2" fill="none"/>` +
      `<line x1="70" y1="0" x2="70" y2="36" stroke="#3a3026" stroke-width="2"/>` + glow(70, 44, 70, "gY", 1.2, 0.8) +
      drips(8, 8) + figure(110, 150, 70) + figure(150, 152, 54) +
      water(132) + glow(70, 150, 30, "gY", 1.2, 0.25),
      "#1c1712"
    ),

    nest: () => {
      const r = rng(31);
      let s = stationWall("#161310");
      for (let i = 0; i < 14; i++) {
        const x = 15 + r() * 330, len = 10 + r() * 40;
        s += `<line x1="${x}" y1="0" x2="${x}" y2="${len}" stroke="#bfb5a0" opacity=".25"/>` +
          `<ellipse cx="${x}" cy="${len + 8}" rx="6" ry="11" fill="#bfb5a0" opacity=".22"/>`;
      }
      s += `<path d="M0,0 L180,90 L360,0 M60,0 L180,90 L300,0 M0,60 L180,90 L360,60" stroke="#bfb5a0" opacity=".12" fill="none"/>`;
      s += glow(180, 140, 70, "gR", 2.5, 0.5) +
        `<ellipse cx="180" cy="145" rx="56" ry="24" fill="#2a1a16" stroke="#5a2a22" stroke-width="2">` +
        `<animate attributeName="ry" values="24;27;24" dur="2.5s" repeatCount="indefinite"/></ellipse>` +
        `<path d="M140,140 Q180,120 220,140" stroke="#6b2a22" fill="none"/>`;
      return wrap(s);
    },

    deep: () => wrap(
      stationWall("#221c15") + lights(7) +
      [45, 135, 225, 315].map((x) => glow(x, 110, 35, "gY", 0, 0.35)).join("") +
      `<rect y="150" width="${W}" height="30" fill="#1a1611"/>` +
      `<rect x="20" y="118" width="40" height="32" fill="#3a3026"/><circle cx="40" cy="130" r="5" fill="#7fa65a">${flicker(1.5)}</circle>` +
      figure(200, 168, 50) + figure(230, 170, 44)
    ),

    ghouls: () => wrap(
      tunnel() + glow(180, 112, 40, "gW", 3, 0.15) +
      hunch(130, 168, 1.3) + hunch(190, 150, 1.0, "#2e2a24") + hunch(250, 172, 1.5) + hunch(160, 140, 0.7, "#24211c") +
      tint("#7fa65a", 0.04)
    ),

    queen: () => {
      let legs = "";
      [[-1, 1], [1, 1]].forEach(([dir]) => {
        [0, 1, 2, 3].forEach((i) => {
          const sx = 180 + dir * 24, sy = 110 + i * 6;
          const kx = 180 + dir * (70 + i * 14), ky = 60 + i * 14;
          const ex = 180 + dir * (100 + i * 18), ey = 180;
          legs += `<path d="M${sx},${sy} L${kx},${ky} L${ex},${ey}" stroke="${DARK}" stroke-width="${6 - i}" fill="none" stroke-linejoin="round">` +
            `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${dir * 2};0 0" dur="${1 + i * 0.2}s" repeatCount="indefinite"/></path>`;
        });
      });
      return wrap(
        `<rect width="${W}" height="${H}" fill="#120e0b"/>` +
        `<path d="M0,0 L180,100 L360,0 M90,0 L180,100 L270,0 M0,90 L180,100 L360,90" stroke="#bfb5a0" opacity=".15" fill="none"/>` +
        glow(180, 120, 120, "gR", 2, 0.3) + legs +
        `<ellipse cx="180" cy="136" rx="46" ry="34" fill="${DARK}" stroke="#3a1a16" stroke-width="2"/>` +
        `<ellipse cx="180" cy="100" rx="24" ry="18" fill="${DARK}" stroke="#3a1a16" stroke-width="2"/>` +
        eyes(172, 96, 0.8) + eyes(188, 96, 0.8) + eyes(180, 104, 0.6) +
        `<path d="M172,114 l-4,10 M188,114 l4,10" stroke="#9a8b74" stroke-width="2"/>`
      );
    },

    depot: () => wrap(
      `<rect width="${W}" height="${H}" fill="#17140f"/>` +
      [0, 1, 2, 3, 4].map((i) => `<rect x="${i * 80}" y="0" width="10" height="${H}" fill="#221c15"/>`).join("") +
      `<rect y="0" width="${W}" height="14" fill="#221c15"/>` +
      wagon(-10, 70, 140, 60) + wagon(150, 82, 110, 48) + wagon(270, 88, 100, 42) +
      `<rect y="140" width="${W}" height="40" fill="#100d0a"/>` +
      robot(300, 160, 0.55) + glow(300, 107, 20, "gR", 1.5, 0.6) +
      glow(60, 30, 60, "gY", 2.5, 0.4)
    ),

    mechanoid: () => {
      const r = rng(41);
      let sparks = "";
      for (let i = 0; i < 10; i++) {
        const x = 250 + r() * 30, y = 70 + r() * 20, d = (0.2 + r() * 0.5).toFixed(2);
        sparks += `<line x1="${x}" y1="${y}" x2="${x + (r() - 0.3) * 40}" y2="${y + r() * 30}" stroke="#bfe8ff" stroke-width="1.5">` +
          `<animate attributeName="opacity" values="0;1;0;0" dur="${d}s" repeatCount="indefinite"/></line>`;
      }
      return wrap(
        `<rect width="${W}" height="${H}" fill="#120f0b"/>` + glow(260, 80, 90, "gB", 0.3, 0.9) +
        robot(180, 200, 1.45) +
        `<line x1="246" y1="92" x2="262" y2="80" stroke="#bfe8ff" stroke-width="3">${flicker(0.2)}</line>` + sparks +
        tint("#4a7a8a", 0.06)
      );
    },

    handcar: () => wrap(
      tunnel() +
      [0, 1, 2, 3, 4].map((i) => `<line x1="${20 + i * 15}" y1="${60 + i * 18}" x2="${60 + i * 15}" y2="${60 + i * 18}" stroke="#5a4a38" opacity=".4"/>`).join("") +
      `<rect x="120" y="138" width="120" height="14" fill="#3a3026"/>` +
      `<circle cx="140" cy="156" r="8" fill="#14110d" stroke="#5a4a38"/><circle cx="220" cy="156" r="8" fill="#14110d" stroke="#5a4a38"/>` +
      `<rect x="150" y="104" width="60" height="34" rx="3" fill="#4a3f30" stroke="#2a2219" stroke-width="2"/>` +
      `<rect x="158" y="112" width="30" height="4" fill="#14110d"/><rect x="158" y="120" width="30" height="4" fill="#14110d"/>` +
      figure(232, 140, 46) + `<line x1="226" y1="110" x2="214" y2="98" stroke="${DARK}" stroke-width="3"/>` +
      eyes(110, 112, 0.6, "gW", "#e8f0d0", 3) + eyes(90, 122, 0.5, "gW", "#e8f0d0", 2)
    ),

    waterworks: () => wrap(
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + skyline(51, "#3a332a", 140, 50) +
      `<rect y="150" width="${W}" height="30" fill="#1d1914"/>` +
      [[70, 50], [160, 40], [260, 56]].map(([x, h]) =>
        `<rect x="${x - 34}" y="${150 - h - 40}" width="68" height="${h + 40}" fill="#3b3428" stroke="#241d16" stroke-width="2"/>` +
        `<ellipse cx="${x}" cy="${150 - h - 40}" rx="34" ry="7" fill="#4a4134" stroke="#241d16" stroke-width="2"/>` +
        `<line x1="${x - 34}" y1="${150 - h / 2}" x2="${x + 34}" y2="${150 - h / 2}" stroke="#241d16" stroke-width="2"/>`).join("") +
      `<path d="M104,120 H126 M194,118 H226" stroke="#5a4a38" stroke-width="6"/>` + ash(30, 52)
    ),

    crayfish: () => wrap(
      `<rect width="${W}" height="${H}" fill="#0a1112"/>` + glow(180, 90, 120, "gB", 3, 0.35) +
      `<path d="M120,180 Q110,120 150,100 L150,180Z" fill="#3a1e18"/><path d="M240,180 Q250,120 210,100 L210,180Z" fill="#3a1e18"/>` +
      `<ellipse cx="180" cy="150" rx="50" ry="40" fill="#4a2a20" stroke="#2a1410" stroke-width="2"/>` +
      `<g fill="#5a2e22" stroke="#2a1410" stroke-width="2">` +
      `<path d="M140,120 Q90,90 70,50 Q60,30 80,24 Q96,40 92,60 Q108,40 100,20 Q124,30 112,64 Q130,90 150,110Z">` +
      `<animateTransform attributeName="transform" type="rotate" values="0 140 120;-6 140 120;0 140 120" dur="1.8s" repeatCount="indefinite"/></path>` +
      `<path d="M220,120 Q270,90 290,50 Q300,30 280,24 Q264,40 268,60 Q252,40 260,20 Q236,30 248,64 Q230,90 210,110Z">` +
      `<animateTransform attributeName="transform" type="rotate" values="0 220 120;6 220 120;0 220 120" dur="1.6s" repeatCount="indefinite"/></path></g>` +
      `<line x1="170" y1="112" x2="164" y2="92" stroke="#2a1410" stroke-width="2"/><line x1="190" y1="112" x2="196" y2="92" stroke="#2a1410" stroke-width="2"/>` +
      eyes(164, 90, 0.5, "gG", "#c6ff7a") + eyes(196, 90, 0.5, "gG", "#c6ff7a") +
      water(150, "#123036", 0.7)
    ),

    garden: () => {
      const r = rng(61);
      let vines = "";
      for (let i = 0; i < 9; i++) {
        const x = 30 + r() * 300;
        vines += `<path d="M${x},${H} Q${x - 30 + r() * 60},${110} ${x + (r() - 0.5) * 60},${40 + r() * 40}" stroke="#3a5a2a" stroke-width="${2 + r() * 3}" fill="none"/>`;
      }
      return wrap(
        `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
        `<path d="M30,160 L30,80 Q180,-10 330,80 L330,160" stroke="#5a5a48" stroke-width="3" fill="#2a3a2a" fill-opacity=".25"/>` +
        [80, 130, 180, 230, 280].map((x) => `<line x1="${x}" y1="160" x2="${x}" y2="${x === 180 ? 34 : 50 + Math.abs(x - 180) / 3}" stroke="#5a5a48" stroke-width="2"/>`).join("") +
        `<path d="M110,60 L140,90 L120,100Z M230,70 L250,100" stroke="#5a5a48" fill="none"/>` +
        vines + `<rect y="160" width="${W}" height="20" fill="#1d2416"/>` + ash(20, 62, "#c8d8b0")
      );
    },

    vine: () => {
      let tentacles = "";
      [[60, 1.4], [110, 1.1], [250, 1.2], [300, 1.6], [150, 0.9], [210, 1]].forEach(([x, d], i) => {
        tentacles += `<path d="M${x},${H} Q${x + 30},110 ${x - 10},50" stroke="#3a5a2a" stroke-width="7" fill="none" stroke-linecap="round">` +
          `<animate attributeName="d" dur="${d * 2}s" repeatCount="indefinite" values="M${x},${H} Q${x + 30},110 ${x - 10},50;M${x},${H} Q${x - 30},110 ${x + 15},56;M${x},${H} Q${x + 30},110 ${x - 10},50"/></path>`;
      });
      return wrap(
        `<rect width="${W}" height="${H}" fill="#141a10"/>` + glow(180, 110, 90, "gG", 2, 0.25) + tentacles +
        `<g transform="translate(180,110)">` +
        [0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="0" cy="-30" rx="14" ry="30" fill="#7a2a2a" transform="rotate(${a})"/>`).join("") +
        `<circle r="20" fill="#1a0a08"/><path d="M-14,-4 l4,8 l4,-8 l4,8 l4,-8 l4,8 l4,-8" stroke="#e8dcc6" stroke-width="2" fill="none"/></g>` +
        tint("#7fa65a", 0.05)
      );
    },

    lab: () => wrap(
      `<rect width="${W}" height="${H}" fill="#1a1d18"/>` +
      [50, 90, 130].map((y) => `<rect x="20" y="${y}" width="120" height="3" fill="#3a3a30"/>`).join("") +
      [30, 50, 70, 90, 110].map((x, i) => `<rect x="${x}" y="${36 + (i % 2) * 40}" width="8" height="14" fill="#4a5a4a"/>`).join("") +
      `<rect x="200" y="30" width="110" height="130" rx="6" fill="#2a2e2a" stroke="#4a4e48" stroke-width="2"/>` +
      `<rect x="212" y="44" width="86" height="102" fill="#0e1410"/>` +
      [0, 1, 2, 3, 4].map((i) => `<rect x="${222 + i * 15}" y="80" width="8" height="34" rx="4" fill="#9fe07a" opacity=".85">${flicker(1 + i * 0.3)}</rect>`).join("") +
      glow(255, 96, 60, "gG", 2, 0.6) +
      `<g fill="#bca88a"><path d="M40,160 q10,-18 20,0Z"/><path d="M70,162 q8,-14 16,0Z"/><path d="M96,160 q12,-20 24,0Z"/></g>` +
      `<rect y="162" width="${W}" height="18" fill="#121410"/>`
    ),

    raiders: () => wrap(
      tunnel() +
      `<polygon points="120,90 0,180 80,180" fill="#ffe0a0" opacity=".1"/><polygon points="240,90 360,180 280,180" fill="#ffe0a0" opacity=".1"/>` +
      figure(120, 168, 92) + figure(240, 168, 96) + figure(180, 150, 70) +
      `<line x1="132" y1="104" x2="170" y2="96" stroke="${DARK}" stroke-width="4"/>` +
      `<line x1="228" y1="104" x2="192" y2="96" stroke="${DARK}" stroke-width="4"/>` +
      glow(120, 90, 14, "gW", 0.6) + glow(240, 90, 14, "gW", 0.8) + tint("#c8473a", 0.07)
    ),

    samboss: () => wrap(
      `<rect width="${W}" height="${H}" fill="#120f0b"/>` + glow(180, 90, 140, "gR", 2, 0.25) +
      `<g fill="#2f2a24" stroke="#4a4034" stroke-width="2">` +
      `<rect x="146" y="120" width="26" height="60" rx="4"/><rect x="188" y="120" width="26" height="60" rx="4"/>` +
      `<path d="M128,124 Q124,64 180,58 Q236,64 232,124Z"/>` +
      `<ellipse cx="128" cy="74" rx="26" ry="18"/><ellipse cx="232" cy="74" rx="26" ry="18"/>` +
      `<rect x="104" y="80" width="22" height="56" rx="6"/>` +
      `<rect x="234" y="84" width="22" height="40" rx="6"/>` +
      `<rect x="250" y="112" width="70" height="16" rx="3"/>` +
      `<path d="M156,58 Q156,20 180,18 Q204,20 204,58Z"/></g>` +
      `<rect x="164" y="32" width="32" height="12" rx="3" fill="#d9a441" opacity=".9">${flicker(1.4)}</rect>` +
      glow(188, 40, 8, "gY", 1) +
      [0, 1, 2].map((i) => `<line x1="320" y1="${114 + i * 5}" x2="340" y2="${114 + i * 5}" stroke="#5a4a38" stroke-width="2"/>`).join("") +
      `<rect x="160" y="78" width="40" height="14" fill="#1a1612"/>` + tint("#c8473a", 0.06)
    ),

    caravan: () => {
      let s = tunnel() + glow(176, 140, 90, "gY", 2.5, 0.45);
      for (let i = 0; i < 9; i++) {
        const t = i / 8, y = Math.round(172 - t * 46), h = Math.round(50 - t * 34), x = Math.round(150 + t * 28 + (i % 2 ? 22 : -14) * (1 - t));
        s += figure(x, y, h);
        if (i % 3 === 1) s += `<rect x="${x + 6}" y="${Math.round(y - h * 0.4)}" width="${Math.round(h * 0.5)}" height="${Math.round(h * 0.3)}" fill="#2a2219"/>`;
      }
      s += glow(186, 118, 16, "gY", 2, 0.8) + glow(150, 150, 30, "gY", 1.6, 0.5) + figure(110, 178, 74) + `<line x1="124" y1="120" x2="130" y2="178" stroke="${DARK}" stroke-width="3"/>`;
      return wrap(s);
    },

    newhome: () => wrap(
      stationWall("#2a2219") + lights(9) + glow(180, 70, 160, "gW", 0, 0.25) +
      [45, 135, 225, 315].map((x) => glow(x, 100, 40, "gY", 0, 0.5)).join("") +
      `<rect y="150" width="${W}" height="30" fill="#1f1a14"/>` +
      [0, 1, 2].map((i) => `<rect x="${30 + i * 50}" y="146" width="40" height="8" fill="#3a5a2a"/>` +
        `<g fill="#bca88a"><path d="M${36 + i * 50},146 q4,-8 8,0Z"/><path d="M${50 + i * 50},146 q5,-10 10,0Z"/></g>`).join("") +
      figure(230, 170, 56) + figure(260, 172, 40) + figure(280, 170, 50) + figure(320, 172, 60) +
      `<rect x="200" y="120" width="6" height="20" fill="#5a6a6a"/><rect x="194" y="118" width="18" height="4" fill="#5a6a6a"/>` +
      `<rect x="202" y="140" width="2" height="10" fill="#7fb0c0"><animate attributeName="height" values="6;12;6" dur=".6s" repeatCount="indefinite"/></rect>`
    ),
  });
})();
