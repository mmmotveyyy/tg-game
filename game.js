// =====================================================================
//  ДВИЖОК ИГРЫ: состояние героя, переходы между сценами, бои, уровни,
//  припасы главы 2, сохранения (в облаке Telegram + в браузере),
//  картинки и музыка
// =====================================================================

const tg = window.Telegram && window.Telegram.WebApp;
const SAVE_KEY = "last_train_save_v2";
const ENDINGS_KEY = "last_train_endings";
const CH2_HERO_KEY = "last_train_ch2_hero";      // герой в начале главы 2
const CHECKPOINT_KEY = "last_train_checkpoint";  // точка возврата после смерти в главе 2

let state = null;     // всё о текущей игре; state.fight — текущий бой
let notes = [];       // сообщения, показанные над текстом сцены
let endingsSeen = []; // открытые концовки (сохраняются между играми)
let ch2Hero = null;   // с каким героем начинается глава 2
let lastArt = null;

// ---------- Telegram ----------
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("#14110d"); tg.setBackgroundColor("#14110d"); } catch (e) {}
}
function haptic(type) {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (type === "light" || type === "heavy") tg.HapticFeedback.impactOccurred(type);
    else tg.HapticFeedback.notificationOccurred(type);
  } catch (e) {}
}

// ---------- Сохранение ----------
// Облако Telegram хранит данные на серверах Telegram, поэтому прогресс
// не пропадает, даже если Telegram очищает память встроенного браузера.
const cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;

function storeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
  if (cloud) try { cloud.setItem(key, value); } catch (e) {}
}
function storeRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
  if (cloud) try { cloud.removeItem(key); } catch (e) {}
}
// возвращает все найденные копии: [из браузера, из облака]
function storeGet(key) {
  return new Promise((resolve) => {
    let local = null;
    try { local = localStorage.getItem(key); } catch (e) {}
    if (!cloud) return resolve([local]);
    const timer = setTimeout(() => resolve([local]), 2500);
    try {
      cloud.getItem(key, (err, value) => { clearTimeout(timer); resolve([local, err ? null : value]); });
    } catch (e) { clearTimeout(timer); resolve([local]); }
  });
}
const parse = (v) => { try { return JSON.parse(v); } catch (e) { return null; } };

// берёт самую свежую из копий
async function loadNewest(key) {
  const copies = (await storeGet(key)).map(parse).filter((s) => s && (!s.scene || SCENES[s.scene]));
  copies.sort((a, b) => (b.t || 0) - (a.t || 0));
  return copies[0] || null;
}
function storeState(key, s) {
  s.t = Date.now();
  storeSet(key, JSON.stringify(s));
}
const save = () => storeState(SAVE_KEY, state);

async function loadEndings() {
  const all = new Set();
  (await storeGet(ENDINGS_KEY)).map(parse).forEach((arr) => (arr || []).forEach((e) => all.add(e)));
  return [...all];
}
function rememberEnding(type) {
  if (!endingsSeen.includes(type)) endingsSeen.push(type);
  storeSet(ENDINGS_KEY, JSON.stringify(endingsSeen));
}

// ---------- Герой ----------
function newGame() {
  state = {
    chapter: 1,
    scene: START.scene,
    hp: START.hp,
    maxHp: START.hp,
    baseAttack: START.attack,
    level: 1,
    xp: 0,
    patrons: START.patrons,
    items: START.items.slice(),
    flags: {},
    fight: null,
  };
  notes = [];
  lastArt = null;
  goTo(state.scene);
}

// глава 2 начинается с героем из конца главы 1
function startChapter2(hero) {
  const keepFlags = ["lisa", "trickedSam"];
  state = {
    chapter: 2,
    scene: "ch2_intro",
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    baseAttack: hero.baseAttack,
    level: hero.level,
    xp: hero.xp,
    patrons: Math.min(hero.patrons, 60), // остальное ушло в общую казну «Сокола»
    items: hero.items.filter((id) => !["medicine", "fakecase", "fuse"].includes(id)),
    flags: Object.fromEntries(keepFlags.filter((f) => hero.flags[f]).map((f) => [f, true])),
    day: 1,
    food: CHAPTER2.food,
    water: CHAPTER2.water,
    people: CHAPTER2.people,
    fight: null,
  };
  notes = [];
  lastArt = null;
  goTo(state.scene);
}

