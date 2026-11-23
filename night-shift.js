"use strict";

const NIGHT_SAVE_KEY = "odd-boxes-night-shift-v9";
const MIXED_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v8";
const NIGHT_BEST_KEY = "odd-boxes-night-best-floor";
const NIGHT_PLAYERS_KEY = "odd-boxes-night-players-v1";
const GENERATED_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v7";
const PREVIOUS_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v6";
const ATTACK_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v5";
const CHEST_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v4";
const ADDITIVE_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v3";
const REEL_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v2";
const LEGACY_NIGHT_SAVE_KEY = "odd-boxes-night-shift-v1";
const NIGHT_RULES_VERSION = 11;
const NIGHT_SCOUT_MAX_STEPS = 4;
const NIGHT_MAX_HEALTH = 3;
const NIGHT_ITEMS = {
  cheese: { name: "奶酪", hint: "在脚下放奶酪，引开巡箱鼠" },
  bell: { name: "停机铃", hint: "取消本回合的追击" },
  rewind: { name: "返工券", hint: "撤回一步，已用道具不退" }
};
const NIGHT_FACES = {
  boots: { name: "靴子", sprite: "reel-boot" },
  cheese: { name: NIGHT_ITEMS.cheese.name, sprite: "reel-cheese" },
  bell: { name: NIGHT_ITEMS.bell.name, sprite: "reel-bell" },
  rewind: { name: NIGHT_ITEMS.rewind.name, sprite: "reel-ticket" },
  broken: { name: "破靴子", sprite: "reel-broken" },
  scout: { name: "巡箱鼠", sprite: "scout" },
  chest: { name: "宝箱", sprite: "reel-chest" }
};
const NIGHT_FACE_IDS = Object.keys(NIGHT_FACES);

function rollNightReels() {
  const draw = () => NIGHT_FACE_IDS[Math.floor(Math.random() * NIGHT_FACE_IDS.length)];
  const first = draw();
  return [first, ...Array.from({ length: 2 }, () => Math.random() < 0.3 ? first : draw())];
}

function nightRollEffect(faces, rules = NIGHT_RULES_VERSION) {
  const triple = faces.every(face => face === faces[0]);
  const matching = triple ? faces[0] : null;
  const present = face => Number(faces.includes(face));
  const count = face => faces.filter(symbol => symbol === face).length;
  const stepCount = rules === 3 ? count : present;
  const steps = matching === "boots" ? 9 : matching === "broken" ? 1
    : 3 + stepCount("boots") - stepCount("broken");
  const chase = rules === 2 ? (matching === "scout" ? 3 : present("scout")) : 1 + count("scout");
  return { matching: matching, steps: steps, chase: chase };
}

function emptyNightSupply() {
  return { cheese: 0, bell: 0, rewind: 0 };
}

function validNightRoute(run) {
  if (!run) return false;
  if (run.layout) return Number.isSafeInteger(run.floor) && run.floor >= 1 && validNightLayout(run.layout);
  if (!Number.isInteger(run.room) || !NIGHT_ROOM_TYPES[run.room]) return false;
  if (Array.isArray(run.rooms)) {
    return run.rooms.length === NIGHT_ROOM_TYPES.length && run.rooms.every(validNightLayout);
  }
  return Array.isArray(run.route) && run.route.length === LEGACY_NIGHT_ROOMS.length &&
    LEGACY_NIGHT_ROOMS.every((rooms, index) => Number.isInteger(run.route[index]) && rooms[run.route[index]]);
}

