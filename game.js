// =====================================================================
//  ДВИЖОК ИГРЫ: состояние героя, переходы между сценами, бои, уровни
// =====================================================================

const tg = window.Telegram && window.Telegram.WebApp;
const SAVE_KEY = "last-train-save-v1";

let state = null;
let fight = null;  // текущий бой: { enemy, hp, maxHp, win, flee }
let notes = [];    // сообщения, показанные над текстом сцены

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
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
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
  };
  fight = null;
  notes = [];
  goTo(state.scene);
}

const xpForNext = () => state.level * 25;
const has = (id) => state.items.includes(id);
const count = (id) => state.items.filter((i) => i === id).length;

function attackPower() {
  // берём лучшее оружие из инвентаря
  const bonus = Math.max(0, ...state.items.map((id) => ITEMS[id].attack || 0));
  return state.baseAttack + bonus;
}

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
  }
}

// применяет эффекты выбора или onEnter
function applyEffects(e) {
  if (e.once) state.flags[e.once] = true;
  if (e.flag) state.flags[e.flag] = true;
  if (e.cost) state.patrons -= e.cost;
  if (e.patrons) {
    state.patrons += e.patrons;
    notes.push(`${e.patrons > 0 ? "+" : ""}${e.patrons} патронов`);
  }
  if (e.give) giveItem(e.give);
  if (e.take) takeItem(e.take);
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

  if (scene.fight && !fight) {
    const e = ENEMIES[scene.fight.enemy];
    fight = { enemy: e, hp: e.hp, maxHp: e.hp, win: scene.fight.win, flee: scene.fight.flee, log: [] };
  }

  if (scene.ending) clearSave(); else save();
  render();
}

function choiceVisible(c) {
  if (c.need && !has(c.need)) return false;
  if (c.needNot && has(c.needNot)) return false;
  if (c.needFlag && !state.flags[c.needFlag]) return false;
  if (c.once && state.flags[c.once]) return false;
  return true;
}

function pick(c) {
  notes = [];
  if (c.cost && state.patrons < c.cost) return;
  haptic("light");

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
  if (c.note) notes.push(c.note);
  if (state.hp <= 0) { goTo("dead"); return; }
  goTo(c.to);
}

// ---------- Бой ----------
const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function enemyTurn() {
  const dmg = roll(fight.enemy.atk[0], fight.enemy.atk[1]);
  changeHp(-dmg);
  fight.log.push(`${fight.enemy.icon} ${fight.enemy.name} наносит тебе ${dmg} урона.`);
  haptic("heavy");
}

function endFightIfNeeded() {
  if (fight.hp <= 0) {
    const e = fight.enemy;
    const win = fight.win;
    fight = null;
    notes = [`🏆 Победа над врагом: ${e.name}!`];
    if (e.loot) { state.patrons += e.loot; notes.push(`+${e.loot} патронов`); }
    addXp(e.xp);
    haptic("success");
    goTo(win);
    return true;
  }
  if (state.hp <= 0) {
    fight = null;
    haptic("error");
    goTo("dead");
    return true;
  }
  return false;
}

function fightAttack() {
  const die = roll(1, 6);
  let msg;
  if (die === 1) {
    msg = `🎲 1: промах!`;
  } else {
    let dmg = die + attackPower();
    if (die === 6) dmg *= 2;
    fight.hp -= dmg;
    msg = die === 6 ? `🎲 6: КРИТ! Ты наносишь ${dmg} урона.` : `🎲 ${die}: ты наносишь ${dmg} урона.`;
  }
  fight.log = [msg];
  haptic("light");
  if (endFightIfNeeded()) return;
  enemyTurn();
  if (endFightIfNeeded()) return;
  save();
  render();
}

function fightUseItem(id) {
  const it = ITEMS[id];
  takeItem(id);
  fight.log = [];
  if (it.heal) {
    changeHp(it.heal);
    fight.log.push(`${it.icon} ${it.name}: +${it.heal} здоровья.`);
  }
  if (it.damage) {
    fight.hp -= it.damage;
    fight.log.push(`${it.icon} ${it.name}: ${it.damage} урона врагу!`);
    haptic("heavy");
  }
  if (endFightIfNeeded()) return;
  enemyTurn();
  if (endFightIfNeeded()) return;
  save();
  render();
}