const list = (v) => (v === undefined ? [] : [].concat(v));
const xpForNext = () => state.level * 25;
const has = (id) => state.items.includes(id);
const count = (id) => state.items.filter((i) => i === id).length;
const best = (prop) => Math.max(0, ...state.items.map((id) => ITEMS[id][prop] || 0));
const attackPower = () => state.baseAttack + best("attack");
const armorValue = () => best("armor");

function giveItem(id) { state.items.push(id); }
function takeItem(id) {
  const i = state.items.indexOf(id);
  if (i >= 0) state.items.splice(i, 1);
}

function changeHp(delta) {
  state.hp = Math.max(0, Math.min(state.maxHp, state.hp + delta));
}

function addXp(amount) {
  if (!amount) return;
  state.xp += amount;
  notes.push(`✨ +${amount} опыта`);
  while (state.xp >= xpForNext()) {
    state.xp -= xpForNext();
    state.level++;
    state.maxHp += 6;
    state.baseAttack += 1;
    state.hp = state.maxHp;
    notes.push(`⭐ Новый уровень: ${state.level}! Здоровье и атака выросли.`);
    haptic("success");
    Sound.level(0.3);
  }
}

// глава 2: проходит день — жители тратят еду и воду
function passDay(days) {
  for (let i = 0; i < days; i++) {
    state.day++;
    const need = Math.ceil(state.people / 10);
    const waterNeed = state.flags.goalWater ? Math.ceil(need / 2) : need;
    state.food -= need;
    state.water -= waterNeed;
    let msg = `📅 День ${state.day}: −${need} еды, −${waterNeed} воды.`;
    if (state.food < 0 || state.water < 0) {
      state.food = Math.max(0, state.food);
      state.water = Math.max(0, state.water);
      state.people -= CHAPTER2.leaveOnHunger;
      msg += ` Припасов не хватило — ${CHAPTER2.leaveOnHunger} жителя ушли!`;
      haptic("warning");
    }
    notes.push(msg);
  }
}

// применяет эффекты выбора или onEnter
function applyEffects(e) {
  if (e.once) state.flags[e.once] = true;
  list(e.flag).forEach((f) => (state.flags[f] = true));
  if (e.cost) state.patrons -= e.cost;
  if (e.patrons) {
    state.patrons += e.patrons;
    notes.push(`${e.patrons > 0 ? "+" : ""}${e.patrons} патронов`);
    if (e.patrons > 0) Sound.coin();
  }
  if (e.food) state.food += e.food;
  if (e.water) state.water += e.water;
  if (e.people) state.people += e.people;
  list(e.give).forEach(giveItem);
  list(e.take).forEach(takeItem);
  if (e.hp) changeHp(e.hp);
  if (e.xp) addXp(e.xp);
  if (e.day) passDay(e.day);
}

// ---------- Сцены ----------
function goTo(id) {
  if (state.hp <= 0) id = state.chapter === 2 ? "dead2" : "dead";
  if (state.chapter === 2 && !SCENES[id].ending) {
    if (state.people < CHAPTER2.minPeople) id = "ch2_lost";
    else if (state.day > CHAPTER2.deadline) id = "ch2_flooded";
  }
  const scene = SCENES[id];
  if (!scene) { alert("Нет сцены: " + id); return; }
  state.scene = id;

  if (scene.onEnter && !(scene.onEnter.once && state.flags[scene.onEnter.once])) {
    applyEffects(scene.onEnter);
  }

  if (scene.fight && !state.fight) {
    const f = scene.fight;
    state.fight = { enemy: f.enemy, hp: ENEMIES[f.enemy].hp, win: f.win, flee: f.flee, winFlag: f.winFlag, turn: 0, log: [] };
  }

  if (scene.checkpoint) storeState(CHECKPOINT_KEY, Object.assign({}, state, { fight: null }));
  if (id === "dead2") { Sound.death(); haptic("error"); }

  if (scene.ending) {
    storeRemove(SAVE_KEY);
    rememberEnding(scene.ending);
    if (scene.ending === "good" || scene.ending === "trick") {
      ch2Hero = JSON.parse(JSON.stringify(state));
      storeState(CH2_HERO_KEY, ch2Hero);
    }
    if (scene.ending === "bad" || scene.ending === "lost2") { Sound.death(); haptic("error"); }
    else { Sound.win(); haptic("success"); }
  } else {
    save();
  }
  render();
}