function validNightLayout(level) {
  if (!level || !Array.isArray(level.map) || level.map.length < 5 ||
      typeof level.map[0] !== "string" || !level.map.every(row => typeof row === "string" &&
        row.length === level.map[0].length && /^[#.poda@bst^<>v]+$/.test(row))) return false;
  const [x, y] = Array.isArray(level.scout) ? level.scout : [];
  if (!Number.isInteger(x) || !Number.isInteger(y) || level.map[y]?.[x] !== ".") return false;
  if (level.extraScouts !== undefined && (!Array.isArray(level.extraScouts) ||
      level.extraScouts.some(point => !Array.isArray(point) || !Number.isInteger(point[0]) ||
        !Number.isInteger(point[1]) || level.map[point[1]]?.[point[0]] !== "."))) return false;
  const tiles = level.map.join("");
  return (tiles.match(/@/g) || []).length === 1 && /[bst]/.test(tiles) &&
    (tiles.match(/[bst]/g) || []).length === (tiles.match(/[op]/g) || []).length;
}

function nightRoom(run) {
  return run.layout || run.rooms?.[run.room] || LEGACY_NIGHT_ROOMS[run.room][run.route[run.room]];
}

function nightFloorNumber(run) {
  return run.floor ?? run.room + 1;
}

function validNightRun(run) {
  return validNightRoute(run) && run.supply && Object.keys(NIGHT_ITEMS).every(item =>
    Number.isInteger(run.supply[item]) && run.supply[item] >= 0) && Array.isArray(run.actions) &&
    (run.coins === undefined || (Number.isSafeInteger(run.coins) && run.coins >= 0)) &&
    (run.health === undefined || (Number.isInteger(run.health) && run.health > 0 && run.health <= NIGHT_MAX_HEALTH));
}

function validNightRoll(action) {
  return Array.isArray(action) && action.length === 3 &&
    action.every(face => typeof face === "string" && Object.hasOwn(NIGHT_FACES, face));
}

const LEGACY_NIGHT_ROOMS = [
  [
    { title: "试探", scout: [6, 2], map: [
      "########", "#......#", "#.@b...#", "#......#", "#....o.#", "#......#", "########"
    ] },
    { title: "抢先签收", scout: [1, 5], map: [
      "########", "#......#", "#.@s...#", "#......#", "#.#..o.#", "#......#", "########"
    ] }
  ],
  [
    { title: "门外等候", scout: [6, 1], accent: "gate", hint: "把箱子留在压板上，木门就会保持打开。", map: [
      "########", "#...#..#", "#..bd.o#", "##.@#..#", "#.bp#..#", "#......#", "########"
    ] },
    { title: "绕进库房", scout: [3, 1], accent: "gate", hint: "让弹簧箱压住压板，再把普通箱推过门。", map: [
      "########", "#...#..#", "#...#..#", "#.b.d.o#", "#.sp#..#", "#..@#..#", "########"
    ] }
  ],
  [
    { title: "顺流发货", scout: [3, 5], accent: "belt", hint: "箱子落上箭头，就会再被送一格。", map: [
      "########", "#.s.>o.#", "#.#..#.#", "#..s.v.#", "##..#o.#", "#@>.####", "########"
    ] },
    { title: "并排上带", scout: [6, 5], accent: "belt", hint: "两只蓝箱会一起动，给传送带留出落脚格。", map: [
      "########", "#...#..#", "#.t.>o.#", "#@..b..#", "#.t.>o.#", "#....o.#", "########"
    ] }
  ],
  [
    { title: "双箱穿门", scout: [7, 5], accent: "portal", hint: "出口空着时，双胞胎箱可以依次穿门。", map: [
      "#########", "#....b.o#", "#..a...o#", "#...#a.o#", "#..t#...#", "#..t#...#", "#.@.....#", "#########"
    ] },
    { title: "最后一跳", scout: [7, 1], accent: "portal", hint: "让弹簧箱跳到门上，它会从另一端出来。", map: [
      "#########", "#.....o.#", "#..a#...#", "#....a.##", "#..s#...#", "#..@b.o.#", "#.......#", "#########"
    ] }
  ]
];

function newNightRun() {
  const layout = createNightFloor(1);
  if (!layout) return null;
  return {
    layout,
    floor: 1,
    coins: 0,
    supply: { cheese: 1, bell: 1, rewind: 1 },
    health: NIGHT_MAX_HEALTH,
    actions: []
  };
}

function readNightRun() {
  try {
    const run = JSON.parse(localStorage.getItem(NIGHT_SAVE_KEY));
    if (validNightRun(run)) {
      return { ...run, previousV9ActionCount: run.actions.length, previousV10ActionCount: run.actions.length };
    }
    const mixed = JSON.parse(localStorage.getItem(MIXED_NIGHT_SAVE_KEY));
    if (validNightRun(mixed)) return { ...mixed, previousV8ActionCount: mixed.actions.length };
    const generated = JSON.parse(localStorage.getItem(GENERATED_NIGHT_SAVE_KEY));
    if (validNightRun(generated)) return { ...generated, previousV7ActionCount: generated.actions.length };
    const previous = JSON.parse(localStorage.getItem(PREVIOUS_NIGHT_SAVE_KEY));
    if (validNightRun(previous)) return { ...previous, previousV6ActionCount: previous.actions.length };
    const attackRun = JSON.parse(localStorage.getItem(ATTACK_NIGHT_SAVE_KEY));
    if (validNightRun(attackRun)) return { ...attackRun, previousV5ActionCount: attackRun.actions.length };
    const chestRun = JSON.parse(localStorage.getItem(CHEST_NIGHT_SAVE_KEY));
    if (validNightRun(chestRun)) return { ...chestRun, previousV4ActionCount: chestRun.actions.length };
    const additive = JSON.parse(localStorage.getItem(ADDITIVE_NIGHT_SAVE_KEY));
    if (validNightRun(additive)) return { ...additive, previousV3ActionCount: additive.actions.length };
    const reelRun = JSON.parse(localStorage.getItem(REEL_NIGHT_SAVE_KEY));
    if (validNightRun(reelRun)) return { ...reelRun, previousActionCount: reelRun.actions.length };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_NIGHT_SAVE_KEY));
    if (validNightRoute(legacy)) {
      return { route: legacy.route, room: legacy.room, supply: emptyNightSupply(), actions: [] };
    }
  } catch (error) {
    // The challenge can be played without browser storage.
  }
  return null;
}

function readNightBest() {
  try {
    const value = Number(localStorage.getItem(NIGHT_BEST_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch (error) {
    return 0;
  }
}

function readNightPlayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(NIGHT_PLAYERS_KEY));
    if (Array.isArray(saved?.roster)) {
      const roster = saved.roster.flatMap(function (player) {
        if (typeof player?.name !== "string" || !player.name.trim()) return [];
        let run = validNightRun(player.run) ? player.run : null;
        if (run && !(saved.rules >= 10)) run = { ...run, previousV9ActionCount: run.actions.length };
        if (run && !(saved.rules >= 11)) run = { ...run, previousV10ActionCount: run.actions.length };
        const best = Number.isSafeInteger(player.best) && player.best > 0 ? player.best : 0;
        return [{ name: player.name, best: Math.max(best, run ? nightFloorNumber(run) : 0), run }];
      });
      return { active: roster.some(player => player.name === saved.active) ? saved.active : null, roster };
    }
  } catch (error) {
    // The game can still keep characters in this page.
  }
  return { active: null, roster: [] };
}

function writeNightPlayers(players) {
  try {
    localStorage.setItem(NIGHT_PLAYERS_KEY, JSON.stringify({ ...players, rules: NIGHT_RULES_VERSION }));
    return true;
  } catch (error) {
    return false;
  }
}

function nightShopPrice(item, floor) {
  const base = { cheese: 12, bell: 17, rewind: 20 }[item];
  return base + Math.min(8, 2 * Math.max(0, Math.floor(floor / 5) - 1));
}

function earnNightCoins(map, state) {
  const delivered = state.boxes.filter(box => map.goals.has(cellKey(map, box)) && !state.paidBoxes.includes(box.id));
  const turns = state.turns + 1;
  const movementBonus = turns <= 2 && state.steps - state.turnStart >= 2 ? 1 : 0;
  const clearBonus = !nightLost(state) && nightWon(map, state) && turns <= 5 && state.steps <= 15 ? 1 : 0;
  const coins = 2 * delivered.length + movementBonus + clearBonus;
  return { ...state, turns, remaining: 0, coins: state.coins + coins, coinGain: coins,
    paidBoxes: [...state.paidBoxes, ...delivered.map(box => box.id)] };
}

function nightFloor(map, point, gateOpen = false) {
  const key = cellKey(map, point);
  return !blockedCell(map, point, gateOpen) && !map.goals.has(key) &&
    !map.belts.has(key) && !map.portals.has(key);
}

function scoutGateOpen(map, state) {
  return state.rules >= 10 && map.gates.size > 0 && pressureState(map, state).gateOpen;
}

function scoutPath(map, state, targets, allowTargetTerrain = false) {
  const { scout, player, boxes } = state;
  const smart = state.rules >= 4;
  const gateOpen = scoutGateOpen(map, state);
  const frontier = [{ point: scout, path: [] }];
  const visited = new Set([cellKey(map, scout)]);
  let best = [];
  let bestDistance = -1;
  for (let i = 0; i < frontier.length; i++) {
    const { point, path } = frontier[i];
    if (best.length && path.length >= best.length) break;
    for (const direction of Object.values(DIRECTIONS)) {
      const next = offset(point, direction);
      const key = cellKey(map, next);
      const target = targets.some(target => sameCell(target, next));
      if (visited.has(key) || state.otherScouts?.some(rat => sameCell(rat, next)) ||
          (!nightFloor(map, next, gateOpen) && !(allowTargetTerrain && target))) continue;
      visited.add(key);
      if (target) {
        if (!smart || targets.length === 1) return [...path, next];
        // Among equally close crates, steal the one farther from the rabbit.
        const distance = Math.abs(player.x - next.x) + Math.abs(player.y - next.y);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = [...path, next];
        }
        continue;
      }
      if (sameCell(next, player) || boxes.some(box => sameCell(box, next))) continue;
      frontier.push({ point: next, path: [...path, next] });
    }
  }
  return best;
}