function fightFlee() {
  if (Math.random() < 0.5) {
    const flee = fight.flee;
    fight = null;
    notes = ["🏃 Тебе удалось сбежать."];
    goTo(flee);
  } else {
    fight.log = ["🏃 Сбежать не удалось!"];
    enemyTurn();
    if (endFightIfNeeded()) return;
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

function renderStats() {
  $("hp-text").textContent = `${state.hp}/${state.maxHp}`;
  $("hp-fill").style.width = (100 * state.hp / state.maxHp) + "%";
  $("xp-text").textContent = `Ур. ${state.level}`;
  $("xp-fill").style.width = (100 * state.xp / xpForNext()) + "%";
  $("patrons").textContent = state.patrons;
  $("attack").textContent = attackPower();
  $("inv-count").textContent = state.items.length;
}

function render() {
  $("menu").hidden = true;
  $("game").hidden = false;
  renderStats();

  const scene = SCENES[state.scene];
  $("title").textContent = scene.title;
  $("text").textContent = scene.text;

  const notesBox = $("notes");
  notesBox.innerHTML = "";
  notes.forEach((n) => notesBox.appendChild(el("div", "note", n)));

  const box = $("choices");
  box.innerHTML = "";
  const enemyBox = $("enemy");
  enemyBox.hidden = !fight;

  if (fight) {
    $("enemy-name").textContent = `${fight.enemy.icon} ${fight.enemy.name}`;
    $("enemy-hp").textContent = `${Math.max(0, fight.hp)}/${fight.maxHp}`;
    $("enemy-fill").style.width = (100 * Math.max(0, fight.hp) / fight.maxHp) + "%";
    const log = $("fight-log");
    log.innerHTML = "";
    fight.log.forEach((l) => log.appendChild(el("div", "", l)));

    box.appendChild(button(`⚔️ Атаковать (сила ${attackPower()} + 🎲)`, fightAttack, { cls: "attack" }));
    const usable = [...new Set(state.items)].filter((id) => ITEMS[id].heal || ITEMS[id].damage);
    usable.forEach((id) => {
      const it = ITEMS[id];
      box.appendChild(button(`${it.icon} ${it.name} ×${count(id)}`, () => fightUseItem(id)));
    });
    box.appendChild(button("🏃 Бежать (50%)", fightFlee, { cls: "ghost" }));
    return;
  }

  if (scene.ending) {
    const labels = { good: "🌅 Хорошая концовка", rich: "💰 Концовка «Богач»", bad: "💀 Плохая концовка" };
    box.appendChild(el("div", "ending " + scene.ending, labels[scene.ending]));
    box.appendChild(button("🔄 Начать заново", newGame, { cls: "attack" }));
    haptic(scene.ending === "bad" ? "error" : "success");
    return;
  }

  scene.choices.filter(choiceVisible).forEach((c) => {
    const tooPoor = c.cost && state.patrons < c.cost;
    box.appendChild(button(c.text, () => pick(c), { disabled: tooPoor }));
  });
}

// ---------- Инвентарь ----------
function openInventory() {
  const list = $("inv-list");
  list.innerHTML = "";
  const unique = [...new Set(state.items)];
  if (!unique.length) list.appendChild(el("div", "muted", "Пусто."));
  unique.forEach((id) => {
    const it = ITEMS[id];
    const row = el("div", "inv-item");
    row.appendChild(el("div", "inv-icon", it.icon));
    const info = el("div", "inv-info");
    info.appendChild(el("div", "inv-name", `${it.name}${count(id) > 1 ? " ×" + count(id) : ""}`));
    info.appendChild(el("div", "muted", it.desc));
    row.appendChild(info);
    if (it.heal && !fight) {
      const b = el("button", "small", "Использовать");
      b.disabled = state.hp >= state.maxHp;
      b.onclick = () => {
        takeItem(id);
        changeHp(it.heal);
        notes = [`${it.icon} +${it.heal} здоровья`];
        haptic("success");
        save();
        render();
        openInventory();
      };
      row.appendChild(b);
    }
    list.appendChild(row);
  });
  $("inventory").hidden = false;
}

// ---------- Запуск ----------
function showMenu() {
  $("game").hidden = true;
  $("menu").hidden = false;
  const saved = load();
  $("continue").hidden = !(saved && SCENES[saved.scene] && !SCENES[saved.scene].ending);
}

$("new-game").onclick = newGame;
$("continue").onclick = () => {
  state = load();
  fight = null;
  notes = [];
  // если сохранились посреди боя — начинаем бой заново
  goTo(state.scene);
};
$("inv-btn").onclick = openInventory;
$("inv-close").onclick = () => { $("inventory").hidden = true; };

showMenu();