async function backToCheckpoint() {
  const cp = await loadNewest(CHECKPOINT_KEY);
  if (!cp) { startChapter2(ch2Hero || state); return; }
  state = cp;
  notes = ["🛏️ Ты провалялся без сознания целый день."];
  passDay(1);
  lastArt = null;
  goTo(state.scene);
}

function choiceVisible(c) {
  if (!list(c.need).every(has)) return false;
  if (list(c.needNot).some(has)) return false;
  if (!list(c.needFlag).every((f) => state.flags[f])) return false;
  if (list(c.needNotFlag).some((f) => state.flags[f])) return false;
  if (c.once && state.flags[c.once]) return false;
  return true;
}

function pick(c) {
  notes = [];
  if (c.cost && state.patrons < c.cost) return;
  haptic("light");
  Sound.click();

  if (c.action === "checkpoint") { backToCheckpoint(); return; }

  if (c.chance !== undefined) {
    if (Math.random() < c.chance) {
      notes.push("🎲 Получилось!");
    } else {
      notes.push("🎲 Не вышло...");
      if (c.once) state.flags[c.once] = true;
      haptic("warning");
      goTo(c.fail);
      return;
    }
  }
  applyEffects(c);
  if (c.hp > 0) Sound.heal();
  if (c.note) notes.push(c.note);
  goTo(c.to);
}

// ---------- Бой ----------
const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const foe = () => ENEMIES[state.fight.enemy];
// будет ли следующий удар врага особым
const specialNext = () => {
  const sp = foe().special;
  return sp && (state.fight.turn + 1) % sp.every === 0;
};

function shake() {
  const a = $("art");
  a.classList.remove("shake");
  void a.offsetWidth;
  a.classList.add("shake");
}

function allyTurn() {
  if (!state.flags.lisa || state.fight.hp <= 0) return;
  const d = roll(2, 4);
  state.fight.hp -= d;
  state.fight.log.push(`🎯 Лиса стреляет: ${d} урона.`);
  Sound.shot(0.25);
}

function enemyTurn() {
  const f = state.fight, e = foe();
  f.turn++;
  const special = e.special && f.turn % e.special.every === 0;
  let dmg = special ? roll(e.special.dmg[0], e.special.dmg[1]) : roll(e.atk[0], e.atk[1]);
  dmg = Math.max(1, dmg - armorValue());
  if (f.defending) dmg = Math.ceil(dmg / 2);
  changeHp(-dmg);
  const who = special ? `💥 ${e.name}: «${e.special.name}»!` : `${e.icon} ${e.name}:`;
  f.log.push(`${who} −${dmg} здоровья${f.defending ? " (ты защитился)" : ""}.`);
  f.defending = false;
  Sound.hurt(0.5);
  if (special) Sound.boom(0.4);
  haptic("heavy");
  setTimeout(shake, 450);
}

function endFightIfNeeded() {
  const f = state.fight, e = foe();
  if (f.hp <= 0) {
    state.fight = null;
    notes = [`🏆 Победа: ${e.name}!`];
    if (e.loot) { state.patrons += e.loot; notes.push(`+${e.loot} патронов`); }
    if (f.winFlag) state.flags[f.winFlag] = true;
    addXp(e.xp);
    goTo(f.win);
    return true;
  }
  if (state.hp <= 0) {
    state.fight = null;
    goTo("dead");
    return true;
  }
  return false;
}

// ход боя: игрок → Лиса → враг
function fightRound(playerAction) {
  playerAction();
  if (endFightIfNeeded()) return;
  allyTurn();
  if (endFightIfNeeded()) return;
  enemyTurn();
  if (endFightIfNeeded()) return;
  save();
  render();
}