function scoutPatrol(map, state, steps) {
  const path = [];
  let current = state.scout;
  const gateOpen = scoutGateOpen(map, state);
  const visited = new Set([cellKey(map, current)]);
  while (path.length < steps) {
    const options = Object.values(DIRECTIONS).map(direction => offset(current, direction)).filter(point =>
      nightFloor(map, point, gateOpen) && !visited.has(cellKey(map, point)) && !sameCell(point, state.player) &&
      !state.boxes.some(box => sameCell(point, box)) && !state.otherScouts?.some(rat => sameCell(rat, point)));
    const next = options.find(point => !state.scoutFrom || !sameCell(point, state.scoutFrom)) || options[0];
    if (!next) break;
    visited.add(cellKey(map, next));
    path.push(next);
    current = next;
  }
  return path;
}

function planScout(map, state, blockedCrateRoute = false) {
  if (!state.chase) return [];
  if (state.bait) {
    const lure = scoutPath(map, state, [state.bait]);
    if (lure.length || state.rules < 4) {
      return lure.length || !state.canPatrol ? lure.slice(0, state.chase) : scoutPatrol(map, state, state.chase);
    }
  }
  let path = scoutPath(map, state, state.boxes);
  if (state.rules >= 11) {
    // Keep closing in on freight even when it takes more than one turn to reach it.
    if (path.length) return path.slice(0, state.chase);
    const rabbit = scoutPath(map, state, [state.player], true);
    return rabbit.length && rabbit.length <= state.chase
      ? rabbit : scoutPatrol(map, state, state.chase);
  }
  if (state.rules >= 8) {
    if (!blockedCrateRoute && path.length && path.length <= state.chase) return path;
    const rabbit = scoutPath(map, state, [state.player], true);
    if (rabbit.length) return rabbit.slice(0, state.chase);
    return path.length ? path.slice(0, state.chase) : scoutPatrol(map, state, state.chase);
  }
  if (state.rules >= 5 && (!path.length || state.rules === 5)) {
    const rabbit = scoutPath(map, state, [state.player], true);
    // Old rolls could choose a nearer rabbit even with a crate in reach.
    if (rabbit.length && (!path.length || (rabbit.length <= state.chase && rabbit.length <= path.length))) {
      path = rabbit;
    }
  }
  return path.length || !state.canPatrol ? path.slice(0, state.chase) : scoutPatrol(map, state, state.chase);
}

