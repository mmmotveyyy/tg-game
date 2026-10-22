// =====================================================================
//  ДВИЖОК ИГРЫ: состояние героя, переходы между сценами, бои, уровни,
//  сохранения (в облаке Telegram + в браузере), картинки и музыка
// =====================================================================

const tg = window.Telegram && window.Telegram.WebApp;
const SAVE_KEY = "last_train_save_v2";
const ENDINGS_KEY = "last_train_endings";

let state = null;     // всё о текущей игре; state.fight — текущий бой
let notes = [];       // сообщения, показанные над текстом сцены
let endingsSeen = []; // открытые концовки (сохраняются между играми)
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

function save() {
  state.t = Date.now();
  storeSet(SAVE_KEY, JSON.stringify(state));
}
async function loadSave() {
  // берём самую свежую из копий
  const copies = (await storeGet(SAVE_KEY)).map(parse).filter((s) => s && SCENES[s.scene]);
  copies.sort((a, b) => (b.t || 0) - (a.t || 0));
  return copies[0] || null;
}
async function loadEndings() {
  const all = new Set();
  (await storeGet(ENDINGS_KEY)).map(parse).forEach((list) => (list || []).forEach((e) => all.add(e)));
  return [...all];
}
function rememberEnding(type) {
  if (!endingsSeen.includes(type)) endingsSeen.push(type);
  storeSet(ENDINGS_KEY, JSON.stringify(endingsSeen));
}

// ---------- Герой ----------
function newGame() {
  state = {
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
  list(e.give).forEach(giveItem);
  list(e.take).forEach(takeItem);
  if (e.hp) changeHp(e.hp);
  if (e.xp) addXp(e.xp);
}

// ---------- Сцены ----------
function goTo(id) {
  if (state.hp <= 0) id = "dead";
  const scene = SCENES[id];
  if (!scene) { alert("Нет сцены: " + id); return; }
  state.scene = id;

  if (scene.onEnter && !(scene.onEnter.once && state.flags[scene.onEnter.once])) {
    applyEffects(scene.onEnter);
  }

  if (scene.fight && !state.fight) {
    const f = scene.fight;
    state.fight = { enemy: f.enemy, hp: ENEMIES[f.enemy].hp, win: f.win, flee: f.flee, winFlag: f.winFlag, log: [] };
  }

  if (scene.ending) {
    storeRemove(SAVE_KEY);
    rememberEnding(scene.ending);
    if (scene.ending === "bad") { Sound.death(); haptic("error"); }
    else { Sound.win(); haptic("success"); }
  } else {
    save();
  }
  render();
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
  const e = foe();
  const dmg = Math.max(1, roll(e.atk[0], e.atk[1]) - armorValue());
  changeHp(-dmg);
  state.fight.log.push(`${e.icon} ${e.name} наносит тебе ${dmg} урона.`);
  Sound.hurt(0.5);
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
  if (scene.ending) return scene.ending === "bad" ? "bad" : "good";
  return scene.mood || "under";
}

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
  $("text").textContent = [scene.text, ...extras].join("\n\n");

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

    box.appendChild(button(`⚔️ Атаковать (сила ${attackPower()} + 🎲)`, fightAttack, { cls: "attack" }));
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
    box.appendChild(button("🔄 Начать заново", newGame, { cls: "attack" }));
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
  Sound.init();
  Sound.toggle();
  updateSoundButtons();
}
// браузер разрешает звук только после первого касания экрана
document.addEventListener("pointerdown", () => Sound.init(), { passive: true });

// ---------- Запуск ----------
let savedGame = null;

async function showMenu() {
  $("game").hidden = true;
  $("menu").hidden = false;
  $("menu-art").innerHTML = ART.train();
  $("new-game").disabled = true;
  $("loading").hidden = false;

  [savedGame, endingsSeen] = await Promise.all([loadSave(), loadEndings()]);

  $("loading").hidden = true;
  $("new-game").disabled = false;
  $("continue").hidden = !savedGame;
  $("menu-endings").textContent = endingsSeen.length
    ? `Открыто концовок: ${endingsSeen.length} из ${Object.keys(ENDINGS).length}`
    : "";
}

$("new-game").onclick = () => { Sound.init(); lastArt = null; newGame(); };
$("continue").onclick = () => {
  Sound.init();
  state = savedGame;
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