function fightAttack() {
  fightRound(() => {
    const die = roll(1, 6);
    let msg;
    if (die === 1) {
      msg = "🎲 1: промах!";
      Sound.miss();
    } else {
      let dmg = die + attackPower();
      if (die === 6) dmg *= 2;
      state.fight.hp -= dmg;
      msg = die === 6 ? `🎲 6: КРИТ! Ты наносишь ${dmg} урона.` : `🎲 ${die}: ты наносишь ${dmg} урона.`;
      if (die === 6) Sound.crit(); else Sound.hit();
    }
    state.fight.log = [msg];
    haptic("light");
  });
}

function fightDefend() {
  fightRound(() => {
    state.fight.defending = true;
    state.fight.log = ["🛡️ Ты закрываешься и ждёшь удара."];
    Sound.click();
  });
}

function fightUseItem(id) {
  fightRound(() => {
    const it = ITEMS[id];
    takeItem(id);
    state.fight.log = [];
    if (it.heal) {
      changeHp(it.heal);
      state.fight.log.push(`${it.icon} ${it.name}: +${it.heal} здоровья.`);
      Sound.heal();
    }
    if (it.damage) {
      state.fight.hp -= it.damage;
      state.fight.log.push(`${it.icon} ${it.name}: ${it.damage} урона врагу!`);
      Sound.boom();
      haptic("heavy");
    }
  });
}

function fightFlee() {
  Sound.click();
  if (Math.random() < 0.5) {
    const to = state.fight.flee;
    state.fight = null;
    notes = ["🏃 Тебе удалось сбежать."];
    goTo(to);
  } else {
    state.fight.log = ["🏃 Сбежать не удалось!"];
    enemyTurn();
    if (endFightIfNeeded()) return;
    save();
    render();
  }
}

// ---------- Отрисовка ----------
const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function button(text, onClick, opts = {}) {
  const b = el("button", "choice" + (opts.cls ? " " + opts.cls : ""), text);
  if (opts.disabled) b.disabled = true;
  b.onclick = onClick;
  return b;
}

function showArt(key) {
  if (key === lastArt) return; // не перерисовываем, чтобы анимация не дёргалась
  lastArt = key;
  const draw = ART[key] || ART.tunnel;
  const box = $("art");
  box.innerHTML = draw();
  box.classList.remove("fade");
  void box.offsetWidth;
  box.classList.add("fade");
}

function sceneMood(scene) {
  if (state.fight) return "fight";
  if (scene.ending) return scene.ending === "bad" || scene.ending === "lost2" ? "bad" : "good";
  return scene.mood || "under";
}

// подставляет числа в текст: {people} → 40
const fill = (text) => text.replace(/\{(\w+)\}/g, (m, k) => (state[k] !== undefined ? state[k] : m));

function renderStats() {
  $("hp-text").textContent = `${state.hp}/${state.maxHp}`;
  $("hp-fill").style.width = (100 * state.hp / state.maxHp) + "%";
  $("xp-text").textContent = `Ур. ${state.level}`;
  $("xp-fill").style.width = (100 * state.xp / xpForNext()) + "%";
  $("patrons").textContent = state.patrons;
  $("attack").textContent = attackPower();
  $("armor-chip").hidden = !armorValue();
  $("armor").textContent = armorValue();
  $("ally-chip").hidden = !state.flags.lisa;
  $("inv-count").textContent = state.items.length;

  const ch2 = state.chapter === 2;
  $("ch2-stats").hidden = !ch2;
  if (!ch2) return;
  const need = Math.ceil(state.people / 10);
  $("day").textContent = `${state.day}`;
  $("flood").textContent = `${Math.max(0, CHAPTER2.deadline - state.day + 1)}`;
  $("food").textContent = state.food;
  $("water").textContent = state.water;
  $("people").textContent = state.people;
  $("food-chip").classList.toggle("low", state.food < need);
  $("water-chip").classList.toggle("low", state.water < (state.flags.goalWater ? Math.ceil(need / 2) : need));
  $("flood-chip").classList.toggle("low", CHAPTER2.deadline - state.day < 3);

  const done = CHAPTER2.goals.filter((g) => state.flags[g.flag]).length;
  $("goal-pct").textContent = `${Math.round(100 * done / CHAPTER2.goals.length)}% до свободной игры`;
  const goals = $("goals");
  goals.innerHTML = "";
  CHAPTER2.goals.forEach((g) => {
    const seg = el("div", "goal" + (state.flags[g.flag] ? " done" : ""), g.icon);
    seg.title = g.name;
    goals.appendChild(seg);
  });
}