function nightWon(map, state) {
  return state.boxes.length > 0 && deliveredCount(map, state) === state.boxes.length;
}

function nightLost(state) {
  return Boolean(state.caught) || state.health === 0 || state.boxes.length === 0;
}

function scoutWillBite(state, point) {
  return state.rules >= 5 && sameCell(point, state.player) &&
    (!state.bait || !sameCell(point, state.bait));
}

function settleNightTurn(map, state) {
  if (state.rules >= 9) return settleTowerTurn(map, state);
  const next = { ...state, remaining: 0, trail: [] };
  let crateDetour = false;
  // Resolve the route the player could see before the action that ended the turn.
  for (const point of state.trail) {
    if (sameCell(point, state.player)) {
      if (state.rules >= 5 && state.bait && sameCell(point, state.bait)) {
        next.bait = null;
      } else if (scoutWillBite(state, point)) {
        const alternative = state.rules === 6 || state.rules === 7 ? scoutPath(map, next, next.boxes) : [];
        crateDetour = alternative.length > 0;
        if (!crateDetour) {
          next.health--;
          next.bitten = true;
        } else if (alternative.length > 1) {
          // Take one safe step toward the crate without stealing on an unmarked tile.
          next.scoutFrom = next.scout;
          next.scout = alternative[0];
        }
      }
      break;
    }
    if (!nightFloor(map, point)) break;
    next.scoutFrom = next.scout;
    next.scout = point;
    if (state.boxes.some(box => sameCell(box, point))) {
      next.caught = point;
      break;
    }
    if (next.bait && sameCell(point, next.bait)) {
      next.bait = null;
      break;
    }
  }
  // If the rabbit blocked the first tile, take an empty patrol tile instead.
  if (state.canPatrol && !state.stopped && !next.bitten && !crateDetour &&
      next.bait === state.bait && sameCell(next.scout, state.scout)) {
    const [detour] = scoutPatrol(map, state, 1);
    if (detour) {
      next.scoutFrom = state.scout;
      next.scout = detour;
    }
  }
  return next;
}

