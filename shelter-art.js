// =====================================================================
//  КАРТИНКИ УБЕЖИЩА: интерьеры комнат, поверхность, рельсы метро
//  Каждая комната рисуется кодом (SVG) и оживает анимацией.
//  Рисунок зависит от уровня комнаты (lvl) и её ширины (w клеток).
// =====================================================================

const SHELTER_ART = (() => {
  const U = 100, H = 96; // одна клетка комнаты: 100 × 96

  // общие заготовки (градиенты, узоры) — вставляются в страницу один раз
  const DEFS = `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <pattern id="sa-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="10" fill="#d9a441"/><rect x="5" width="5" height="10" fill="#1a1510"/></pattern>
      <radialGradient id="sa-glowY"><stop offset="0" stop-color="#ffd98a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
      <radialGradient id="sa-glowB"><stop offset="0" stop-color="#9fe0ff" stop-opacity=".7"/><stop offset="1" stop-color="#9fe0ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="sa-glowG"><stop offset="0" stop-color="#c6ff7a" stop-opacity=".6"/><stop offset="1" stop-color="#c6ff7a" stop-opacity="0"/></radialGradient>
      <radialGradient id="sa-glowR"><stop offset="0" stop-color="#ff7060" stop-opacity=".7"/><stop offset="1" stop-color="#ff7060" stop-opacity="0"/></radialGradient>
      <radialGradient id="sa-glowP"><stop offset="0" stop-color="#ff8ad8" stop-opacity=".7"/><stop offset="1" stop-color="#ff8ad8" stop-opacity="0"/></radialGradient>
      <linearGradient id="sa-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2a24"/><stop offset="1" stop-color="#7a6648"/></linearGradient>
      <linearGradient id="sa-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fb3d9"/><stop offset="1" stop-color="#1a4a5a"/></linearGradient>
    </defs></svg>`;

  const spin = (cx, cy, dur, rev) =>
    `<animateTransform attributeName="transform" type="rotate" from="${rev ? 360 : 0} ${cx} ${cy}" to="${rev ? 0 : 360} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>`;
  const blink = (dur, vals = "1;.3;1") => `<animate attributeName="opacity" values="${vals}" dur="${dur}s" repeatCount="indefinite"/>`;
  const glow = (x, y, r, g, dur) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sa-glow${g})">${dur ? blink(dur, "1;.55;1") : ""}</circle>`;
  const floor = (w) => `<rect y="86" width="${U * w}" height="10" fill="#000" opacity=".35"/>`;

  function gear(cx, cy, r, color, dur, rev) {
    return `<g>${spin(cx, cy, dur, rev)}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r * 0.45}" stroke-dasharray="${r * 0.5} ${r * 0.35}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="${color}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="#14110d"/></g>`;
  }

  // ---------- интерьеры по типам (x0 — сдвиг клетки, i — номер клетки) ----------
  const ROOM = {
    entrance(lvl, w) {
      return `<g opacity=".95"><circle cx="34" cy="52" r="28" fill="#3a3830" stroke="#6a6452" stroke-width="3"/>` +
        `<circle cx="34" cy="52" r="20" fill="#2a2924" stroke="#4a463c" stroke-width="2"/>` +
        `<g>${spin(34, 52, 24)}<path d="M34,36 V68 M18,52 H50" stroke="#8a806a" stroke-width="3"/></g>` +
        [0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${34 + Math.cos(a / 57.3) * 24}" cy="${52 + Math.sin(a / 57.3) * 24}" r="1.8" fill="#9a8b74"/>`).join("") +
        `</g><rect x="64" y="80" width="36" height="6" fill="url(#sa-stripes)" opacity=".8"/>` +
        `<rect x="74" y="20" width="8" height="5" fill="#c8473a">${blink(1.2)}</rect>` + glow(78, 22, 10, "R", 1.2) +
        (lvl >= 2 ? `<rect x="70" y="40" width="20" height="26" rx="2" fill="#2a2924" stroke="#4a463c"/><rect x="73" y="44" width="14" height="8" fill="#7fa65a" opacity=".6">${blink(2)}</rect>` : "") +
        (lvl >= 3 ? `<path d="M64,70 h30 v14 h-30z" fill="#4a3f30"/><path d="M64,70 h30" stroke="#2a2219"/>` : "") + floor(w);
    },

    power(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 6}" y="44" width="44" height="42" rx="3" fill="#4a3c18" stroke="#6a5424" stroke-width="2"/>` +
          `<rect x="${x + 10}" y="50" width="16" height="4" fill="#2a210c"/><rect x="${x + 10}" y="58" width="16" height="4" fill="#2a210c"/>` +
          gear(x + 36, 62, 9, "#b08a2a", 2.2) +
          `<path d="M${x + 28},44 V24 Q${x + 28},16 ${x + 40},16 H${x + U - 4}" stroke="#2a210c" stroke-width="3" fill="none"/>` +
          `<path d="M${x + 72},30 l-6,12 h6 l-4,12" stroke="#ffd98a" stroke-width="2" fill="none">${blink(0.4, "1;0;1;0;0")}</path>` + glow(x + 70, 42, 14, "Y", 0.8);
        if (lvl >= 2) s += gear(x + 76, 70, 7, "#8a6a20", 1.6, true) + `<rect x="${x + 62}" y="76" width="30" height="10" fill="#3a2f12"/>`;
        if (lvl >= 3) s += `<rect x="${x + 86}" y="20" width="8" height="66" fill="#2a210c"/>` +
          [26, 36, 46, 56, 66].map((y) => `<rect x="${x + 84}" y="${y}" width="12" height="3" fill="#e2b13c">${blink(1, "1;.4;1")}</rect>`).join("") + glow(x + 90, 40, 16, "Y", 1);
      }
      return s + floor(w);
    },

    water(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        const tank = (tx, ty, tw, th) => {
          let b = `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="6" fill="#123440" stroke="#3a7a90" stroke-width="2"/>` +
            `<rect x="${tx + 3}" y="${ty + th * 0.35}" width="${tw - 6}" height="${th * 0.65 - 3}" rx="3" fill="url(#sa-water)" opacity=".8">` +
            `<animate attributeName="y" values="${ty + th * 0.35};${ty + th * 0.3};${ty + th * 0.35}" dur="4s" repeatCount="indefinite"/></rect>`;
          for (let k = 0; k < 3; k++) {
            const bx = tx + 6 + k * (tw - 12) / 2;
            b += `<circle cx="${bx}" cy="${ty + th - 4}" r="1.6" fill="#cfefff" opacity=".8">` +
              `<animate attributeName="cy" from="${ty + th - 4}" to="${ty + th * 0.38}" dur="${1.6 + k * 0.5}s" repeatCount="indefinite"/></circle>`;
          }
          return b;
        };
        s += tank(x + 8, 34, 30, 52) +
          `<path d="M${x + 38},50 H${x + 70} V86 M${x + 54},50 V30 H${x + U}" stroke="#3a7a90" stroke-width="4" fill="none"/>` +
          `<circle cx="${x + 54}" cy="50" r="5" fill="#1a4a5a" stroke="#4fb3d9" stroke-width="2"/>`;
        if (lvl >= 2) s += tank(x + 64, 48, 22, 38);
        if (lvl >= 3) s += glow(x + 54, 50, 18, "B", 1.6) + `<rect x="${x + 88}" y="34" width="8" height="52" rx="2" fill="#1a4a5a" stroke="#4fb3d9"/>`;
      }
      return s + floor(w);
    },

    food(lvl, w) {
      let s = "";
      const rows = [76, 58, 40].slice(0, lvl);
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 6}" y="18" width="${U - 12}" height="4" fill="#a98ad9" opacity=".7"/>` +
          `<rect x="${x + 6}" y="22" width="${U - 12}" height="30" fill="#a98ad9" opacity=".08">${blink(3, ".08;.14;.08")}</rect>`;
        rows.forEach((y, ri) => {
          s += `<rect x="${x + 6}" y="${y}" width="${U - 12}" height="6" rx="2" fill="#3a2a1a" stroke="#5a4428"/>`;
          for (let m = 0; m < 6; m++) {
            const mx = x + 14 + m * 14, sz = 4 + ((m + ri) % 3);
            s += `<g>${blink(2 + (m % 3), "1;.75;1")}` +
              `<rect x="${mx - 1}" y="${y - sz}" width="2" height="${sz}" fill="#d8c9a8"/>` +
              `<ellipse cx="${mx}" cy="${y - sz}" rx="${sz}" ry="${sz * 0.55}" fill="${m % 2 ? "#cbb98f" : "#e0d2b0"}"/></g>`;
          }
          s += glow(x + 50, y - 4, 30, "G", 2.5 + ri);
        });
      }
      return s + floor(w);
    },

    living(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        const bunk = (bx) => `<path d="M${bx},86 V40 M${bx + 34},86 V40" stroke="#6a4a30" stroke-width="3"/>` +
          `<rect x="${bx}" y="50" width="34" height="6" fill="#8a5a3a"/><rect x="${bx + 2}" y="46" width="30" height="5" rx="2" fill="#c9b090"/>` +
          `<rect x="${bx}" y="74" width="34" height="6" fill="#8a5a3a"/><rect x="${bx + 2}" y="70" width="30" height="5" rx="2" fill="#a87a5a"/>`;
        s += bunk(x + 8) + `<line x1="${x + 66}" y1="0" x2="${x + 66}" y2="20" stroke="#4a3a2a"/>` +
          `<path d="M${x + 60},20 h12 l-3,6 h-6z" fill="#d98b5a"/>` + glow(x + 66, 30, 22, "Y", 3);
        if (lvl >= 2) s += `<rect x="${x + 56}" y="40" width="20" height="16" fill="#5a3a2a" stroke="#8a5a3a"/><rect x="${x + 59}" y="43" width="14" height="10" fill="#c8473a" opacity=".5"/>` +
          `<ellipse cx="${x + 70}" cy="86" rx="22" ry="3" fill="#7a3a2a" opacity=".7"/>`;
        if (lvl >= 3) s += bunk(x + 62).replace(/#c9b090/g, "#b0c0d0") +
          `<path d="M${x + 50},86 q2,-14 0,-20 q8,4 6,20z" fill="#5a8a3a"/>`;
      }
      return s + floor(w);
    },

    storage(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        [70, 48, 26].slice(0, lvl + 1).forEach((y, ri) => {
          s += `<rect x="${x + 4}" y="${y + 14}" width="${U - 8}" height="3" fill="#5a4a38"/>`;
          for (let c = 0; c < 4; c++) {
            const cx = x + 8 + c * 22;
            s += (c + ri) % 3 === 0
              ? `<rect x="${cx}" y="${y}" width="14" height="14" rx="3" fill="#5a6a4a" stroke="#3a4a2a"/><line x1="${cx}" y1="${y + 5}" x2="${cx + 14}" y2="${y + 5}" stroke="#3a4a2a"/>`
              : `<rect x="${cx}" y="${y + 2}" width="18" height="12" fill="#7a5a3a" stroke="#4a3420"/><path d="M${cx},${y + 2} l18,12 M${cx + 18},${y + 2} l-18,12" stroke="#4a3420" stroke-width=".8"/>`;
          }
        });
      }
      return s + floor(w);
    },

    medbay(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 8}" y="66" width="46" height="8" fill="#d8d0c0"/><rect x="${x + 8}" y="74" width="4" height="12" fill="#8a8a8a"/><rect x="${x + 50}" y="74" width="4" height="12" fill="#8a8a8a"/>` +
          `<rect x="${x + 10}" y="61" width="12" height="6" rx="2" fill="#f0ece0"/>` +
          `<rect x="${x + 64}" y="30" width="28" height="20" rx="2" fill="#0e1410" stroke="#5a6a5a"/>` +
          `<polyline points="${x + 66},40 ${x + 72},40 ${x + 75},33 ${x + 78},46 ${x + 81},40 ${x + 90},40" fill="none" stroke="#7fe07a" stroke-width="1.5" stroke-dasharray="40" stroke-dashoffset="40">` +
          `<animate attributeName="stroke-dashoffset" from="40" to="-40" dur="1.4s" repeatCount="indefinite"/></polyline>` +
          `<rect x="${x + 26}" y="22" width="12" height="4" fill="#e07a7a"/><rect x="${x + 30}" y="18" width="4" height="12" fill="#e07a7a"/>` +
          `<line x1="${x + 60}" y1="54" x2="${x + 60}" y2="86" stroke="#8a8a8a" stroke-width="2"/><rect x="${x + 56}" y="52" width="8" height="10" rx="2" fill="#9fd0e0" opacity=".7"/>`;
        if (lvl >= 2) s += `<rect x="${x + 66}" y="60" width="26" height="26" fill="#4a3a3a" stroke="#6a5050"/><rect x="${x + 70}" y="64" width="8" height="8" fill="#e07a7a" opacity=".6"/>`;
        if (lvl >= 3) s += glow(x + 32, 24, 18, "R", 2) + `<rect x="${x + 6}" y="8" width="${U - 12}" height="3" fill="#f0ece0" opacity=".7">${blink(0.3, "1;.8;1")}</rect>`;
      }
      return s + floor(w);
    },

    radio(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 6}" y="60" width="56" height="26" fill="#3a2a4a" stroke="#5a4a6a"/>` +
          `<rect x="${x + 10}" y="46" width="22" height="16" rx="2" fill="#0e0c14" stroke="#5a4a6a"/><rect x="${x + 36}" y="46" width="22" height="16" rx="2" fill="#0e0c14" stroke="#5a4a6a"/>` +
          `<rect x="${x + 13}" y="50" width="16" height="2" fill="#a98ad9">${blink(0.9)}</rect><rect x="${x + 39}" y="50" width="10" height="2" fill="#7fe07a">${blink(1.3)}</rect>` +
          [0, 1, 2, 3].map((k) => `<circle cx="${x + 14 + k * 12}" cy="72" r="3" fill="#a98ad9" opacity=".6"/>`).join("") +
          `<line x1="${x + 80}" y1="86" x2="${x + 80}" y2="22" stroke="#6a5a7a" stroke-width="3"/>` +
          [0, 1, 2].map((k) => `<path d="M${x + 70 - k * 6},${18 - k * 4} q${10 + k * 6},-${8 + k * 3} ${20 + k * 12},0" stroke="#a98ad9" stroke-width="1.5" fill="none" opacity="0">` +
            `<animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="${k * 0.6}s" repeatCount="indefinite"/></path>`).join("");
        if (lvl >= 2) s += `<rect x="${x + 86}" y="54" width="10" height="32" fill="#3a2a4a" stroke="#5a4a6a"/>` + [58, 64, 70, 76].map((y) => `<rect x="${x + 88}" y="${y}" width="6" height="2" fill="#a98ad9">${blink(0.5 + y / 100)}</rect>`).join("");
        if (lvl >= 3) s += glow(x + 80, 22, 18, "P", 1.2);
      }
      return s + floor(w);
    },

    gym(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 4}" y="80" width="${U - 8}" height="6" fill="#3a4a5a" opacity=".6"/>` +
          `<rect x="${x + 8}" y="56" width="30" height="3" fill="#6a7a8a"/>` +
          [0, 1, 2].map((k) => `<rect x="${x + 10 + k * 10}" y="48" width="4" height="8" fill="#2a2a2a"/><rect x="${x + 9 + k * 10}" y="50" width="6" height="4" fill="#4a4a4a"/>`).join("") +
          `<line x1="${x + 70}" y1="0" x2="${x + 70}" y2="16" stroke="#5a5a5a"/>` +
          `<g><animateTransform attributeName="transform" type="rotate" values="-8 ${x + 70} 16;8 ${x + 70} 16;-8 ${x + 70} 16" dur="2s" repeatCount="indefinite"/>` +
          `<line x1="${x + 70}" y1="16" x2="${x + 70}" y2="26" stroke="#5a5a5a"/><rect x="${x + 63}" y="26" width="14" height="34" rx="6" fill="#a84a3a" stroke="#7a2a1a"/></g>`;
        if (lvl >= 2) s += `<rect x="${x + 82}" y="40" width="4" height="46" fill="#6a7a8a"/><rect x="${x + 74}" y="44" width="20" height="4" fill="#9aa6b8"/>`;
        if (lvl >= 3) s += `<rect x="${x + 10}" y="18" width="34" height="18" fill="#1a1e24" stroke="#4a5a6a"/><path d="M${x + 14},30 l6,-6 l6,4 l8,-8" stroke="#7fe07a" fill="none">${blink(2)}</path>`;
      }
      return s + floor(w);
    },

    bar(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 4}" y="62" width="${U - 8}" height="24" fill="#4a2a1a" stroke="#6a3a2a"/><rect x="${x + 4}" y="60" width="${U - 8}" height="4" fill="#8a5a3a"/>` +
          `<rect x="${x + 6}" y="40" width="${U - 12}" height="2" fill="#5a3a2a"/>` +
          [0, 1, 2, 3, 4, 5].map((k) => `<rect x="${x + 10 + k * 14}" y="${30 + (k % 2) * 2}" width="5" height="${10 - (k % 2) * 2}" rx="1" fill="${["#7fa65a", "#c8473a", "#d9a441", "#4fb3d9"][k % 4]}" opacity=".85"/>`).join("") +
          (i === 0 ? `<text x="${x + 50}" y="20" text-anchor="middle" font-family="PT Mono, monospace" font-size="13" font-weight="700" fill="#ff8ad8">${blink(2.5, "1;1;.2;1;.6;1")}БАР</text>` + glow(x + 50, 16, 26, "P", 2.5) : "") +
          [24, 56].map((sx) => `<rect x="${x + sx}" y="74" width="10" height="3" fill="#8a5a3a"/><line x1="${x + sx + 5}" y1="77" x2="${x + sx + 5}" y2="86" stroke="#8a5a3a" stroke-width="2"/>`).join("");
        if (lvl >= 2) s += `<rect x="${x + 80}" y="48" width="12" height="12" rx="6" fill="#d9a441" opacity=".25">${blink(3)}</rect>`;
        if (lvl >= 3) s += `<path d="M${x + 6},${H - 10} h${U - 12}" stroke="#ff8ad8" stroke-width="1.5" opacity=".6">${blink(1.5)}</path>`;
      }
      return s + floor(w);
    },

    guard(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 8}" y="28" width="36" height="40" fill="#2a2620" stroke="#4a4030"/>` +
          [0, 1, 2].map((k) => `<line x1="${x + 14 + k * 11}" y1="34" x2="${x + 14 + k * 11}" y2="62" stroke="#1a1612" stroke-width="3"/><rect x="${x + 12 + k * 11}" y="56" width="6" height="8" fill="#5a4a38"/>`).join("") +
          [0, 1, 2].map((k) => `<rect x="${x + 52 + k * 14}" y="76" width="16" height="10" rx="4" fill="#5a4f3a" stroke="#3a3020"/>`).join("") +
          [0, 1].map((k) => `<rect x="${x + 59 + k * 14}" y="67" width="16" height="10" rx="4" fill="#5a4f3a" stroke="#3a3020"/>`).join("") +
          `<rect x="${x + 70}" y="16" width="8" height="6" fill="#c8473a">${blink(1.5)}</rect>` + glow(x + 74, 19, 12, "R", 1.5);
        if (lvl >= 2) s += `<rect x="${x + 84}" y="36" width="4" height="30" fill="#5a5a5a"/><rect x="${x + 80}" y="32" width="12" height="6" fill="#3a3a3a"/>`;
        if (lvl >= 3) s += `<rect x="${x + 8}" y="70" width="36" height="16" fill="#3a3a2a" stroke="#5a5a3a"/><text x="${x + 26}" y="82" text-anchor="middle" font-size="9" fill="#d9a441" font-family="PT Mono, monospace">⚠</text>`;
      }
      return s + floor(w);
    },

    workshop(lvl, w) {
      let s = "";
      for (let i = 0; i < w; i++) {
        const x = i * U;
        s += `<rect x="${x + 6}" y="62" width="60" height="6" fill="#6a5a40"/><rect x="${x + 10}" y="68" width="4" height="18" fill="#4a3a2a"/><rect x="${x + 58}" y="68" width="4" height="18" fill="#4a3a2a"/>` +
          `<rect x="${x + 6}" y="20" width="60" height="28" fill="#2a2620" stroke="#4a4030"/>` +
          `<path d="M${x + 14},26 v16 M${x + 24},26 l4,16 M${x + 36},26 v12 h4 M${x + 50},26 v16" stroke="#8a8a8a" stroke-width="2"/>` +
          `<circle cx="${x + 80}" cy="56" r="8" fill="#5a5a5a" stroke="#8a8a8a" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 ${x + 80} 56" to="360 ${x + 80} 56" dur=".4s" repeatCount="indefinite"/></circle>` +
          `<rect x="${x + 76}" y="64" width="8" height="22" fill="#4a4a4a"/>` +
          [0, 1, 2, 3].map((k) => `<line x1="${x + 72}" y1="${58 + k}" x2="${x + 60 - k * 4}" y2="${50 - k * 3}" stroke="#ffd98a" stroke-width="1.2" opacity="0"><animate attributeName="opacity" values="0;1;0" dur=".35s" begin="${k * 0.09}s" repeatCount="indefinite"/></line>`).join("") +
          glow(x + 70, 56, 12, "Y", 0.3);
        if (lvl >= 2) s += gear(x + 90, 24, 7, "#7a7a7a", 3);
        if (lvl >= 3) s += `<rect x="${x + 30}" y="54" width="20" height="8" fill="#4fb3d9" opacity=".6">${blink(1.2)}</rect>`;
      }
      return s + floor(w);
    },
  };

  // ---------- Поверхность над станцией ----------
  function surface() {
    let ruins = "", x = -4, seed = 7;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    while (x < 360) {
      const w = 16 + r() * 30, h = 14 + r() * 34;
      ruins += `<path d="M${x},70 V${58 - h} l${w * 0.3},-${r() * 6} l${w * 0.4},${r() * 8} l${w * 0.3},-${r() * 5} V70z" fill="#2a241c"/>`;
      x += w + 2 + r() * 6;
    }
    let ash = "";
    for (let i = 0; i < 16; i++) {
      const ax = (i * 23 + 11) % 360, d = 4 + (i % 5);
      ash += `<circle cx="${ax}" cy="-2" r="${0.8 + (i % 3) * 0.4}" fill="#cfc4a8" opacity=".6"><animate attributeName="cy" from="-2" to="72" dur="${d}s" begin="-${i % d}s" repeatCount="indefinite"/></circle>`;
    }
    return `<svg viewBox="0 0 360 70" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="360" height="70" fill="url(#sa-sky)"/><circle cx="300" cy="18" r="9" fill="#cbb98f" opacity=".45"/>` + ruins +
      `<rect y="60" width="360" height="10" fill="#1d1914"/>` +
      `<path d="M24,70 V42 h68 v28z" fill="#3a352c" stroke="#5a5244" stroke-width="2"/>` +
      `<path d="M40,70 V54 a18,14 0 0 1 36,0 V70z" fill="#14110d" stroke="#6a6452" stroke-width="2"/>` +
      `<rect x="30" y="44" width="56" height="5" fill="url(#sa-stripes)" opacity=".8"/>` +
      `<line x1="86" y1="42" x2="86" y2="22" stroke="#5a5244" stroke-width="2"/><circle cx="86" cy="21" r="2.5" fill="#c8473a">${blink(1)}</circle>` +
      `<text x="58" y="38" text-anchor="middle" font-family="PT Mono, monospace" font-size="7" fill="#9a8b74">«ГЛУБОКАЯ»</text>` + ash + `</svg>`;
  }

  // ---------- Старые рельсы под станцией ----------
  function rails() {
    return `<svg viewBox="0 0 360 44" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="360" height="44" fill="#0a0806"/>` +
      `<path d="M0,6 Q180,-6 360,6 V44 H0z" fill="#14110d"/>` +
      Array.from({ length: 19 }, (_, i) => `<rect x="${i * 20 + 2}" y="30" width="12" height="4" fill="#2e261d"/>`).join("") +
      `<rect y="28" width="360" height="2" fill="#5a4a38"/><rect y="35" width="360" height="2" fill="#5a4a38"/>` +
      `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.7;.75;.95;1" dur="24s" repeatCount="indefinite"/>` +
      `<circle cy="24" r="22" fill="url(#sa-glowY)"><animate attributeName="cx" values="-40;-40;-40;400;400" keyTimes="0;.7;.75;.95;1" dur="24s" repeatCount="indefinite"/></circle></g>` +
      `<text x="180" y="18" text-anchor="middle" font-family="PT Mono, monospace" font-size="8" fill="#4a3f30">старый перегон · рельсы ещё живы</text></svg>`;
  }

  const room = (type, lvl, w) => {
    const draw = ROOM[type];
    return `<svg class="room-art" viewBox="0 0 ${U * w} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${draw ? draw(lvl, w) : ""}</svg>`;
  };

  return { DEFS, room, surface, rails };
})();