function render() {
  $("menu").hidden = true;
  $("game").hidden = false;
  renderStats();

  const scene = SCENES[state.scene];
  const fight = state.fight;
  showArt(fight ? foe().art : scene.art || state.scene);
  Sound.setMood(sceneMood(scene));

  $("title").textContent = scene.title;
  const extras = (scene.extra || []).filter((x) => state.flags[x.flag]).map((x) => x.text);
  $("text").textContent = fill([scene.text, ...extras].join("\n\n"));

  const notesBox = $("notes");
  notesBox.innerHTML = "";
  notes.forEach((n) => notesBox.appendChild(el("div", "note", n)));

  const box = $("choices");
  box.innerHTML = "";
  $("enemy").hidden = !fight;

  if (fight) {
    const e = foe();
    $("enemy-name").textContent = `${e.icon} ${e.name}`;
    $("enemy-hp").textContent = `${Math.max(0, fight.hp)}/${e.hp}`;
    $("enemy-fill").style.width = (100 * Math.max(0, fight.hp) / e.hp) + "%";
    const log = $("fight-log");
    log.innerHTML = "";
    fight.log.forEach((l) => log.appendChild(el("div", "", l)));
    const danger = specialNext();
    $("enemy-warn").hidden = !danger;
    if (danger) $("enemy-warn").textContent = `⚠️ ${e.name} готовит «${e.special.name}»! Лучше защититься.`;

    box.appendChild(button(`⚔️ Атаковать (сила ${attackPower()} + 🎲)`, fightAttack, { cls: danger ? "" : "attack" }));
    box.appendChild(button("🛡️ Защищаться (урон ×½)", fightDefend, { cls: danger ? "attack" : "" }));
    [...new Set(state.items)].filter((id) => ITEMS[id].heal || ITEMS[id].damage).forEach((id) => {
      const it = ITEMS[id];
      box.appendChild(button(`${it.icon} ${it.name} ×${count(id)}`, () => fightUseItem(id)));
    });
    box.appendChild(button("🏃 Бежать (50%)", fightFlee, { cls: "ghost" }));
    return;
  }

  if (scene.ending) {
    box.appendChild(el("div", "ending " + scene.ending, ENDINGS[scene.ending]));
    box.appendChild(el("div", "muted center", `Открыто концовок: ${endingsSeen.length} из ${Object.keys(ENDINGS).length}`));
    const hero = JSON.parse(JSON.stringify(state));
    if (scene.ending === "good" || scene.ending === "trick") {
      box.appendChild(button("▶️ Глава 2: Новый дом", () => startChapter2(hero), { cls: "attack" }));
      box.appendChild(button("🔄 Пройти главу 1 заново", newGame));
    } else if (scene.ending === "home2") {
      const soon = el("div", "soon");
      soon.appendChild(el("b", "", "🔓 Свободная игра — скоро!"));
      soon.appendChild(el("div", "", "Ты будешь строить комнаты на «Глубокой», ставить жителей на работы, следить за энергией, водой и едой и отбиваться от налётов, как в Fallout Shelter."));
      box.appendChild(soon);
      box.appendChild(button("🔄 Пройти главу 2 заново", () => startChapter2(ch2Hero)));
      box.appendChild(button("🏠 В главное меню", showMenu, { cls: "ghost" }));
    } else if (scene.ending === "lost2") {
      box.appendChild(button("🔄 Начать главу 2 заново", () => startChapter2(ch2Hero), { cls: "attack" }));
      box.appendChild(button("🏠 В главное меню", showMenu, { cls: "ghost" }));
    } else {
      box.appendChild(button("🔄 Начать заново", newGame, { cls: "attack" }));
    }
    return;
  }

  scene.choices.filter(choiceVisible).forEach((c) => {
    const tooPoor = c.cost && state.patrons < c.cost;
    box.appendChild(button(c.text, () => pick(c), { disabled: tooPoor }));
  });
}