function nightScouts(state) {
  return [state.scout, ...state.otherScouts];
}

function planTowerScouts(map, state) {
  const rats = nightScouts(state);
  const previousTrails = [state.trail, ...state.otherTrails];
  const trails = rats.map(function (scout, index) {
    const oldTrail = previousTrails[index] || [];
    const target = oldTrail.at(-1);
    const blocked = target && state.boxes.some(box => sameCell(box, target)) &&
      oldTrail.some(point => sameCell(point, state.player));
    return planScout(map, { ...state, scout, scoutFrom: index === 0 ? state.scoutFrom : undefined,
      otherScouts: rats.filter((_, other) => other !== index) }, blocked);
  });
  return { ...state, trail: trails[0], otherTrails: trails.slice(1) };
}

function settleTowerTurn(map, state) {
  const scouts = nightScouts(state);
  const trails = [state.trail, ...state.otherTrails];
  let { boxes, health, bait } = state;
  let scoutFrom = state.scoutFrom;
  let bitten = false;
  let stolen = 0;
  trails.forEach(function (trail, index) {
    const gateOpen = scoutGateOpen(map, { ...state, boxes });
    for (const point of trail) {
      if (scouts.some((rat, other) => other !== index && sameCell(rat, point))) break;
      if (sameCell(point, state.player)) {
        if (bait && sameCell(point, bait)) bait = null;
        else if (!bitten) {
          health--;
          bitten = true;
        }
        break;
      }
      if (!nightFloor(map, point, gateOpen)) break;
      if (index === 0) scoutFrom = scouts[0];
      scouts[index] = point;
      const crate = boxes.find(box => sameCell(box, point));
      if (crate) {
        boxes = boxes.filter(box => box !== crate);
        stolen++;
        break;
      }
      if (bait && sameCell(point, bait)) {
        bait = null;
        break;
      }
    }
  });
  return earnNightCoins(map, { ...state, boxes, health, bait, scout: scouts[0], scoutFrom,
    otherScouts: scouts.slice(1), trail: [], otherTrails: [], bitten, stolen });
}

