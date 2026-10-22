// =====================================================================
//  СВОБОДНАЯ ИГРА: УБЕЖИЩЕ «ГЛУБОКАЯ»
//  Реальное время в духе Fallout Shelter: комнаты производят ресурсы,
//  жители работают, ходят на вылазки и отбиваются от происшествий.
//  Ресурсы копятся, даже когда игра закрыта. Настройки — в shelter-data.js.
// =====================================================================

const Shelter = (() => {
  const KEY = "last_train_shelter";
  let S = null;            // всё состояние убежища (сохраняется)
  let hero = { lvl: 5 };   // смотритель — герой из сюжета
  let loop = null, lastReal = 0, lastSave = 0, lastTabRender = 0;
  let tab = "vault", dirty = true, refs = {}, heroTapAt = 0, quiet = false;

  // ---------- Происшествия и гости ----------
  const INCIDENTS = {
    rats: { name: "Крысы",     icon: "🐀", hp: 40, dps: 1.4, where: "work",     fail: "Крысы сожрали четверть еды",        penalty: { food: 0.25 } },
    fire: { name: "Пожар",     icon: "🔥", hp: 35, dps: 1.2, where: "any",      fail: "Огонь уничтожил четверть энергии",  penalty: { power: 0.25 } },
    raid: { name: "Налётчики", icon: "🔫", hp: 70, dps: 2.0, where: "entrance", fail: "Налётчики унесли десятую часть патронов", penalty: { patrons: 0.1 } },
  };
  const LORE = [
    "Радио трещит: «...говорит станция Ганза... видели состав... шёл на север без огней...»",
    "Голос по радио: «...Последний поезд существует. Он ждёт на кольце. Ищите депо с красной звездой...»",
    "Сквозь помехи — детская считалочка. Потом тишина.",
    "«...кто слышит — в чистой зоне есть место для всех. Повторяю: место для всех...»",
  ];

  // ---------- Помощники ----------
  const now = () => Date.now();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (n) => Math.floor(n).toLocaleString("ru-RU");
  const RES_ICON = { power: "⚡", water: "💧", food: "🍄", medkit: "💊" };
  const ROMAN = ["", "I", "II", "III"];

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    if (hh) return `${hh} ч ${mm} мин`;
    if (mm) return `${mm} мин ${ss < 10 ? "0" : ""}${ss} с`;
    return `${ss} с`;
  }

  // создание элементов: h("div", { class: "x", onclick }, "текст", child)
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "style") n.style.cssText = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  const byId = (id) => document.getElementById(id);

  // ---------- Жители ----------
  const alive = () => S.dw.filter((d) => !d.dead);
  const atHome = () => S.dw.filter((d) => !d.dead && !d.exp);
  const roomById = (id) => S.rooms.find((r) => r.id === id);
  const workers = (r) => S.dw.filter((d) => d.room === r.id && !d.dead && !d.exp);
  // комната может занимать 1–3 клетки (после объединения)
  const W = (r) => r.w || 1;
  const slotsOf = (r) => (ROOMS[r.type].slots || 0) * W(r);
  const outOf = (r) => Math.round(ROOMS[r.type].out[r.lvl - 1] * W(r) * (W(r) > 1 ? MERGE_BONUS : 1));
  const cellRoom = (f, c) => S.rooms.find((r) => r.f === f && c >= r.c && c < r.c + W(r));
  const eff = (d, k) => Math.min(15, d.s[k] + ((d.o && OUTFITS[d.o].bonus[k]) || 0));
  const weaponPower = (d) => (d.w ? WEAPONS[d.w].power : 0);
  const bestStat = (d) => Object.keys(STATS).reduce((a, k) => (eff(d, k) > eff(d, a) ? k : a), "str");

  function freeName() {
    const used = new Set(S.dw.map((d) => d.n));
    const free = NAMES.filter((n) => !used.has(n));
    if (free.length) return pick(free);
    let i = 2, base = pick(NAMES);
    while (used.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }
  function randomStats() {
    const s = {};
    Object.keys(STATS).forEach((k) => (s[k] = irnd(1, 4)));
    const top = pick(Object.keys(STATS));
    s[top] = Math.min(10, s[top] + irnd(2, 4));
    return s;
  }
  function makeDweller(name, stats, lvl = 1) {
    const mhp = 100 + (lvl - 1) * 5;
    const d = { id: S.id++, n: name, s: Object.assign({}, stats), lvl, xp: 0, hp: mhp, mhp, hap: 60,
                room: null, o: null, w: null, exp: null, dead: false, col: irnd(0, 7) };
    S.dw.push(d);
    return d;
  }
  function addXp(d, x) {
    d.xp += x;
    while (d.xp >= d.lvl * 20 && d.lvl < 50) {
      d.xp -= d.lvl * 20;
      d.lvl++;
      d.mhp += 5;
      d.hp = d.mhp;
    }
  }
  function die(d, why) {
    if (d.dead) return;
    d.dead = true;
    d.hp = 0;
    toast(`☠️ ${d.n} погибает ${why}`, "bad");
    Sound.hurt();
    dirty = true;
  }
  const reviveCost = (d) => 50 + d.lvl * 25;

  // ---------- Сводка по убежищу ----------
  function agg() {
    const A = { pop: 0, home: 0, cap: 0, store: SHELTER.baseStorage, count: {}, lvl3: 0, fullFood: 0 };
    S.dw.forEach((d) => { if (!d.dead) { A.pop++; if (!d.exp) A.home++; } });
    S.rooms.forEach((r) => {
      const T = ROOMS[r.type];
      A.count[r.type] = (A.count[r.type] || 0) + 1;
      if (T.cap) A.cap += T.cap[r.lvl - 1] * W(r);
      if (T.store) A.store += T.store[r.lvl - 1] * W(r);
      if (r.lvl === 3) A.lvl3++;
      if (r.type === "food" && workers(r).length >= slotsOf(r)) A.fullFood = 1;
    });
    return A;
  }

  // Бар поднимает настроение всем, пока в нём работают
  function barBonus() {
    let b = 0;
    S.rooms.forEach((r) => {
      const T = ROOMS[r.type];
      if (!T.mood) return;
      const ws = workers(r);
      if (!ws.length) return;
      const charm = ws.reduce((a, d) => a + eff(d, "cha"), 0) / ws.length;
      b += T.mood[r.lvl - 1] * W(r) * Math.min(1, ws.length / slotsOf(r)) * (0.6 + charm / 12);
    });
    return Math.min(25, b);
  }
  const count = (k, n = 1) => (S.c[k] = (S.c[k] || 0) + n);

  // ---------- Комнаты ----------
  function cycleTime(r) {
    const T = ROOMS[r.type], ws = workers(r);
    if (!ws.length || !T.time) return Infinity;
    if (r.type === "gym") {
      const avg = ws.reduce((a, d) => a + d.s[r.train || "str"], 0) / ws.length;
      return T.time * (0.6 + avg * 0.08);
    }
    const sum = ws.reduce((a, d) => a + eff(d, T.stat), 0) / W(r); // большая комната — больше людей, но и урожай больше
    const hap = ws.reduce((a, d) => a + d.hap, 0) / ws.length;
    return (T.time * 10) / (4 + sum) / (0.6 + hap / 125);
  }
  const buildCost = (type) => Math.round(ROOMS[type].cost * (1 + 0.5 * (agg().count[type] || 0)));
  const upgradeCost = (r) => Math.round(ROOMS[r.type].cost * UPGRADE_MULT[r.lvl] * W(r));
  const digCost = () => SHELTER.digCost * S.floors;

  function addRoom(type, f, c, lvl = 1) {
    const r = { id: S.id++, type, f, c, w: 1, lvl, prog: 0, ready: 0, train: "str", craft: "w" };
    S.rooms.push(r);
    return r;
  }

  // Одинаковые комнаты одного уровня, стоящие рядом, сливаются в одну большую (до 3 клеток)
  function tryMerge(r) {
    if (ROOMS[r.type].noMerge) return r;
    let merged = false;
    const absorb = (left, right) => {
      S.dw.forEach((d) => { if (d.room === right.id) d.room = left.id; });
      left.w = W(left) + W(right);
      left.ready += right.ready;
      left.prog = Math.max(left.prog, right.prog);
      S.rooms = S.rooms.filter((x) => x !== right);
      merged = true;
      return left;
    };
    const same = (x) => x && x !== r && x.type === r.type && x.lvl === r.lvl;
    let left = cellRoom(r.f, r.c - 1);
    if (same(left) && W(left) + W(r) <= SHELTER.cols) r = absorb(left, r);
    const right = cellRoom(r.f, r.c + W(r));
    if (same(right) && W(r) + W(right) <= SHELTER.cols) r = absorb(r, right);
    if (merged) {
      count("merge");
      toast(`🧱 Комнаты объединились: ${ROOMS[r.type].name} ×${W(r)}! Больше мест, урожай +10%`, "good");
      Sound.level();
    }
    return r;
  }

  // радио не зовёт новых людей, если их нечем кормить
  const lowSupplies = (A) => S.res.food < A.store * 0.25 || S.res.water < A.store * 0.25;

  // сколько урожая комната может накопить
  const readyCap = (r) => outOf(r) * SHELTER.maxBatches;
  const stores = (T) => T.res === "power" || T.res === "water" || T.res === "food" || T.res === "medkit";

  function complete(r, offline) {
    const T = ROOMS[r.type], ws = workers(r), out = outOf(r);
    if (T.res === "recruit") {
      const A = agg();
      if (A.pop >= A.cap || lowSupplies(A)) { r.prog = 1; return; } // ждёт свободной койки и запасов
      const legend = Math.random() < 0.12 && LEGENDS.find((L) => !S.dw.some((d) => d.n === L.n));
      const d = legend ? makeDweller(legend.n, legend.s, 3) : makeDweller(freeName(), randomStats());
      toast(legend ? `📻 По радио пришла знаменитость: ${d.n}!` : `📻 На позывные пришёл новый житель: ${d.n}`, "good");
      count("recruit");
      dirty = true;
    } else if (T.res === "train") {
      const k = r.train || "str";
      ws.forEach((d) => {
        if (d.s[k] < 10) { d.s[k]++; toast(`🏋️ ${d.n}: ${STATS[k].icon} ${STATS[k].name} → ${d.s[k]}`); }
      });
      count("train");
    } else if (T.res === "craft") {
      // мастерская: вещь выбранного вида, тем ценнее, чем выше уровень и Ум мастеров
      const skill = ws.reduce((a, d) => a + eff(d, "int"), 0) / Math.max(1, ws.length);
      for (let n = 0; n < W(r); n++) {
        const it = rollItem(r.lvl - 0.5 + skill / 6, r.craft || "w");
        S.inv.push(it);
        const info = itemInfo(it);
        toast(`🔧 Мастерская сделала: ${info.icon} ${info.name}`, "good");
      }
      count("craft");
    } else if (offline) {
      // пока игрока нет, жители уносят урожай на склад сами — с потерями
      const got = out * SHELTER.offlineEfficiency;
      if (T.res === "medkit") S.medkits = Math.min(SHELTER.medkitCap, S.medkits + Math.max(1, Math.floor(got)));
      else S.res[T.res] = Math.min(agg().store, S.res[T.res] + got);
    } else {
      r.ready = Math.min(readyCap(r), r.ready + out);
    }
    ws.forEach((d) => addXp(d, 4));
  }

  function collect(r, silent) {
    if (!r.ready) return 0;
    const T = ROOMS[r.type], A = agg();
    if (T.res === "medkit") S.medkits = Math.min(SHELTER.medkitCap, S.medkits + r.ready);
    else S.res[T.res] = Math.min(A.store, S.res[T.res] + r.ready);
    const bonus = Math.max(1, Math.round(r.ready / SHELTER.collectBonus));
    S.patrons += bonus;
    if (!silent) floatText(r, `+${r.ready}${RES_ICON[T.res]}  +${bonus}🔸`);
    r.ready = 0;
    count("collect");
    return bonus;
  }
  function collectAll() {
    let n = 0, got = 0;
    S.rooms.forEach((r) => { if (r.ready) { got += collect(r, false); n++; } });
    if (n) { Sound.coin(); haptic("success"); toast(`🧺 Собрано из ${n} комнат, +${got} 🔸`); }
  }

  function happyTarget(d, hungry, noPower, bar) {
    let t = 50 + bar;
    const r = d.room && roomById(d.room);
    if (!r) t = 35;
    else {
      const T = ROOMS[r.type];
      if (T.stat) {
        const v = eff(d, T.stat);
        t += v * 4;
        if (T.stat === bestStat(d)) t += 10;
      } else t += 10;
    }
    if (hungry) t -= 35;
    if (noPower) t -= 15;
    if (d.hp < d.mhp * 0.5) t -= 10;
    return clamp(t, 5, 100);
  }

  // ---------- Один шаг симуляции (dt секунд) ----------
  function step(dt, simNow, offline) {
    const A = agg();
    const eat = offline ? SHELTER.offlineConsumption : 1;
    S.res.food = Math.max(0, S.res.food - (A.home * SHELTER.foodPerDweller * eat * dt) / 60);
    S.res.water = Math.max(0, S.res.water - (A.home * SHELTER.waterPerDweller * eat * dt) / 60);
    const full = (r) => stores(ROOMS[r.type]) && r.ready >= readyCap(r);
    const busy = S.rooms.filter((r) => ROOMS[r.type].res && !full(r) && workers(r).length).length;
    const cells = S.rooms.reduce((a, r) => a + W(r), 0);
    S.res.power = Math.max(0, S.res.power - ((cells * SHELTER.powerPerRoom + busy * SHELTER.powerPerWorkRoom) * eat * dt) / 60);
    const noPower = S.res.power <= 0;
    const hungry = S.res.food <= 0 || S.res.water <= 0;
    const bar = barBonus();

    S.rooms.forEach((r) => {
      const T = ROOMS[r.type];
      if (!T.res || full(r)) return;
      if (noPower && r.type !== "power") return;
      if (S.inc && S.inc.room === r.id) return;
      const ct = cycleTime(r);
      if (!isFinite(ct)) return;
      r.prog += dt / ct;
      if (r.prog >= 1) { r.prog = 0; complete(r, offline); }
    });

    S.dw.forEach((d) => {
      if (d.dead || d.exp) return;
      d.hap += (happyTarget(d, hungry, noPower, bar) - d.hap) * Math.min(1, dt / 90);
      if (hungry) {
        if (!offline) { d.hp -= SHELTER.hungerDamage * dt; if (d.hp <= 0) die(d, "от голода и жажды"); }
      } else if (d.hp < d.mhp) {
        d.hp = Math.min(d.mhp, d.hp + d.mhp * 0.002 * dt);
      }
    });

    S.dw.forEach((d) => { if (d.exp && !d.dead) simExp(d, simNow); });

    // во время обучения — никаких случайных происшествий и гостей
    if (!offline && S.tut == null) { incidentStep(dt); guestStep(dt); }
    else if (!offline && S.inc) incidentStep(dt); // учебные крысы
  }

  // ---------- Вылазки ----------
  function elog(e, text) {
    e.log.push({ t: e.simT, text });
    if (e.log.length > 40) e.log.shift();
  }
  function sendExp(d, minutes, med) {
    const t = now();
    d.room = null;
    d.exp = { start: t, dur: minutes * 60000, simT: t, back: 0, backEnd: 0, arrive: 0, log: [], med,
              loot: { patrons: 0, food: 0, water: 0, items: [], boxes: 0 } };
    S.medkits -= med;
    elog(d.exp, `🚪 Выходит за ворота. С собой ${med} 💊.`);
    count("exped");
    Sound.click();
    dirty = true;
  }
  function startReturn(d, text) {
    const e = d.exp;
    if (e.back) return;
    e.back = e.simT;
    e.backEnd = e.simT + Math.max(60000, (e.simT - e.start) / 2);
    elog(e, text);
  }
  function recall(d) {
    simExp(d, now());
    startReturn(d, "📡 Получил приказ вернуться.");
  }
  function rollItem(danger, kind) {
    const pool = [];
    if (kind !== "w") Object.entries(OUTFITS).forEach(([id, it]) => { if (it.rare <= 1 + danger * 2) pool.push({ k: "o", id, w: 6 - it.rare }); });
    if (kind !== "o") Object.entries(WEAPONS).forEach(([id, it]) => { if (it.rare <= 1 + danger * 2) pool.push({ k: "w", id, w: 6 - it.rare }); });
    let x = Math.random() * pool.reduce((a, p) => a + p.w, 0);
    for (const p of pool) { x -= p.w; if (x <= 0) return { k: p.k, id: p.id }; }
    return pool[0];
  }
  const itemInfo = (it) => (it.k === "o" ? OUTFITS[it.id] : WEAPONS[it.id]);

  function expEvent(d, e, minute) {
    const danger = 1 + minute / 90;
    const r = Math.random();
    if (r < 0.35) {
      const p = irnd(2, 6) + Math.floor(eff(d, "per") / 3);
      e.loot.patrons += p;
      elog(e, `🔸 Нашёл ${p} патронов в ${pick(EXPEDITION.places)}.`);
    } else if (r < 0.45) {
      const k = Math.random() < 0.5 ? "food" : "water", n = irnd(3, 8);
      e.loot[k] += n;
      elog(e, `${RES_ICON[k]} Нашёл припасы: +${n}.`);
    } else if (r < 0.57) {
      const enemy = pick(EXPEDITION.enemies);
      const dmg = Math.max(1, Math.round(rnd(6, 16) * danger - eff(d, "end") * 0.8 - weaponPower(d) * 0.5));
      d.hp -= dmg;
      addXp(d, 6);
      let txt = `⚔️ ${enemy}! −${dmg} здоровья.`;
      if (Math.random() < 0.4) { const p = irnd(3, 10); e.loot.patrons += p; txt += ` Трофей: ${p} 🔸.`; }
      elog(e, txt);
      if (d.hp <= 0) { elog(e, "☠️ Не выжил..."); die(d, "на вылазке"); return; }
      if (d.hp < d.mhp * 0.35) {
        if (e.med > 0) { e.med--; d.hp = Math.min(d.mhp, d.hp + d.mhp * 0.5); elog(e, "💊 Использовал аптечку."); }
        else startReturn(d, "🩸 Тяжело ранен — поворачивает домой.");
      }
    } else if (r < 0.57 + 0.02 * Math.min(3, danger)) {
      const it = rollItem(danger);
      e.loot.items.push(it);
      const info = itemInfo(it);
      elog(e, `🎁 Находка: ${info.icon} ${info.name}!`);
    } else if (r < 0.6 && minute > 20 && Math.random() < 0.3) {
      e.loot.boxes++;
      elog(e, "📦 Нашёл ящик с припасами!");
    } else if (Math.random() < 0.25) {
      elog(e, pick(EXPEDITION.flavor));
    }
  }
  function simExp(d, t) {
    const e = d.exp;
    while (!e.arrive && !d.dead && e.simT + 60000 <= t) {
      e.simT += 60000;
      if (e.back) {
        if (e.simT >= e.backEnd) { e.arrive = e.simT; elog(e, "🏠 Добрался до ворот убежища!"); toast(`🎒 ${d.n} вернулся с вылазки`, "good"); }
        continue;
      }
      expEvent(d, e, (e.simT - e.start) / 60000);
      if (!d.dead && e.simT - e.start >= e.dur) startReturn(d, "⏱️ Время вышло — поворачивает домой.");
    }
  }
  function claimExp(d) {
    const L = d.exp.loot, A = agg();
    S.patrons += L.patrons;
    S.res.food = Math.min(A.store, S.res.food + L.food);
    S.res.water = Math.min(A.store, S.res.water + L.water);
    S.medkits = Math.min(SHELTER.medkitCap, S.medkits + d.exp.med);
    L.items.forEach((it) => S.inv.push(it));
    S.boxes += L.boxes;
    toast(`🎒 ${d.n}: +${L.patrons} 🔸${L.items.length ? `, вещей: ${L.items.length}` : ""}${L.boxes ? `, 📦 ×${L.boxes}` : ""}`, "good");
    d.exp = null;
    count("expedDone");
    Sound.win();
    dirty = true;
  }

  // ---------- Происшествия ----------
  function startIncident() {
    S.nextInc = rnd(SHELTER.incidentEvery[0], SHELTER.incidentEvery[1]);
    const types = ["rats", "rats", "fire", "raid"];
    const type = pick(types), I = INCIDENTS[type];
    let candidates;
    if (I.where === "entrance") candidates = S.rooms.filter((r) => r.type === "entrance");
    else if (I.where === "work") candidates = S.rooms.filter((r) => ROOMS[r.type].res && workers(r).length);
    else candidates = S.rooms.filter((r) => workers(r).length);
    if (!candidates.length) candidates = S.rooms;
    const r = pick(candidates);
    const scale = 1 + agg().pop / 30;
    S.inc = { type, room: r.id, hp: I.hp * scale, max: I.hp * scale, t: 0, scale };
    toast(`🚨 ${I.icon} ${I.name}: ${ROOMS[r.type].name}! Нажми на комнату, чтобы помочь.`, "bad");
    Sound.hurt();
    haptic("warning");
  }
  function incidentStep(dt) {
    if (!S.inc) {
      S.nextInc -= dt;
      if (S.nextInc <= 0 && S.rooms.length) startIncident();
      return;
    }
    const I = INCIDENTS[S.inc.type], r = roomById(S.inc.room);
    if (!r) { S.inc = null; return; }
    S.inc.t += dt;
    const ws = workers(r);
    ws.forEach((d) => {
      S.inc.hp -= (1 + eff(d, "str") * 0.35 + weaponPower(d) * 0.5) * dt;
      d.hp -= I.dps * S.inc.scale * dt * Math.max(0.3, 1 - eff(d, "end") * 0.05);
      if (d.hp <= 0) die(d, `— ${I.name.toLowerCase()} в комнате «${ROOMS[r.type].name}»`);
    });
    // караульные прибегают на помощь: бьют слабее, зато и достаётся им меньше
    if (S.inc.t > 3) S.rooms.filter((g) => g.type === "guard" && g !== r).forEach((g) => workers(g).forEach((d) => {
      S.inc.hp -= (0.8 + eff(d, "str") * 0.3 + weaponPower(d) * 0.4) * dt;
      d.hp -= I.dps * S.inc.scale * dt * 0.3;
      if (d.hp <= 0) die(d, `в бою: ${I.name.toLowerCase()}`);
    }));
    if (S.inc.hp <= 0) winIncident();
    else if (S.inc.t > 45) failIncident();
  }
  function winIncident() {
    const I = INCIDENTS[S.inc.type], r = roomById(S.inc.room);
    const reward = Math.round(irnd(20, 45) * S.inc.scale);
    S.patrons += reward;
    if (r) workers(r).forEach((d) => addXp(d, 10));
    toast(`🏆 ${I.name} — отбились! +${reward} 🔸`, "good");
    S.inc = null;
    count("incident");
    Sound.win();
    haptic("success");
  }
  function failIncident() {
    const I = INCIDENTS[S.inc.type];
    Object.entries(I.penalty).forEach(([k, part]) => {
      if (k === "patrons") S.patrons = Math.floor(S.patrons * (1 - part));
      else S.res[k] = S.res[k] * (1 - part);
    });
    toast(`💔 ${I.fail}.`, "bad");
    S.inc = null;
    Sound.hurt();
  }
  function heroHit() {
    if (!S.inc) return;
    const t = now() / 1000;
    if (t - heroTapAt < SHELTER.heroTapCooldown) return;
    heroTapAt = t;
    const dmg = 6 + hero.lvl * 2;
    S.inc.hp -= dmg;
    const r = roomById(S.inc.room);
    if (r) floatText(r, `👊 −${dmg}`);
    Sound.hit();
    haptic("light");
    if (S.inc.hp <= 0) winIncident();
    tickUI();
  }

  // ---------- Гости у ворот ----------
  function guestStep(dt) {
    if (S.guest) {
      if (now() > S.guest.until) { S.guest = null; toast("🚶 Гость у ворот не дождался и ушёл."); }
      return;
    }
    S.nextGuest -= dt;
    if (S.nextGuest > 0) return;
    S.nextGuest = rnd(SHELTER.eventEvery[0], SHELTER.eventEvery[1]);
    const type = pick(["refugees", "refugees", "trader", "trader", "radio"]);
    S.guest = { type, until: now() + 180000 };
    if (type === "refugees") S.guest.n = irnd(1, 3);
    if (type === "trader") S.guest.item = rollItem(2);
    if (type === "radio") S.guest.text = pick(LORE);
    toast(type === "refugees" ? "🔔 У ворот беженцы просятся внутрь" : type === "trader" ? "🔔 К воротам пришёл торговец" : "📻 Радио поймало странный сигнал", "good");
    Sound.coin();
  }

  // ---------- Задания ----------
  function questProgress(q, A) {
    return typeof q.counter === "function" ? q.counter(S, A) : S.c[q.counter] || 0;
  }
  function activeQuests() {
    return QUESTS.filter((q) => !S.qDone.includes(q.id)).slice(0, 3);
  }
  function claimQuest(q) {
    S.qDone.push(q.id);
    if (q.reward.patrons) S.patrons += q.reward.patrons;
    if (q.reward.box) S.boxes += q.reward.box;
    toast(`📜 Задание выполнено! ${q.reward.patrons ? `+${q.reward.patrons} 🔸 ` : ""}${q.reward.box ? `📦 ×${q.reward.box}` : ""}`, "good");
    Sound.level();
    haptic("success");
    save();
    render();
  }
  function openBox() {
    if (S.boxes <= 0) return;
    S.boxes--;
    const A = agg();
    const x = Math.random();
    let title, text;
    const legend = LEGENDS.find((L) => !S.dw.some((d) => d.n === L.n));
    if (x < 0.06 && legend && A.pop < A.cap) {
      const d = makeDweller(legend.n, legend.s, 3);
      title = "⭐ Знаменитость!"; text = `К вам присоединяется ${d.n}. У неё/него отличные характеристики.`;
    } else if (x < 0.3) {
      const it = rollItem(3); S.inv.push(it);
      const info = itemInfo(it);
      title = `${info.icon} ${info.name}`; text = it.k === "o" ? "Новая одежда — надень её на жителя." : "Новое оружие — выдай его жителю.";
    } else if (x < 0.45) {
      S.medkits = Math.min(SHELTER.medkitCap, S.medkits + 3);
      title = "💊 Аптечки ×3"; text = "Пригодятся на вылазках.";
    } else if (x < 0.7) {
      ["power", "water", "food"].forEach((k) => (S.res[k] = Math.min(A.store, S.res[k] + 40)));
      title = "🧺 Припасы"; text = "+40 ⚡, +40 💧, +40 🍄";
    } else {
      const p = irnd(80, 200); S.patrons += p;
      title = `🔸 ${p} патронов`; text = "Целая коробка!";
    }
    Sound.level();
    haptic("success");
    dirty = true;
    save();
    openSheet("📦 Ящик открыт", h("div", { class: "sh-box-reveal" }, h("div", { class: "sh-box-big" }, title), h("p", null, text),
      S.boxes > 0 ? h("button", { class: "choice attack", onclick: openBox }, `📦 Открыть ещё (${S.boxes})`) : null,
      h("button", { class: "choice", onclick: closeSheet }, "Отлично")));
  }

  // ---------- Действия игрока ----------
  function assign(d, r) {
    if (d.dead || d.exp) return;
    if (r && workers(r).length >= slotsOf(r)) { toast("Здесь нет свободных мест"); return; }
    d.room = r ? r.id : null;
    Sound.click();
    dirty = true;
    save();
  }
  function build(type, f, c) {
    const cost = buildCost(type), T = ROOMS[type];
    if (S.patrons < cost) { toast("Не хватает патронов"); return; }
    if (T.needPop && agg().pop < T.needPop) { toast(`Нужно ${T.needPop} жителей`); return; }
    S.patrons -= cost;
    count("build");
    Sound.boom();
    haptic("success");
    toast(`🏗️ Построено: ${T.icon} ${T.name}`, "good");
    tryMerge(addRoom(type, f, c));
    closeSheet();
    dirty = true;
    save();
    render();
  }
  function upgrade(r) {
    const cost = upgradeCost(r);
    if (r.lvl >= 3 || S.patrons < cost) return;
    S.patrons -= cost;
    r.lvl++;
    count("upgrade");
    Sound.level();
    toast(`⬆️ ${ROOMS[r.type].name}: уровень ${r.lvl}`, "good");
    r = tryMerge(r); // соседняя такая же комната того же уровня — сольются
    dirty = true;
    save();
    openRoom(r);
  }
  function dig() {
    const cost = digCost();
    if (S.patrons < cost) { toast("Не хватает патронов"); return; }
    S.patrons -= cost;
    S.floors++;
    count("dig");
    Sound.boom();
    toast(`⛏️ Выкопан этаж −${S.floors}`, "good");
    dirty = true;
    save();
    render();
  }

  // ---------- Сохранение ----------
  function save() {
    if (!S) return;
    S.last = now();
    storeBigSet(KEY, S);
    lastSave = now();
  }

  // ---------- Новое убежище ----------
  function create(from) {
    S = {
      v: 1, id: 1, created: now(), last: now(),
      res: { power: 70, water: 70, food: 70 },
      patrons: Math.min(500, ((from && from.patrons) || 0) + 200),
      medkits: 3, floors: SHELTER.startFloors, rooms: [], dw: [], inv: [{ k: "o", id: "robe" }, { k: "w", id: "pipe" }],
      c: {}, qDone: [], boxes: 1,
      nextInc: SHELTER.firstIncidentAfter, nextGuest: 300, inc: null, guest: null,
      hero: { lvl: (from && from.level) || 5 }, welcomed: false,
    };
    addRoom("entrance", 0, 0);
    const pw = addRoom("power", 0, 1), wt = addRoom("water", 0, 2);
    const fd = addRoom("food", 1, 0);
    addRoom("living", 1, 1);
    const crew = [LEGENDS[0], LEGENDS[1]];
    if (from && from.flags && from.flags.lisa) crew.push(LEGENDS[2]);
    crew.forEach((L) => makeDweller(L.n, L.s, 3));
    while (S.dw.length < 10) makeDweller(freeName(), randomStats());
    // часть людей уже при деле, остальных расставит игрок
    const take = (stat, room, n) => {
      S.dw.filter((d) => !d.room).sort((a, b) => b.s[stat] - a.s[stat]).slice(0, n).forEach((d) => (d.room = room.id));
    };
    take("str", pw, 2);
    take("per", wt, 2);
    take("agi", fd, 1);
  }

  // ---------- «Пока тебя не было» ----------
  function catchUp() {
    const t = now();
    const elapsed = (t - S.last) / 1000;
    if (elapsed < 20) { S.last = t; return null; }
    const sim = Math.min(elapsed, SHELTER.offlineMaxHours * 3600);
    const before = { food: S.res.food, water: S.res.water, power: S.res.power, pop: agg().pop };
    quiet = true;
    let simNow = t - sim * 1000;
    for (let s = 0; s < sim; s += 10) {
      const dt = Math.min(10, sim - s);
      simNow += dt * 1000;
      step(dt, simNow, true);
    }
    S.dw.forEach((d) => { if (d.exp && !d.dead) simExp(d, t); });
    quiet = false;
    S.last = t;
    return {
      elapsed, sim,
      ready: S.rooms.filter((r) => r.ready).length,
      food: S.res.food - before.food, water: S.res.water - before.water, power: S.res.power - before.power,
      back: S.dw.filter((d) => d.exp && d.exp.arrive).map((d) => d.n),
      recruits: agg().pop - before.pop,
    };
  }
  function showAway(sum) {
    if (!sum || sum.elapsed < 60) return;
    const sign = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
    openSheet("🌙 Пока тебя не было", h("div", null,
      h("p", null, `Прошло ${fmtTime(sum.elapsed)}${sum.elapsed > sum.sim ? ` (учтено ${SHELTER.offlineMaxHours} ч)` : ""}.`),
      h("div", { class: "sh-away" },
        h("div", null, `⚡ ${sign(sum.power)}   💧 ${sign(sum.water)}   🍄 ${sign(sum.food)}`),
        sum.ready ? h("div", null, `🧺 Урожай ждёт сбора в ${sum.ready} комнатах`) : null,
        sum.recruits > 0 ? h("div", null, `📻 Новых жителей: ${sum.recruits}`) : null,
        sum.back.length ? h("div", null, `🎒 Вернулись с вылазок: ${sum.back.join(", ")}`) : null),
      h("button", { class: "choice attack", onclick: () => { collectAll(); closeSheet(); } }, "🧺 Собрать всё"),
      h("button", { class: "choice ghost", onclick: closeSheet }, "Закрыть")));
  }

  // ---------- Главный цикл ----------
  function tick() {
    const t = now();
    let dt = (t - lastReal) / 1000;
    lastReal = t;
    if (dt > 5) { const sum = catchUp(); showAway(sum); render(); return; }
    step(dt, t, false);
    S.last = t;
    if (t - lastSave > 10000) save();
    Sound.setMood(S.inc ? "fight" : "calm");
    if (dirty && tab === "vault") renderVault();
    else if (tab !== "vault" && t - lastTabRender > 2000 && byId("sh-sheet").hidden) render();
    tickUI();
    tutTick();
  }

  // ---------- Интерфейс: каркас ----------
  function buildShell() {
    const root = byId("shelter");
    root.innerHTML = "";
    const resChip = (k, icon) => h("div", { class: "sh-res", id: `sh-r-${k}` },
      h("div", { class: "sh-res-row" }, h("span", null, icon), h("b", { id: `sh-v-${k}` })),
      h("div", { class: "bar" }, h("div", { id: `sh-b-${k}` })));
    root.append(
      h("div", { class: "sh-top" },
        h("div", { class: "sh-res-line" }, resChip("power", "⚡"), resChip("water", "💧"), resChip("food", "🍄")),
        h("div", { class: "sh-meta" },
          h("span", null, "🔸 ", h("b", { id: "sh-patrons" })),
          h("span", null, "💊 ", h("b", { id: "sh-med" })),
          h("span", null, "👥 ", h("b", { id: "sh-pop" })),
          h("span", null, h("b", { id: "sh-hap" })),
          h("button", { id: "sh-collect", class: "small", hidden: true, onclick: collectAll }, "🧺"))),
      h("div", { id: "sh-alert", hidden: true }),
      h("div", { id: "sh-body" }),
      h("nav", { class: "sh-nav" },
        ...[["vault", "🏠", "Убежище"], ["people", "👥", "Жители"], ["exp", "🎒", "Вылазки"], ["quests", "📜", "Задания"], ["menu", "⚙️", "Меню"]]
          .map(([id, icon, label]) => h("button", { id: `sh-tab-${id}`, onclick: () => { tab = id; Sound.click(); render(); } },
            h("span", null, icon), h("small", null, label), h("i", { class: "sh-dot", id: `sh-dot-${id}`, hidden: true })))),
      h("div", { id: "sh-sheet", hidden: true, onclick: (e) => { if (e.target.id === "sh-sheet" && S.tut == null) closeSheet(); } }),
      h("div", { id: "sh-toasts" }),
      // слой обучения: затемнение с «окошком» над нужной кнопкой
      h("div", { id: "sh-tut", hidden: true },
        ...["t", "l", "r", "b", "c"].map((k) => h("div", { id: `sh-tut-${k}`, class: "tut-block" })),
        h("div", { id: "sh-tut-hole" }),
        h("div", { id: "sh-tut-bubble" })));
    // общие узоры и градиенты для рисунков комнат
    if (!byId("sa-defs")) {
      const defs = h("div", { id: "sa-defs" });
      defs.innerHTML = SHELTER_ART.DEFS;
      document.body.append(defs);
    }
  }
  window.addEventListener("scroll", () => { if (S && S.tut != null) tutPosition(); }, { passive: true });
  window.addEventListener("resize", () => { if (S && S.tut != null) tutPosition(); });

  // key — какое окно открыто (нужно обучению, чтобы понять, что игрок сделал нужный шаг)
  let sheetKey = null;
  function openSheet(title, body, key) {
    const root = byId("sh-sheet");
    root.innerHTML = "";
    root.append(h("div", { class: "sheet sh-sheetbox" },
      h("div", { class: "sh-sheet-head" }, h("h2", null, title), h("button", { class: "sh-x", onclick: closeSheet }, "✕")),
      body));
    root.hidden = false;
    sheetKey = key || title;
  }
  function closeSheet() { byId("sh-sheet").hidden = true; sheetKey = null; render(); }

  function toast(text, kind) {
    if (quiet) return;
    const box = byId("sh-toasts");
    if (!box) return;
    const t = h("div", { class: "sh-toast " + (kind || "") }, text);
    box.append(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add("out"), 2800);
    setTimeout(() => t.remove(), 3300);
  }
  function floatText(r, text) {
    const ref = refs[r.id];
    if (!ref || quiet) return;
    const f = h("div", { class: "sh-float" }, text);
    ref.node.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  // ---------- Обновление цифр (каждые 0.25 с) ----------
  function tickUI() {
    if (!S) return;
    const A = agg();
    ["power", "water", "food"].forEach((k) => {
      byId(`sh-v-${k}`).textContent = `${fmt(S.res[k])}/${fmt(A.store)}`;
      byId(`sh-b-${k}`).style.width = (100 * S.res[k]) / A.store + "%";
      byId(`sh-r-${k}`).classList.toggle("low", S.res[k] < A.store * 0.15);
    });
    byId("sh-patrons").textContent = fmt(S.patrons);
    byId("sh-med").textContent = S.medkits;
    byId("sh-pop").textContent = `${A.pop}/${A.cap}`;
    const home = atHome();
    const hap = home.length ? home.reduce((a, d) => a + d.hap, 0) / home.length : 0;
    byId("sh-hap").textContent = `${hap >= 70 ? "😊" : hap >= 45 ? "😐" : "😟"} ${Math.round(hap)}%`;
    const ready = S.rooms.filter((r) => r.ready).length;
    const cb = byId("sh-collect");
    cb.hidden = ready < 2;
    cb.textContent = `🧺 ${ready}`;

    // плашка тревоги / гостя
    const al = byId("sh-alert");
    if (S.inc) {
      const I = INCIDENTS[S.inc.type], r = roomById(S.inc.room);
      al.hidden = false;
      al.className = "sh-alert bad";
      al.innerHTML = "";
      al.append(h("div", null, `${I.icon} ${I.name} — ${r ? ROOMS[r.type].name : ""}! Жми на комнату, чтобы помочь (${Math.max(0, Math.ceil(45 - S.inc.t))} с)`),
        h("div", { class: "bar" }, h("div", { style: `width:${(100 * Math.max(0, S.inc.hp)) / S.inc.max}%;background:var(--red)` })));
      al.onclick = () => { tab = "vault"; render(); };
    } else if (S.guest) {
      al.hidden = false;
      al.className = "sh-alert good";
      al.textContent = S.guest.type === "radio" ? "📻 Радио поймало сигнал — послушать" : `🔔 У ворот гость — ${S.guest.type === "trader" ? "торговец" : "беженцы"} (${fmtTime((S.guest.until - now()) / 1000)})`;
      al.onclick = openGuest;
    } else al.hidden = true;

    // точки-подсказки на вкладках
    byId("sh-dot-exp").hidden = !S.dw.some((d) => d.exp && (d.exp.arrive || d.dead));
    byId("sh-dot-quests").hidden = !(S.boxes > 0 || activeQuests().some((q) => questProgress(q, A) >= q.need));
    byId("sh-dot-people").hidden = !S.dw.some((d) => !d.dead && !d.exp && !d.room);
    ["vault", "people", "exp", "quests", "menu"].forEach((id) => byId(`sh-tab-${id}`).classList.toggle("on", tab === id));

    if (tab !== "vault") return;
    S.rooms.forEach((r) => {
      const ref = refs[r.id];
      if (!ref) return;
      const T = ROOMS[r.type];
      const inc = S.inc && S.inc.room === r.id;
      ref.node.classList.toggle("ready", !!r.ready);
      ref.node.classList.toggle("alert", !!inc);
      ref.node.classList.toggle("dark", S.res.power <= 0 && r.type !== "power");
      if (ref.bar) ref.bar.style.width = (stores(T) && r.ready >= readyCap(r) ? 100 : r.prog * 100) + "%";
      ref.bubble.textContent = inc ? `${INCIDENTS[S.inc.type].icon} 👊` : r.ready ? `+${r.ready}${RES_ICON[T.res]}` : "";
      ref.bubble.hidden = !inc && !r.ready;
    });
  }

  // ---------- Вкладки ----------
  function render() {
    if (!S) return;
    lastTabRender = now();
    if (tab === "vault") return renderVault();
    const body = byId("sh-body");
    const y = window.scrollY;
    body.innerHTML = "";
    if (tab === "people") body.append(renderPeople());
    if (tab === "exp") body.append(renderExp());
    if (tab === "quests") body.append(renderQuests());
    if (tab === "menu") body.append(renderMenu());
    window.scrollTo(0, y);
    tickUI();
  }

  function avatar(d, i, n = 3) {
    const step = 84 / Math.max(3, n);
    const a = h("span", { class: `dw c${d.col}${d.dead ? " dead" : ""}`, title: d.n,
      style: `left:${6 + i * step}%;animation-delay:-${(d.id % 7) * 0.7}s;animation-duration:${4 + (d.id % 4)}s` });
    if (d.dead) a.textContent = "💀";
    return a;
  }

  function renderVault() {
    const body = byId("sh-body");
    body.innerHTML = "";
    refs = {};
    const surface = h("div", { class: "sh-surface" });
    surface.innerHTML = SHELTER_ART.surface();
    surface.append(h("div", { class: "sh-surface-label" }, h("span", null, "☢️ Поверхность"), h("span", null, `👥 ${agg().pop} · этажей ${S.floors}`)));

    // шахта лифта слева; кабина ездит между этажами
    const floors = h("div", { class: "sh-floors" });
    const shaft = h("div", { class: "sh-shaft" }, h("div", { class: "sh-cabin", style: `--floors:${S.floors};animation-duration:${4 + S.floors * 3}s` }, h("span", { class: `dw c${(S.id % 8)}` })));
    floors.append(shaft);
    for (let f = 0; f < S.floors; f++) {
      const row = h("div", { class: "floor" }, h("div", { class: "floor-n" }, `−${f + 1}`));
      for (let c = 0; c < SHELTER.cols; c++) {
        const r = cellRoom(f, c);
        if (r && r.c !== c) continue; // клетка занята широкой комнатой слева
        row.append(r ? roomEl(r) : h("button", { class: "cell-empty", "data-tut": "empty", onclick: () => openBuild(f, c) }, h("span", null, "➕"), h("small", null, "построить")));
      }
      floors.append(row);
    }
    const v = h("div", { class: "vault" }, surface, floors);
    const rails = h("div", { class: "sh-rails" });
    rails.innerHTML = SHELTER_ART.rails();
    if (S.floors < SHELTER.maxFloors) {
      v.append(h("button", { class: "sh-dig", onclick: dig, disabled: S.patrons < digCost() },
        `⛏️ Выкопать этаж −${S.floors + 1} · ${fmt(digCost())} 🔸`));
    }
    v.append(rails);
    body.append(v);
    dirty = false;
    tickUI();
  }

  function roomShort(r) {
    const T = ROOMS[r.type];
    if (r.type === "entrance") return `охрана ${workers(r).length}/${slotsOf(r)}`;
    if (T.cap) return `🛏️ ${T.cap[r.lvl - 1] * W(r)} мест`;
    if (T.store) return `📦 +${T.store[r.lvl - 1] * W(r)}`;
    if (T.mood) return workers(r).length ? `😊 +${Math.round(barBonus())}% всем` : "😴 нет бармена";
    if (r.type === "guard") return `🛡️ караул ${workers(r).length}/${slotsOf(r)}`;
    return "";
  }
  function roomEl(r) {
    const T = ROOMS[r.type];
    const people = h("div", { class: "room-people" });
    const ws = S.dw.filter((d) => d.room === r.id && !d.exp);
    ws.forEach((d, i) => people.append(avatar(d, i, ws.length)));
    const bar = T.res ? h("div", { class: "room-bar" }, h("i")) : null;
    const bubble = h("div", { class: "bubble", hidden: true });
    const art = h("div", { class: "room-art-wrap" });
    art.innerHTML = SHELTER_ART.room(r.type, r.lvl, W(r));
    const node = h("div", { class: `room t-${r.type} lvl${r.lvl}`, style: W(r) > 1 ? `grid-column: span ${W(r)}` : null,
      "data-tut": `room-${r.type}`, onclick: () => roomTap(r) },
      art,
      h("div", { class: "room-head" }, h("span", null, `${T.icon} ${T.name}${W(r) > 1 ? ` ×${W(r)}` : ""}`), h("b", { class: "lvl" }, ROMAN[r.lvl])),
      people,
      bar || h("div", { class: "room-info" }, roomShort(r)),
      bubble);
    refs[r.id] = { node, bar: bar && bar.firstChild, bubble };
    return node;
  }
  function roomTap(r) {
    if (S.inc && S.inc.room === r.id) { heroHit(); return; }
    if (r.ready) { collect(r); Sound.coin(); haptic("light"); tickUI(); save(); return; }
    openRoom(r);
  }

  // ---------- Окно комнаты ----------
  function openRoom(r) {
    const T = ROOMS[r.type];
    const ws = workers(r);
    const parts = [h("p", { class: "muted" }, T.desc)];
    if (W(r) > 1) parts.push(h("p", { class: "sh-merged" }, `🧱 Объединённая комната: ${W(r)} клетки, мест ${slotsOf(r) || "—"}${T.res ? ", урожай +10%" : ""}`));
    if (T.res) {
      const ct = cycleTime(r);
      const what = T.res === "recruit" ? "новый житель" : T.res === "train" ? `+1 к характеристике` :
        T.res === "craft" ? `${W(r)} ${r.craft === "o" ? "одежда" : "оружие"}` : `+${outOf(r)} ${RES_ICON[T.res]}`;
      parts.push(h("div", { class: "sh-info" },
        h("div", null, `За цикл: ${what}`),
        h("div", null, isFinite(ct) ? `Цикл: ${fmtTime(ct)} (осталось ${fmtTime(ct * (1 - r.prog))})` : "Нет работников — комната стоит"),
        T.stat ? h("div", null, `Работу ускоряет: ${STATS[T.stat].icon} ${STATS[T.stat].name}`) : null,
        T.res === "recruit" && agg().pop >= agg().cap ? h("div", { class: "warn" }, "⏸️ Нет свободных коек — построй или улучши Жилой отсек") : null,
        T.res === "recruit" && lowSupplies(agg()) ? h("div", { class: "warn" }, "⏸️ Радио молчит: еды или воды меньше четверти запаса") : null));
    } else parts.push(h("div", { class: "sh-info" }, roomShort(r),
      T.mood ? h("div", { class: "muted" }, "Чем больше барменов и чем выше их 🗣️ Обаяние, тем лучше настроение. Бары складываются (до +25%).") : null,
      r.type === "guard" ? h("div", { class: "muted" }, "Караульные с высокой 💪 Силой и хорошим оружием быстрее гасят любые происшествия.") : null));

    if (r.type === "workshop") {
      parts.push(h("div", { class: "sh-label" }, "Что мастерим:"),
        h("div", { class: "sh-stat-pick" },
          ...[["w", "🔫 Оружие"], ["o", "👕 Одежду"]].map(([k, label]) =>
            h("button", { class: "small" + (r.craft === k ? " on" : ""), onclick: () => { r.craft = k; save(); openRoom(r); } }, label))));
    }

    if (r.type === "gym") {
      parts.push(h("div", { class: "sh-label" }, "Что тренируем:"),
        h("div", { class: "sh-stat-pick" }, ...Object.entries(STATS).map(([k, st]) =>
          h("button", { class: "small" + (r.train === k ? " on" : ""), onclick: () => { r.train = k; r.prog = 0; save(); openRoom(r); } }, `${st.icon} ${st.name}`))));
    }

    if (T.slots) {
      parts.push(h("div", { class: "sh-label" }, `Работники ${ws.length}/${slotsOf(r)}`));
      ws.forEach((d) => parts.push(h("div", { class: "sh-row" },
        h("span", null, `${d.n} · ур. ${d.lvl}`),
        T.stat || r.type === "gym" ? h("span", { class: "muted" }, `${STATS[T.stat || r.train].icon} ${eff(d, T.stat || r.train)}`) : null,
        h("button", { class: "small ghost-btn", onclick: () => { assign(d, null); openRoom(r); } }, "убрать"))));
      if (ws.length < slotsOf(r)) parts.push(h("button", { class: "choice", "data-tut": "assign", onclick: () => pickDweller(r) }, "➕ Назначить жителя"));
    }
    if (r.lvl < 3 && !T.fixed) {
      const cost = upgradeCost(r);
      parts.push(h("button", { class: "choice attack", disabled: S.patrons < cost, onclick: () => upgrade(r) },
        `⬆️ Улучшить до ${ROMAN[r.lvl + 1]} · ${fmt(cost)} 🔸`));
    }
    if (!T.noMerge && W(r) < SHELTER.cols) parts.push(h("p", { class: "muted" }, "💡 Построй рядом такую же комнату того же уровня — они объединятся."));
    openSheet(`${T.icon} ${T.name}${W(r) > 1 ? ` ×${W(r)}` : ""} ${ROMAN[r.lvl]}`, h("div", null, ...parts), `room:${r.type}`);
  }

  function pickDweller(r) {
    const T = ROOMS[r.type];
    const k = T.stat || r.train || "end";
    const list = atHome().filter((d) => d.room !== r.id).sort((a, b) => eff(b, k) - eff(a, k));
    openSheet(`Кого назначить: ${T.name}`, h("div", null,
      h("p", { class: "muted" }, `Сортировка по: ${STATS[k].icon} ${STATS[k].name}`),
      ...list.map((d) => {
        const cur = d.room ? roomById(d.room) : null;
        return h("button", { class: "sh-pick", onclick: () => { assign(d, r); openRoom(r); } },
          h("span", null, `${d.n} · ур. ${d.lvl}`),
          h("span", { class: "muted" }, cur ? `${ROOMS[cur.type].icon} ${ROOMS[cur.type].name}` : "без работы"),
          h("b", null, `${STATS[k].icon} ${eff(d, k)}`));
      }),
      list.length ? null : h("p", null, "Все жители уже здесь или на вылазках."),
      h("button", { class: "choice ghost", onclick: () => openRoom(r) }, "← Назад")), "pick");
  }

  function openBuild(f, c) {
    const A = agg();
    const items = Object.entries(ROOMS).filter(([, T]) => !T.fixed).map(([type, T]) => {
      const cost = buildCost(type);
      const locked = T.needPop && A.pop < T.needPop;
      // подсказка: такая же комната рядом — значит, после стройки они объединятся
      const nb = [cellRoom(f, c - 1), cellRoom(f, c + 1)].find((x) => x && x.type === type && x.lvl === 1 && !T.noMerge && W(x) < SHELTER.cols);
      return h("button", { class: "sh-build", "data-tut": `build-${type}`, disabled: locked || S.patrons < cost, onclick: () => build(type, f, c) },
        h("div", { class: "sh-build-icon" }, T.icon),
        h("div", null, h("b", null, T.name, nb ? h("span", { class: "sh-merge-tag" }, " 🧱 объединится") : null),
          h("div", { class: "muted" }, locked ? `🔒 нужно ${T.needPop} жителей` : T.desc)),
        h("div", { class: "sh-cost" }, `${fmt(cost)} 🔸`));
    });
    openSheet(`🏗️ Стройка на этаже −${f + 1}`, h("div", null, ...items), "build");
  }

  // ---------- Жители ----------
  function renderPeople() {
    const list = [...S.dw].sort((a, b) => (a.dead - b.dead) || ((a.room ? 1 : 0) - (b.room ? 1 : 0)) || b.lvl - a.lvl);
    const A = agg();
    return h("div", { class: "sh-list" },
      h("div", { class: "sh-label" }, `Жителей: ${A.pop} из ${A.cap} мест · без работы: ${atHome().filter((d) => !d.room).length}`),
      ...list.map((d) => {
        const r = d.room && roomById(d.room);
        const where = d.dead ? "☠️ погиб" : d.exp ? "🎒 на вылазке" : r ? `${ROOMS[r.type].icon} ${ROOMS[r.type].name}` : "💤 без работы";
        return h("button", { class: "sh-person" + (d.dead ? " dead" : ""), onclick: () => openDweller(d) },
          h("div", { class: "sh-person-top" }, h("b", null, `${d.n}`), h("span", { class: "muted" }, `ур. ${d.lvl}`), h("span", null, where)),
          h("div", { class: "bar" }, h("div", { style: `width:${(100 * d.hp) / d.mhp}%;background:var(--red)` })),
          h("div", { class: "sh-stats-mini" }, ...Object.entries(STATS).map(([k, st]) => h("span", { class: k === bestStat(d) ? "best" : "" }, `${st.icon}${eff(d, k)}`))));
      }));
  }

  function openDweller(d) {
    const r = d.room && roomById(d.room);
    const parts = [
      h("div", { class: "sh-row" }, h("span", null, `❤️ ${Math.round(d.hp)}/${d.mhp}`), h("span", null, `😊 ${Math.round(d.hap)}%`), h("span", null, `✨ ${d.xp}/${d.lvl * 20}`)),
      h("div", { class: "sh-stats" }, ...Object.entries(STATS).map(([k, st]) => {
        const bonus = eff(d, k) - d.s[k];
        return h("div", { class: "sh-stat" + (k === bestStat(d) ? " best" : "") }, h("span", null, `${st.icon} ${st.name}`),
          h("b", null, `${d.s[k]}${bonus ? ` +${bonus}` : ""}`));
      })),
    ];
    if (d.dead) {
      const cost = reviveCost(d);
      parts.push(h("button", { class: "choice attack", disabled: S.patrons < cost, onclick: () => {
        S.patrons -= cost; d.dead = false; d.hp = d.mhp; d.exp = null; d.room = null; toast(`✨ ${d.n} снова с нами`, "good"); Sound.heal(); dirty = true; save(); openDweller(d);
      } }, `✨ Воскресить · ${fmt(cost)} 🔸`),
      h("button", { class: "choice ghost", onclick: () => { S.dw = S.dw.filter((x) => x !== d); dirty = true; save(); closeSheet(); } }, "⚰️ Похоронить"));
      return openSheet(`☠️ ${d.n}`, h("div", null, ...parts));
    }
    parts.push(
      h("div", { class: "sh-label" }, "Снаряжение"),
      h("div", { class: "sh-row" }, h("span", null, d.o ? `${OUTFITS[d.o].icon} ${OUTFITS[d.o].name}` : "Одежда: нет"),
        h("button", { class: "small", disabled: !!d.exp, onclick: () => pickItem(d, "o") }, "сменить")),
      h("div", { class: "sh-row" }, h("span", null, d.w ? `${WEAPONS[d.w].icon} ${WEAPONS[d.w].name} (+${WEAPONS[d.w].power})` : "Оружие: нет"),
        h("button", { class: "small", disabled: !!d.exp, onclick: () => pickItem(d, "w") }, "сменить")),
      h("div", { class: "sh-label" }, d.exp ? "🎒 Сейчас на вылазке" : `Работа: ${r ? `${ROOMS[r.type].icon} ${ROOMS[r.type].name}` : "нет"}`));
    if (!d.exp) {
      parts.push(h("button", { class: "choice", onclick: () => pickRoomFor(d) }, "🔁 Перевести в другую комнату"));
      if (d.hp < d.mhp) parts.push(h("button", { class: "choice", disabled: S.medkits <= 0, onclick: () => {
        S.medkits--; d.hp = Math.min(d.mhp, d.hp + d.mhp * 0.6); Sound.heal(); save(); openDweller(d);
      } }, `💊 Вылечить (аптечек: ${S.medkits})`));
      parts.push(h("button", { class: "choice attack", onclick: () => openSend(d) }, "🎒 Отправить на вылазку"));
    }
    openSheet(`${d.n} · ур. ${d.lvl}`, h("div", null, ...parts));
  }

  function pickRoomFor(d) {
    const rooms = S.rooms.filter((r) => ROOMS[r.type].slots && r.id !== d.room);
    openSheet(`Куда перевести: ${d.n}`, h("div", null,
      ...rooms.map((r) => {
        const T = ROOMS[r.type], k = T.stat || r.train;
        const full = workers(r).length >= slotsOf(r);
        return h("button", { class: "sh-pick", disabled: full, onclick: () => { assign(d, r); openDweller(d); } },
          h("span", null, `${T.icon} ${T.name} ${ROMAN[r.lvl]}`),
          h("span", { class: "muted" }, `${workers(r).length}/${slotsOf(r)}`),
          h("b", null, k ? `${STATS[k].icon} ${eff(d, k)}` : ""));
      }),
      d.room ? h("button", { class: "choice", onclick: () => { assign(d, null); openDweller(d); } }, "💤 Снять с работы") : null,
      h("button", { class: "choice ghost", onclick: () => openDweller(d) }, "← Назад")));
  }

  function pickItem(d, kind) {
    const items = S.inv.map((it, i) => ({ it, i })).filter((x) => x.it.k === kind);
    const cur = kind === "o" ? d.o : d.w;
    const equip = (x) => {
      if (cur) S.inv.push({ k: kind, id: cur });
      if (x) { S.inv.splice(S.inv.indexOf(x.it), 1); if (kind === "o") d.o = x.it.id; else d.w = x.it.id; count("equip"); }
      else if (kind === "o") d.o = null; else d.w = null;
      Sound.click(); save(); openDweller(d);
    };
    openSheet(kind === "o" ? "👕 Одежда" : "🔫 Оружие", h("div", null,
      items.length ? null : h("p", { class: "muted" }, "На складе пусто. Вещи находят на вылазках и в ящиках."),
      ...items.map((x) => {
        const info = itemInfo(x.it);
        const desc = kind === "o" ? Object.entries(info.bonus).map(([k, v]) => `${STATS[k].icon}+${v}`).join(" ") : `сила удара +${info.power}`;
        return h("button", { class: "sh-pick", onclick: () => equip(x) }, h("span", null, `${info.icon} ${info.name}`), h("b", null, desc));
      }),
      cur ? h("button", { class: "choice", onclick: () => equip(null) }, "Снять") : null,
      h("button", { class: "choice ghost", onclick: () => openDweller(d) }, "← Назад")));
  }

  // ---------- Вылазки ----------
  function openSend(d) {
    let med = Math.min(EXPEDITION.maxMedkits, S.medkits);
    const draw = () => openSheet(`🎒 Вылазка: ${d.n}`, h("div", null,
      h("p", { class: "muted" }, `Чем выше ❤️ Выносливость и лучше оружие, тем меньше ран. 👁️ Чутьё помогает находить патроны. Сейчас: ❤️ ${eff(d, "end")}, оружие +${weaponPower(d)}.`),
      h("div", { class: "sh-row" }, h("span", null, `💊 Аптечек с собой: ${med}`),
        h("span", null,
          h("button", { class: "small", disabled: med <= 0, onclick: () => { med--; draw(); } }, "−"), " ",
          h("button", { class: "small", disabled: med >= Math.min(EXPEDITION.maxMedkits, S.medkits), onclick: () => { med++; draw(); } }, "+"))),
      h("div", { class: "sh-label" }, "Сколько идти (в реальном времени):"),
      ...EXPEDITION.durations.map((x) => h("button", { class: "choice", onclick: () => { sendExp(d, x.min, med); save(); closeSheet(); tab = "exp"; render(); } },
        `⏱️ ${x.label}${x.min >= 120 ? " — опаснее, но богаче" : ""}`)),
      h("button", { class: "choice ghost", onclick: () => openDweller(d) }, "← Назад")));
    draw();
  }

  function expStatus(d) {
    const e = d.exp, t = now();
    if (d.dead) return "☠️ погиб на вылазке";
    if (e.arrive) return "🏠 у ворот — забери добычу!";
    if (e.back) return `↩️ возвращается, ещё ${fmtTime((e.backEnd - t) / 1000)}`;
    return `🚶 в пути ${fmtTime((t - e.start) / 1000)} из ${fmtTime(e.dur / 1000)}`;
  }

  function renderExp() {
    const out = S.dw.filter((d) => d.exp);
    const wrap = h("div", { class: "sh-list" },
      h("p", { class: "muted" }, "Жители уходят в туннели за патронами, припасами и снаряжением. Вылазка идёт в реальном времени, даже когда игра закрыта."),
      h("button", { class: "choice attack", onclick: () => {
        const list = atHome().sort((a, b) => eff(b, "end") - eff(a, "end"));
        openSheet("Кого отправить?", h("div", null, ...list.map((d) => h("button", { class: "sh-pick", onclick: () => openSend(d) },
          h("span", null, `${d.n} · ур. ${d.lvl}`), h("span", { class: "muted" }, `❤️ ${Math.round(d.hp)}/${d.mhp}`), h("b", null, `❤️ ${eff(d, "end")} · 🔫 ${weaponPower(d)}`)))));
      } }, "➕ Отправить жителя"));
    if (!out.length) wrap.append(h("p", null, "Сейчас никого нет снаружи."));
    out.forEach((d) => {
      const e = d.exp, L = e.loot;
      wrap.append(h("div", { class: "sh-exp" + (e.arrive ? " done" : "") + (d.dead ? " dead" : "") },
        h("div", { class: "sh-person-top" }, h("b", null, d.n), h("span", null, expStatus(d))),
        h("div", { class: "bar" }, h("div", { style: `width:${(100 * Math.max(0, d.hp)) / d.mhp}%;background:var(--red)` })),
        h("div", { class: "muted" }, `Добыча: 🔸${L.patrons} 🍄${L.food} 💧${L.water}${L.items.length ? ` 🎁${L.items.length}` : ""}${L.boxes ? ` 📦${L.boxes}` : ""} · 💊${e.med}`),
        h("div", { class: "sh-exp-log" }, ...e.log.slice(-3).reverse().map((x) => h("div", null, x.text))),
        h("div", { class: "sh-row" },
          h("button", { class: "small", onclick: () => openLog(d) }, "📜 журнал"),
          d.dead ? h("button", { class: "small", onclick: () => openDweller(d) }, "☠️ что делать") :
          e.arrive ? h("button", { class: "small on", onclick: () => { claimExp(d); save(); render(); } }, "🎁 забрать добычу") :
          !e.back ? h("button", { class: "small", onclick: () => { recall(d); save(); render(); } }, "↩️ вернуть домой") : null)));
    });
    return wrap;
  }

  function openLog(d) {
    const e = d.exp;
    openSheet(`📜 Журнал: ${d.n}`, h("div", { class: "sh-log" },
      ...e.log.slice().reverse().map((x) => h("div", null, h("span", { class: "muted" }, `${fmtTime((x.t - e.start) / 1000)}  `), x.text))));
  }

  // ---------- Задания ----------
  function renderQuests() {
    const A = agg();
    const qs = activeQuests();
    return h("div", { class: "sh-list" },
      h("div", { class: "sh-boxes" },
        h("div", null, h("b", null, `📦 Ящики с припасами: ${S.boxes}`), h("div", { class: "muted" }, "Внутри патроны, припасы, снаряжение, а иногда и знаменитости.")),
        h("button", { class: "small on", disabled: S.boxes <= 0, onclick: openBox }, "открыть")),
      h("div", { class: "sh-label" }, `Задания (выполнено ${S.qDone.length} из ${QUESTS.length})`),
      ...qs.map((q) => {
        const p = Math.min(q.need, questProgress(q, A));
        const done = p >= q.need;
        return h("div", { class: "sh-quest" + (done ? " done" : "") },
          h("div", null, h("b", null, q.text), h("div", { class: "muted" }, `Награда: ${q.reward.patrons ? `${q.reward.patrons} 🔸 ` : ""}${q.reward.box ? `📦 ×${q.reward.box}` : ""}`)),
          h("div", { class: "bar" }, h("div", { style: `width:${(100 * p) / q.need}%` })),
          h("div", { class: "sh-row" }, h("span", { class: "muted" }, `${fmt(p)} / ${fmt(q.need)}`),
            done ? h("button", { class: "small on", "data-tut": "claim", onclick: () => claimQuest(q) }, "🎁 забрать") : null));
      }),
      qs.length ? null : h("p", null, "🏆 Все задания выполнены! Ты — мэр метро."));
  }

  // ---------- Меню ----------
  function renderMenu() {
    const days = Math.floor((now() - S.created) / 86400000);
    const A = agg();
    return h("div", { class: "sh-list" },
      h("div", { class: "sh-info" },
        h("div", null, `🧑‍✈️ Смотритель · ур. ${hero.lvl} (удар по происшествию: ${6 + hero.lvl * 2})`),
        h("div", null, `🏠 Убежищу ${days} дн. · комнат ${S.rooms.length} · этажей ${S.floors}`),
        h("div", null, `👥 Жителей ${A.pop} · собрано урожая ${fmt(S.c.collect || 0)} раз · отбито происшествий ${S.c.incident || 0}`)),
      h("button", { class: "choice", onclick: () => { Sound.toggle(); render(); } }, Sound.isMuted() ? "🔇 Звук выключен" : "🔊 Звук включён"),
      h("button", { class: "choice", onclick: () => openSheet("❓ Как играть", help()) }, "❓ Как играть"),
      h("button", { class: "choice", onclick: () => { tab = "vault"; render(); tutStart(); } }, "🎓 Пройти обучение заново"),
      h("button", { class: "choice attack", onclick: exit }, "🏠 В главное меню"),
      h("button", { class: "choice ghost", onclick: () => {
        const go = () => { S = null; storeBigSet(KEY, { reset: true }); exit(); };
        if (tg && tg.showConfirm) try { tg.showConfirm("Снести убежище и начать заново? Это нельзя отменить.", (ok) => ok && go()); return; } catch (e) {}
        if (confirm("Снести убежище и начать заново? Это нельзя отменить.")) go();
      } }, "🧨 Начать убежище заново"));
  }

  function help() {
    return h("div", { class: "sh-help" },
      h("p", null, "⚡ Энергия, 💧 вода и 🍄 еда тратятся каждую минуту. Если еды или воды нет, жители слабеют, а без энергии комнаты встают."),
      h("p", null, "🧑‍🔧 Назначай жителей в комнаты. Каждая комната быстрее работает с нужной характеристикой: Генераторная — 💪 Сила, Насосная — 👁️ Чутьё, Грибница — 🤸 Ловкость."),
      h("p", null, "🧺 Когда над комнатой появился урожай, нажми на неё, чтобы собрать. За сбор дают 🔸 патроны."),
      h("p", null, "😊 Жители счастливее, когда работают по своему таланту. Счастливые работают быстрее."),
      h("p", null, "🚨 Происшествия: крысы, пожары, налётчики. Работники в комнате отбиваются сами, а ты можешь помочь, нажимая на комнату."),
      h("p", null, "🎒 Вылазки идут в реальном времени. Жители приносят патроны, припасы, одежду и оружие."),
      h("p", null, "🧱 Две-три одинаковые комнаты одного уровня рядом сливаются в одну большую: мест больше, урожай на 10% больше."),
      h("p", null, "🍺 Бар поднимает настроение всем, 🛡️ Караулка помогает в любом происшествии, 🔧 Мастерская делает оружие и одежду."),
      h("p", null, "🌙 Пока игра закрыта, убежище живёт: до 8 часов учитываются ресурсы и вылазки."));
  }

  function openGuest() {
    const g = S.guest;
    if (!g) return;
    const A = agg();
    if (g.type === "refugees") {
      const space = A.cap - A.pop;
      openSheet("🔔 Беженцы у ворот", h("div", null,
        h("p", null, `${g.n === 1 ? "Измученный путник" : `${g.n} измученных путника`} просят пустить их внутрь.`),
        space <= 0 ? h("p", { class: "muted" }, "🛏️ Свободных коек нет. Построй или улучши Жилой отсек.") : null,
        h("button", { class: "choice attack", disabled: space <= 0, onclick: () => {
          const n = Math.min(g.n, space);
          for (let i = 0; i < n; i++) makeDweller(freeName(), randomStats());
          toast(`👥 В убежище новые жители: ${n}`, "good"); count("recruit", n); S.guest = null; dirty = true; Sound.win(); save(); closeSheet();
        } }, `✅ Впустить${space > 0 && space < g.n ? ` (места только для ${space})` : ""}`),
        h("button", { class: "choice ghost", onclick: () => { S.guest = null; closeSheet(); } }, "❌ Отказать")));
    } else if (g.type === "radio") {
      openSheet("📻 Сигнал", h("div", null, h("p", null, g.text),
        h("button", { class: "choice", onclick: () => { S.patrons += 20; S.guest = null; toast("📻 Связисты продали запись на Рынок: +20 🔸"); save(); closeSheet(); } }, "Записать (+20 🔸)")));
    } else {
      const info = itemInfo(g.item);
      const offers = [
        { text: "🍄 Купить 30 еды", cost: 40, act: () => (S.res.food = Math.min(A.store, S.res.food + 30)) },
        { text: "💧 Купить 30 воды", cost: 40, act: () => (S.res.water = Math.min(A.store, S.res.water + 30)) },
        { text: "💊 Купить 2 аптечки", cost: 70, act: () => (S.medkits = Math.min(SHELTER.medkitCap, S.medkits + 2)) },
        { text: `${info.icon} Купить: ${info.name}`, cost: 90 * info.rare, act: () => S.inv.push(g.item), once: true },
      ];
      const sells = [
        { text: "Продать 30 🍄 → 25 🔸", res: "food", n: 30, get: 25 },
        { text: "Продать 30 💧 → 25 🔸", res: "water", n: 30, get: 25 },
      ];
      const draw = () => openSheet("🧳 Торговец с «Рынка»", h("div", null,
        h("p", { class: "muted" }, `— Всё по-честному, смотритель! У тебя ${fmt(S.patrons)} 🔸`),
        ...offers.filter((o) => !(o.once && g.sold)).map((o) => h("button", { class: "choice", disabled: S.patrons < o.cost, onclick: () => {
          S.patrons -= o.cost; o.act(); if (o.once) g.sold = true; Sound.coin(); save(); draw();
        } }, `${o.text} · ${o.cost} 🔸`)),
        ...sells.map((s) => h("button", { class: "choice", disabled: S.res[s.res] < s.n, onclick: () => {
          S.res[s.res] -= s.n; S.patrons += s.get; Sound.coin(); save(); draw();
        } }, s.text)),
        h("button", { class: "choice ghost", onclick: () => { S.guest = null; closeSheet(); } }, "👋 Попрощаться")));
      draw();
    }
  }

  // ---------- Обучение ----------
  // Шаг: text — подсказка, target — что подсветить, done — когда шаг выполнен.
  // Шаги без done ждут кнопку «Дальше». start — что подготовить перед шагом.
  const q = (sel) => document.querySelector(sel);
  const roomOf = (type) => S.rooms.find((x) => x.type === type);
  const roomNode = (type) => { const r = roomOf(type); return r && refs[r.id] && refs[r.id].node; };
  let tutMemo = {};
  const TUTORIAL = [
    { tab: "vault", target: () => q(".vault"),
      text: "Добро пожаловать в «Глубокую»! Это твоё убежище в разрезе: этажи уходят вниз, слева ездит лифт, внизу — старые рельсы метро. Пройдём короткое обучение." },
    { target: () => q(".sh-top"),
      text: "Наверху — запасы. ⚡ Энергия, 💧 вода и 🍄 еда тратятся каждую минуту. 🔸 Патроны — местные деньги, 👥 — жители и койки, 😊 — общее настроение." },
    { tab: "vault", target: () => roomNode("food"), done: () => sheetKey === "room:food",
      start: () => { const r = roomOf("food"); if (r.ready) collect(r, true); },
      text: "В Грибнице работает всего один человек — еды будет мало. Нажми на Грибницу." },
    { target: () => q('#sh-sheet [data-tut="assign"]'), done: () => sheetKey === "pick",
      lost: () => sheetKey !== "room:food", back: 2,
      text: "Это окно комнаты: что она даёт, как быстро и кто в ней работает. Нажми «Назначить жителя»." },
    { target: () => q("#sh-sheet .sh-pick"),
      start: () => (tutMemo.food = workers(roomOf("food")).length),
      done: () => workers(roomOf("food")).length > tutMemo.food,
      lost: () => sheetKey !== "pick", back: 2,
      text: "Жители отсортированы по 🤸 Ловкости — именно она ускоряет Грибницу. Выбери самого верхнего." },
    { target: () => q("#sh-sheet .sh-x"), done: () => byId("sh-sheet").hidden,
      text: "Отлично, работа пойдёт быстрее! Закрой окно крестиком." },
    { tab: "vault", target: () => roomNode("water"), done: () => !roomOf("water").ready,
      start: () => { const r = roomOf("water"); r.ready = Math.max(r.ready, outOf(r)); },
      text: "Над Насосной появился урожай воды. Нажми на неё, чтобы собрать, — за каждый сбор дают 🔸 патроны." },
    { tab: "vault", target: () => q('[data-tut="empty"]'), done: () => sheetKey === "build",
      start: () => { S.patrons = Math.max(S.patrons, buildCost("living") + 20); },
      text: "Пустые клетки — место для новых комнат. Нажми на любую." },
    { target: () => q('#sh-sheet [data-tut="build-living"]'),
      // считаем постройки, а не комнаты: отсек может сразу объединиться с соседним
      start: () => (tutMemo.build = S.c.build || 0), done: () => (S.c.build || 0) > tutMemo.build,
      lost: () => sheetKey !== "build", back: 7,
      text: "Построй Жилой отсек (он в списке — подсвечен): больше коек — больше жителей. Новичков зовёт Радиорубка, а ещё к воротам приходят беженцы." },
    { tab: "vault", target: () => q(".sh-floors"),
      text: "💡 Две одинаковые комнаты одного уровня рядом сливаются в одну большую: мест больше, а урожай на 10% больше. Так строят крепкие убежища." },
    { target: () => byId("sh-tab-people"), done: () => tab === "people",
      text: "Вкладка «Жители»: характеристики, здоровье, работа и снаряжение каждого. Открой её." },
    { target: () => byId("sh-tab-exp"), done: () => tab === "exp",
      text: "«Вылазки»: жители уходят в туннели за патронами, припасами и вещами. Вылазка идёт в реальном времени — даже когда игра закрыта. Открой вкладку." },
    { target: () => byId("sh-tab-quests"), done: () => tab === "quests",
      text: "«Задания» подскажут, что делать дальше, и щедро наградят. Открой их." },
    { target: () => q('[data-tut="claim"]'),
      start: () => (tutMemo.q = S.qDone.length), done: () => S.qDone.length > tutMemo.q,
      lost: () => tab !== "quests", back: 12,
      text: "Пара заданий уже выполнена! Забери награду." },
    { target: () => byId("sh-tab-vault"), done: () => tab === "vault",
      text: "Вернись в убежище." },
    { tab: "vault", target: () => roomNode("food"), done: () => !S.inc,
      start: () => { const r = roomOf("food"); S.inc = { type: "rats", room: r.id, hp: 40, max: 40, t: -40, scale: 0.6 }; Sound.hurt(); haptic("warning"); },
      text: "🚨 Тревога! В Грибнице крысы. Работники отбиваются сами, но ты — смотритель: быстро жми на комнату!" },
    { finish: true,
      text: "Обучение пройдено! 🎉 Держи ящик с припасами — открой его во вкладке «Задания». Дальше — сам: следи за запасами, расширяй станцию и отбивайся от происшествий. Удачи, смотритель!" },
  ];

  function tutStart() {
    S.tut = 0;
    tutMemo = {};
    closeSheet();
    tutEnter();
  }
  function tutEnter() {
    const st = TUTORIAL[S.tut];
    if (!st) return tutEnd(false);
    if (st.tab && tab !== st.tab) { tab = st.tab; render(); }
    if (st.start) st.start();
    tutMemo.scrolled = false;
    tutDraw();
  }
  function tutNext() {
    S.tut++;
    Sound.click();
    save();
    tutEnter();
  }
  function tutEnd(skipped) {
    S.tut = null;
    S.tutDone = true;
    if (!skipped) { S.boxes++; Sound.level(); haptic("success"); }
    byId("sh-tut").hidden = true;
    save();
    render();
  }
  function tutDraw() {
    const st = TUTORIAL[S.tut], box = byId("sh-tut-bubble");
    box.innerHTML = "";
    box.append(
      h("div", { class: "tut-step" }, `🎓 Обучение · ${S.tut + 1}/${TUTORIAL.length}`),
      h("p", null, st.text),
      h("div", { class: "tut-actions" },
        !st.done ? h("button", { class: "small on", onclick: () => (st.finish ? tutEnd(false) : tutNext()) }, st.finish ? "🎁 Забрать ящик и играть" : "Дальше →") : h("span", { class: "muted" }, "👆 сделай это"),
        st.finish ? null : h("button", { class: "small ghost-btn", onclick: () => tutEnd(true) }, "Пропустить")));
    byId("sh-tut").hidden = false;
    tutPosition();
  }
  // ставит «окошко» подсветки над целью; остальной экран затемнён и не нажимается
  function tutPosition() {
    if (S.tut == null) return;
    const st = TUTORIAL[S.tut];
    const el = st.target && st.target();
    const hole = byId("sh-tut-hole"), bubble = byId("sh-tut-bubble");
    const [bt, bl, br, bb, bc] = ["t", "l", "r", "b", "c"].map((k) => byId(`sh-tut-${k}`));
    const set = (n, x, y, w, hh) => { n.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, hh)}px`; };
    const vw = innerWidth, vh = innerHeight;
    const r = el && el.getBoundingClientRect();
    if (!r || !r.width) {
      // цели не видно — не мешаем играть, просто показываем подсказку
      hole.hidden = true;
      [bt, bl, br, bb].forEach((n) => (n.hidden = true));
      bc.hidden = !!st.done;
      set(bc, 0, 0, vw, vh);
      bubble.style.cssText = "left:12px;right:12px;bottom:90px";
      return;
    }
    if (!tutMemo.scrolled && (r.top < 60 || r.bottom > vh - 80) && r.height < vh * 0.7) {
      tutMemo.scrolled = true;
      el.scrollIntoView({ block: "center" });
      return;
    }
    const p = 6, x = r.left - p, y = r.top - p, w = r.width + p * 2, hh = Math.min(r.height + p * 2, vh);
    hole.hidden = false;
    set(hole, x, y, w, hh);
    [bt, bl, br, bb].forEach((n) => (n.hidden = false));
    set(bt, 0, 0, vw, y);
    set(bb, 0, y + hh, vw, vh - y - hh);
    set(bl, 0, y, x, hh);
    set(br, x + w, y, vw - x - w, hh);
    bc.hidden = !!st.done; // на шагах «Дальше» нажимать подсвеченное не нужно
    set(bc, x, y, w, hh);
    const below = r.top + r.height / 2 < vh * 0.5;
    bubble.style.cssText = below
      ? `left:12px;right:12px;top:${Math.min(vh - 180, y + hh + 10)}px`
      : `left:12px;right:12px;bottom:${Math.min(vh - 180, vh - y + 10)}px`;
  }
  function tutTick() {
    if (!S || S.tut == null) return;
    const st = TUTORIAL[S.tut];
    if (st.done && st.done()) { tutNext(); return; }
    // игрок закрыл нужное окно или ушёл не туда — возвращаемся к шагу, где его открывают
    if (st.lost && st.lost()) { S.tut = st.back; tutEnter(); return; }
    tutPosition();
  }

  // ---------- Вход и выход ----------
  async function load() {
    const saved = await storeBigGet(KEY);
    S = saved && !saved.reset && saved.rooms ? saved : null;
    return !!S;
  }
  const exists = () => !!S;

  function open(from) {
    if (from && from.level) hero.lvl = from.level;
    if (!S) create(from);
    if (S.hero && S.hero.lvl > hero.lvl) hero.lvl = S.hero.lvl;
    S.hero = { lvl: hero.lvl };
    byId("menu").hidden = true;
    byId("game").hidden = true;
    byId("shelter").hidden = false;
    document.body.classList.add("in-shelter");
    buildShell();
    tab = "vault";
    dirty = true;
    const sum = catchUp();
    render();
    lastReal = now();
    clearInterval(loop);
    loop = setInterval(tick, 250);
    Sound.setMood("calm");
    if (!S.welcomed) {
      // новое убежище — сразу обучение
      S.welcomed = true;
      tutStart();
    } else if (S.tut != null) {
      tutEnter(); // обучение прервали — продолжаем с того же шага
    } else if (!S.tutDone) {
      // убежище из прошлой версии: обучения тогда не было — предложим
      S.tutDone = true;
      openSheet("🎓 Новое: обучение", h("div", null,
        h("p", null, "В убежище появилось пошаговое обучение, интерьеры комнат, лифт, три новые комнаты (Бар, Караулка, Мастерская) и объединение одинаковых комнат."),
        h("button", { class: "choice attack", onclick: tutStart }, "🎓 Пройти обучение"),
        h("button", { class: "choice ghost", onclick: () => { closeSheet(); showAway(sum); } }, "Не надо, я разберусь")));
    } else showAway(sum);
    save();
  }

  function exit() {
    if (S) save();
    clearInterval(loop);
    loop = null;
    byId("shelter").hidden = true;
    document.body.classList.remove("in-shelter");
    showMenu();
  }

  // при сворачивании — сохраняемся, при возвращении — догоняем прошедшее время
  document.addEventListener("visibilitychange", () => {
    if (!S || !loop) return;
    if (document.hidden) save();
    else { const sum = catchUp(); lastReal = now(); render(); showAway(sum); }
  });

  // dbg — доступ для проверок из консоли разработчика, игроку не нужен
  const dbg = { get S() { return S; }, reset() { S = null; }, tutStart, tutNext, tutPosition, tutTick, get sheetKey() { return sheetKey; }, step, agg, workers, cycleTime, collect, assign, build, buildCost, upgrade, dig,
                sendExp, simExp, claimExp, heroHit, startIncident, catchUp, eff, openBox, activeQuests, questProgress, claimQuest };
  return { load, open, exists, exit, dbg };
})();