// ---------- Инвентарь ----------
function openInventory() {
  Sound.click();
  const box = $("inv-list");
  box.innerHTML = "";
  const unique = [...new Set(state.items)];
  if (!unique.length) box.appendChild(el("div", "muted", "Пусто."));
  if (state.flags.lisa) {
    const row = el("div", "inv-item");
    row.appendChild(el("div", "inv-icon", "🎯"));
    const info = el("div", "inv-info");
    info.appendChild(el("div", "inv-name", "Лиса (напарница)"));
    info.appendChild(el("div", "muted", "В каждом бою стреляет по врагу: 2–4 урона."));
    row.appendChild(info);
    box.appendChild(row);
  }
  unique.forEach((id) => {
    const it = ITEMS[id];
    const row = el("div", "inv-item");
    row.appendChild(el("div", "inv-icon", it.icon));
    const info = el("div", "inv-info");
    info.appendChild(el("div", "inv-name", `${it.name}${count(id) > 1 ? " ×" + count(id) : ""}`));
    info.appendChild(el("div", "muted", it.desc));
    row.appendChild(info);
    if (it.heal && !state.fight) {
      const b = el("button", "small", "Использовать");
      b.disabled = state.hp >= state.maxHp;
      b.onclick = () => {
        takeItem(id);
        changeHp(it.heal);
        notes = [`${it.icon} +${it.heal} здоровья`];
        Sound.heal();
        haptic("success");
        save();
        render();
        openInventory();
      };
      row.appendChild(b);
    }
    box.appendChild(row);
  });
  $("inventory").hidden = false;
}

// ---------- Звук ----------
function updateSoundButtons() {
  const icon = Sound.isMuted() ? "🔇" : "🔊";
  $("snd-btn").textContent = icon;
  $("menu-snd").textContent = icon + (Sound.isMuted() ? " Звук выключен" : " Звук включён");
}
function toggleSound() {
  Sound.toggle();
  updateSoundButtons();
}
// браузер (особенно на iPhone) разрешает звук только в ответ на касание
["touchend", "click", "keydown"].forEach((ev) =>
  document.addEventListener(ev, () => Sound.unlock(), { passive: true, capture: true })
);

// ---------- Запуск ----------
let savedGame = null;

async function showMenu() {
  $("game").hidden = true;
  $("menu").hidden = false;
  $("menu-art").innerHTML = ART.train();
  $("new-game").disabled = true;
  $("loading").hidden = false;

  [savedGame, endingsSeen, ch2Hero] = await Promise.all([loadNewest(SAVE_KEY), loadEndings(), loadNewest(CH2_HERO_KEY)]);

  $("loading").hidden = true;
  $("new-game").disabled = false;
  $("continue").hidden = !savedGame;
  $("chapter2").hidden = !ch2Hero;
  $("menu-endings").textContent = endingsSeen.length
    ? `Открыто концовок: ${endingsSeen.length} из ${Object.keys(ENDINGS).length}`
    : "";
}

$("new-game").onclick = newGame;
$("chapter2").onclick = () => startChapter2(ch2Hero);
$("continue").onclick = () => {
  state = savedGame;
  if (!state.chapter) state.chapter = 1;
  notes = ["💾 Игра загружена"];
  lastArt = null;
  goTo(state.scene);
};
$("inv-btn").onclick = openInventory;
$("inv-close").onclick = () => { $("inventory").hidden = true; };
$("inventory").onclick = (ev) => { if (ev.target.id === "inventory") $("inventory").hidden = true; };
$("snd-btn").onclick = toggleSound;
$("menu-snd").onclick = toggleSound;

updateSoundButtons();
showMenu();