function makeNightSession(level, supply, health, floor = 1, coins = 0) {
  const map = readMap(level.map);
  const [x, y] = level.scout;
  const state = { ...map.initial, scout: { x: x, y: y }, roll: null, remaining: 0,
    boxes: map.initial.boxes.map((box, id) => ({ ...box, id })),
    otherScouts: (level.extraScouts || []).map(([x, y]) => ({ x, y })),
    otherTrails: [], trail: [], stopped: false, bait: null, caught: null, health: health ?? NIGHT_MAX_HEALTH,
    bitten: false, stolen: 0, coins, coinGain: 0, turns: 0, turnStart: 0, paidBoxes: [], purchases: [] };
  return { map: map, state: state, supply: { ...supply }, floor, history: [], facingLeft: false };
}

function beginNightRoom(run) {
  const session = makeNightSession(nightRoom(run), run.supply, run.health, nightFloorNumber(run), run.coins || 0);
  const doorUpgrade = run.previousV9ActionCount;
  const priorityUpgrade = run.previousV10ActionCount;
  for (const [index, action] of run.actions.entries()) {
    if (index === doorUpgrade) upgradeNightScoutRoutes(session, 9, 10);
    if (index === priorityUpgrade) upgradeNightScoutRoutes(session, 10, 11);
    const rules = index < (run.previousActionCount || 0) ? 2
      : index < (run.previousV3ActionCount || 0) ? 3
        : index < (run.previousV4ActionCount || 0) ? 4
          : index < (run.previousV5ActionCount || 0) ? 5
            : index < (run.previousV6ActionCount || 0) ? 6
              : index < (run.previousV7ActionCount || 0) ? 7
                : index < (run.previousV8ActionCount || 0) ? 8
                  : index < (doorUpgrade || 0) ? 9
                    : index < (priorityUpgrade || 0) ? 10 : NIGHT_RULES_VERSION;
    const result = nightAction(session, action, rules);
    if (!result || result.blocked) return null;
  }
  if (run.actions.length === doorUpgrade) upgradeNightScoutRoutes(session, 9, 10);
  if (run.actions.length === priorityUpgrade) upgradeNightScoutRoutes(session, 10, 11);
  return session;
}

function upgradeNightScoutRoutes(session, previous, rules) {
  const upgrade = function (state) {
    if (state.rules !== previous || !state.remaining || nightWon(session.map, state) || nightLost(state)) return state;
    const next = { ...state, rules, trail: [], otherTrails: [] };
    return state.stopped ? next : planTowerScouts(session.map, next);
  };
  session.state = upgrade(session.state);
  session.history = session.history.map(turn => ({ ...turn, state: upgrade(turn.state) }));
}

function canEndNightTurn(map, state) {
  return state.remaining > 0 && (state.remaining < state.turnSteps ||
    !Object.values(DIRECTIONS).some(direction => {
      const result = step(map, state, direction);
      return result && !result.blocked;
    }));
}

function nightAction(session, action, rules = NIGHT_RULES_VERSION) {
  const { map, state, history, supply } = session;
  if (nightWon(map, state)) {
    if (nightLost(state) || session.floor % 5 !== 0 || typeof action !== "string" || !action.startsWith("buy-")) return null;
    const item = action.slice(4);
    if (!Object.hasOwn(NIGHT_ITEMS, item) || state.purchases.includes(item)) return null;
    const price = nightShopPrice(item, session.floor);
    if (state.coins < price) return null;
    supply[item]++;
    session.state = { ...state, coins: state.coins - price, purchases: [...state.purchases, item] };
    return { bought: true };
  }
  if (state.chestPending) {
    if (typeof action !== "string" || !action.startsWith("chest-")) return null;
    const item = action.slice("chest-".length);
    if (!Object.hasOwn(NIGHT_ITEMS, item)) return null;
    supply[item]++;
    session.state = { ...state, chestPending: false };
    return { claimed: true };
  }
  if (action === "rewind") {
    if (!history.length || !supply.rewind) return null;
    const turn = history.pop();
    session.state = turn.state;
    session.facingLeft = turn.facingLeft;
    supply.rewind--;
    return { rewound: true };
  }
  if (nightLost(state)) return null;
  if (validNightRoll(action)) {
    if (state.remaining) return null;
    const { matching, steps, chase } = nightRollEffect(action, rules);
    Object.keys(supply).forEach(item => {
      if (rules >= 7 && item === "rewind" && matching === "rewind") return;
      if (rules >= 8 && matching !== item) return;
      if (action.includes(item)) supply[item] += matching === item ? 3 : 1;
    });
    history.length = 0;
    const next = { ...state, roll: action, remaining: steps, turnSteps: steps, chase, rules,
      canPatrol: rules >= 3, stopped: false, bitten: false, stolen: 0, coinGain: 0,
      turnStart: state.steps, chestPending: matching === "chest" };
    if (rules >= 9) session.state = planTowerScouts(map, next);
    else {
      next.trail = planScout(map, next);
      session.state = next;
    }
    return { rolled: true };
  }
  if (typeof action !== "string" || !state.remaining) return null;
  if (action === "end") {
    if (!canEndNightTurn(map, state)) return null;
    session.state = settleNightTurn(map, state);
    return { ended: true };
  }
  if (Object.hasOwn(DIRECTIONS, action)) {
    const result = step(map, state, DIRECTIONS[action]);
    if (!result || result.blocked) return result;
    history.push({ state: state, facingLeft: session.facingLeft });
    if (action === "left" || action === "right") session.facingLeft = action === "left";
    const next = { ...state, ...result.state, remaining: state.remaining - 1 };
    if (next.rules >= 9) {
      if (nightWon(map, next)) {
        session.state = earnNightCoins(map, next);
        return result;
      }
      const route = !next.stopped && (next.remaining || next.rules >= 11) ? planTowerScouts(map, next) : next;
      session.state = next.remaining ? route : settleNightTurn(map, route);
      return result;
    }
    if (next.remaining && !next.stopped && state.rules >= 4) {
      const previousDestination = state.trail.at(-1);
      const blockedCrateRoute = state.rules >= 8 && previousDestination &&
        state.boxes.some(box => sameCell(box, previousDestination)) &&
        state.trail.some(point => sameCell(point, next.player));
      next.trail = planScout(map, next, blockedCrateRoute);
    }
    session.state = next.remaining || nightWon(map, next) ? next : settleNightTurn(map, next);
    return result;
  }
  if ((action !== "cheese" && action !== "bell") || !supply[action]) return null;
  if (action === "cheese" && (!nightFloor(map, state.player) ||
      (state.bait && sameCell(state.bait, state.player)))) return null;
  if (action === "bell" && !state.trail.length && !state.otherTrails.some(trail => trail.length)) return null;
  const next = { ...state };
  if (action === "bell") {
    next.stopped = true;
    next.trail = [];
    next.otherTrails = [];
  } else {
    next.bait = state.player;
    if (!state.stopped) next.trail = planScout(map, next);
  }
  supply[action]--;
  session.state = action === "cheese" && next.rules >= 9 && !next.stopped ? planTowerScouts(map, next) : next;
  return { usedItem: true };
}
