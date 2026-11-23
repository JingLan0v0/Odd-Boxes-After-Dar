"use strict";

const NIGHT_ROOM_TYPES = [
  { title: "夜班仓位", hint: "把箱子推到发光格，避开巡箱鼠。" },
  { title: "隔门发货", accent: "gate", hint: "让一只箱子压住压板，再把另一只箱子推过门。" },
  { title: "传送货道", accent: "belt", hint: "把箱子送上传送带，留意箭头方向。" },
  { title: "跨区送货", accent: "portal", hint: "用紫色传送门运箱，出口被占时可以绕行。" }
];
const NIGHT_LAYOUT_HISTORY_KEY = "odd-boxes-night-layout-history";

function nightGrid(width, height) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
    x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "#" : "."));
}

function nightRandom(seed) {
  let state = seed >>> 0;
  return function (min, max) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return min + Math.floor(state / 4294967296 * (max - min + 1));
  };
}

function freeNightTile(grid, random, accepts = () => true) {
  const available = [];
  grid.forEach((row, y) => row.forEach((tile, x) => {
    if (tile === "." && accepts(x, y)) available.push([x, y]);
  }));
  return available.length ? available[random(0, available.length - 1)] : null;
}

function nightRoomCandidate(kind, random, relaxed, floor) {
  const tier = Math.min(2, Math.floor((floor - 1) / 5));
  const width = random(8, kind === 0 ? 9 : 10) + tier;
  const height = random(7, 8) + tier;
  const grid = nightGrid(width, height);
  const put = (x, y, tile) => { grid[y][x] = tile; };
  const reserved = new Set();
  const reserveRow = (y, from, to) => {
    for (let x = from; x <= to; x++) reserved.add(y * width + x);
  };
  const split = Math.floor(width / 2);
  let playerSide = () => true;
  let scoutSide = () => true;
  let cargoSide = () => true;
  let wallSide = () => true;
  let guide;

  if (kind === 0) {
    const y = random(2, height - 3);
    const spring = random(0, 1) === 1;
    const x = random(2, width - 5);
    put(x, y, spring ? "s" : "b");
    put(x + random(2, spring ? 3 : width - x - 2), relaxed ? y : random(2, height - 3), "o");
    reserveRow(y, x - 1, x + 2);
    scoutSide = (sx, sy) => Math.abs(sx - x) + Math.abs(sy - y) >= 4;
  } else if (kind === 1) {
    const doorY = random(2, height - 3);
    const plateY = doorY < height / 2 ? height - 2 : 1;
    const stable = relaxed && floor >= 6;
    for (let y = 1; y < height - 1; y++) put(split, y, y === doorY ? "d" : "#");
    put(split - 1, doorY, "b");
    put(split + (stable ? 1 : random(1, width - split - 2)), doorY, "o");
    const plateX = stable ? split - 1 : random(2, split - 1);
    put(plateX, plateY, "p");
    put(plateX - 1, plateY, "b");
    // Leave space behind the plate box, including when the left half is only three cells wide.
    if (plateX === 2) {
      put(1, plateY, ".");
      put(2, plateY === 1 ? 2 : height - 3, "b");
    }
    reserveRow(doorY, 1, width - 2);
    if (stable) {
      const cargoY = plateY === 1 ? height - 2 : 1;
      const spring = split >= 5 && random(0, 1) === 1;
      put(2, cargoY, spring ? "s" : "b");
      put(spring ? 4 : 3, cargoY, "o");
      reserveRow(plateY, 1, split - 1);
      reserveRow(cargoY, 1, split - 1);
      wallSide = x => x > split;
      guide = [[split - 3, plateY, 1], [1, cargoY, 1], [split - 2, doorY, 2]];
    }
    playerSide = x => x < split;
    scoutSide = (x, y) => x > split && Math.abs(y - doorY) >= 2;
    cargoSide = x => x < split;
  } else if (kind === 2) {
    const column = random(4, width - 3);
    const twin = random(0, 1) === 1;
    const laneRows = [random(2, 3), height - 3];
    if (laneRows[1] - laneRows[0] < 2) laneRows[0] = laneRows[1] - 2;
    laneRows.forEach((y, lane) => {
      const turn = !relaxed && random(0, 1) === 1;
      const away = lane === 0 ? -1 : 1;
      put(column - (twin ? 1 : 2), y, twin ? "t" : "s");
      put(column, y, turn ? (away < 0 ? "^" : "v") : ">");
      put(column + (turn ? 0 : 1), y + (turn ? away : 0), "o");
      reserveRow(y, column - 3, column + 1);
    });
    playerSide = x => x < column - 1;
    scoutSide = x => x > column;
  } else {
    const entranceY = random(2, height - 3);
    const crossingY = entranceY < height / 2 ? height - 2 : 1;
    const exitY = random(2, height - 3);
    const spring = split >= 5 && !relaxed && random(0, 1) === 1;
    // The open passage is how the rabbit can go around a crate occupying the exit.
    for (let y = 1; y < height - 1; y++) put(split, y, y === crossingY ? "." : "#");
    put(split - 1, entranceY, "a");
    put(split + 1, exitY, "a");
    put(split - (spring ? 3 : 2), entranceY, spring ? "s" : "b");
    const unloadDirection = exitY <= height / 2 ? 1 : -1;
    put(split + 1, exitY + unloadDirection, "o");
    reserved.add((exitY - unloadDirection) * width + split + 1);
    if (!relaxed && random(0, 1) === 1) {
      const cargoY = crossingY === 1 ? 2 : height - 3;
      put(split + 2, cargoY, "b");
      put(split + 2, crossingY, "o");
    }
    reserveRow(entranceY, 1, split - 1);
    reserveRow(exitY, split + 1, width - 2);
    reserveRow(crossingY, split - 1, split + 1);
    playerSide = x => x < split;
    scoutSide = (x, y) => x > split && Math.abs(y - exitY) >= 2;
    cargoSide = x => x < split;
  }

  const targetCrates = floor === 1 ? 1 : floor <= 5 ? 2 : 3;
  let count = grid.flat().filter(tile => "bst".includes(tile)).length;
  while (count < targetCrates) {
    const candidates = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 2; x < width - 2; x++) {
        for (const direction of [1, -1]) {
          if ([x - direction, x, x + direction].every(tile =>
              cargoSide(tile, y) && grid[y][tile] === "." && !reserved.has(y * width + tile))) {
            candidates.push([x, y, direction]);
          }
        }
      }
    }
    if (!candidates.length) return null;
    const [x, y, direction] = candidates[random(0, candidates.length - 1)];
    put(x, y, "b");
    put(x + direction, y, "o");
    reserveRow(y, x - 1, x + 1);
    count++;
  }

  const player = freeNightTile(grid, random, playerSide);
  if (!player) return null;
  put(...player, "@");
  const scout = freeNightTile(grid, random, scoutSide);
  if (!scout) return null;
  const rats = [scout];
  if (floor >= 11) {
    const extra = freeNightTile(grid, random, (x, y) =>
      scoutSide(x, y) && Math.abs(x - scout[0]) + Math.abs(y - scout[1]) >= 2);
    if (!extra) return null;
    rats.push(extra);
  }
  const wallCount = relaxed ? random(0, 2) : random(2, 5);
  for (let i = 0; i < wallCount; i++) {
    const wall = freeNightTile(grid, random, (x, y) =>
      wallSide(x, y) && !reserved.has(y * width + x) && !rats.some(([rx, ry]) => x === rx && y === ry));
    if (wall) put(...wall, "#");
  }
  // Flip the entire layout and turn its directional belts with it.
  const mirror = random(0, 1) === 1;
  const flip = random(0, 1) === 1;
  if (mirror) {
    grid.forEach(row => row.reverse().forEach((tile, x) => {
      if (tile === ">" || tile === "<") row[x] = tile === ">" ? "<" : ">";
    }));
    rats.forEach(rat => { rat[0] = width - 1 - rat[0]; });
  }
  if (flip) {
    grid.reverse().forEach(row => row.forEach((tile, x) => {
      if (tile === "^" || tile === "v") row[x] = tile === "^" ? "v" : "^";
    }));
    rats.forEach(rat => { rat[1] = height - 1 - rat[1]; });
  }
  if (guide) {
    guide = guide.map(([x, y, pushes]) => ({
      stand: { x: mirror ? width - 1 - x : x, y: flip ? height - 1 - y : y },
      direction: mirror ? "left" : "right",
      pushes
    }));
  }
  return { ...NIGHT_ROOM_TYPES[kind], scout, extraScouts: rats.slice(1), guide, map: grid.map(row => row.join("")) };
}

const NIGHT_VALIDATION_ROLL = ["boots", "broken", "chest"];
const NIGHT_VALIDATION_OPENING = ["broken", "chest", "bell"];

function nightValidationRoll(state) {
  return state.turns === 0 ? NIGHT_VALIDATION_OPENING : NIGHT_VALIDATION_ROLL;
}

function walkNightRoute(map, state, target) {
  const queue = [{ player: state.player, path: [] }];
  const visited = new Set([cellKey(map, state.player)]);
  for (const current of queue) {
    if (sameCell(current.player, target)) return current.path;
    for (const [name, direction] of Object.entries(DIRECTIONS)) {
      const move = step(map, { ...state, player: current.player }, direction);
      if (!move || move.blocked || move.moved.length) continue;
      const player = move.state.player;
      const key = cellKey(map, player);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ player, path: [...current.path, name] });
    }
  }
  return null;
}

function testNightDeliveryGuide(session, guide) {
  const moves = [];
  const { map } = session;
  const crateCount = session.state.boxes.length;
  for (const delivery of guide) {
    const path = walkNightRoute(map, session.state, delivery.stand);
    if (!path) return null;
    const pushes = Array(delivery.pushes).fill(delivery.direction);
    for (const action of [...path, ...pushes]) {
      if (!session.state.remaining) {
        const roll = nightValidationRoll(session.state);
        if (!nightAction(session, roll)) return null;
        moves.push(roll);
      }
      const result = nightAction(session, action);
      if (!result || result.blocked || nightLost(session.state) || session.state.boxes.length !== crateCount) return null;
      moves.push(action);
    }
  }
  return nightWon(map, session.state) ? moves : null;
}

function nightMapSolution(level, budget) {
  const initial = makeNightSession(level, emptyNightSupply(), 1);
  const { map } = initial;
  const directions = Object.values(DIRECTIONS);
  if (nightScouts(initial.state).some(rat => !directions.some(direction => nightFloor(map, offset(rat, direction))))) return null;
  const area = [initial.state.player];
  const connected = new Set([cellKey(map, initial.state.player)]);
  for (const point of area) {
    for (const direction of directions) {
      const next = offset(point, direction);
      const key = cellKey(map, next);
      if (blockedCell(map, next, true) || connected.has(key)) continue;
      connected.add(key);
      area.push(next);
    }
  }
  if (connected.size !== map.width * map.height - map.walls.size) return null;
  if (level.guide) return testNightDeliveryGuide(initial, level.guide);
  const requiredMotion = map.portals.size ? "warp" : map.belts.size ? "ride" : null;
  const goals = [...map.goals].map(key => ({ x: key % map.width, y: Math.floor(key / map.width) }));
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const distanceToGoal = (box, goal) => {
    let shortest = distance(box, goal);
    for (const [key, exit] of map.portals) {
      const entry = { x: key % map.width, y: Math.floor(key / map.width) };
      shortest = Math.min(shortest, distance(box, entry) + distance(exit, goal));
    }
    return shortest;
  };
  const options = Object.keys(DIRECTIONS).concat("end");
  const frontier = new Map();
  const visited = new Set();
  let lowest = Infinity;

  function enqueue(state, usedMechanism, moves) {
    const key = [cellKey(map, state.player), ...state.boxes.map(box => cellKey(map, box)),
      ...nightScouts(state).map(rat => cellKey(map, rat)), state.scoutFrom ? cellKey(map, state.scoutFrom) : -1,
      state.remaining, Number(state.turns === 0), Number(usedMechanism), [state.trail, ...state.otherTrails]
        .map(trail => trail.map(point => cellKey(map, point)).join(".")).join("|")].join(",");
    if (visited.has(key)) return;
    visited.add(key);
    const distanceLeft = state.boxes.reduce((sum, box) => sum + Math.min(...goals.map(goal => distanceToGoal(box, goal))), 0);
    const priority = state.steps + 5 * distanceLeft + (usedMechanism ? 0 : 5);
    if (!frontier.has(priority)) frontier.set(priority, []);
    frontier.get(priority).push({ state, usedMechanism, moves });
    lowest = Math.min(lowest, priority);
  }

  enqueue(initial.state, !requiredMotion, []);
  for (let count = 0; frontier.size && count < budget; count++) {
    const group = frontier.get(lowest);
    const { state, usedMechanism, moves } = group.pop();
    if (!group.length) {
      frontier.delete(lowest);
      lowest = Math.min(...frontier.keys());
    }
    if (nightWon(map, state)) {
      if (usedMechanism && state.steps >= 4) return moves;
      continue;
    }
    if (state.steps >= 60) continue;
    for (const action of state.remaining ? options : [nightValidationRoll(state)]) {
      const child = { map, state, history: [], facingLeft: false, supply: emptyNightSupply() };
      const result = nightAction(child, action);
      if (!result || result.blocked || nightLost(child.state) || child.state.boxes.length !== initial.state.boxes.length) continue;
      const used = usedMechanism || Boolean(result.boxTravels?.some(item => item.travel.motion === requiredMotion));
      enqueue(child.state, used, [...moves, action]);
    }
  }
  return null;
}

function nightLayoutKey(level) {
  return level.map.join("/");
}

function generateNightFloor(floor, seed, recent = []) {
  const random = nightRandom(seed);
  const known = new Set([...recent, ...LEGACY_NIGHT_ROOMS.flat().map(nightLayoutKey)]);
  const kind = (floor - 1) % NIGHT_ROOM_TYPES.length;
  const preferredAttempts = floor >= 11 ? 2 : 7;
  for (let attempt = 0; attempt < 28; attempt++) {
    const recipe = attempt < preferredAttempts ? kind : floor >= 6 ? 1 : (kind + 1 + Math.floor(attempt / 5)) % NIGHT_ROOM_TYPES.length;
    const level = nightRoomCandidate(recipe, random, attempt >= preferredAttempts || kind === 1, floor);
    const budget = attempt < preferredAttempts ? (floor >= 11 ? 700 : 1100) : 1700;
    if (level && !known.has(nightLayoutKey(level)) && nightMapSolution(level, budget)) return level;
  }
  return null;
}

function createNightFloor(floor) {
  let recent = [];
  try {
    const saved = JSON.parse(localStorage.getItem(NIGHT_LAYOUT_HISTORY_KEY));
    if (Array.isArray(saved)) recent = saved.filter(key => typeof key === "string").slice(-256);
  } catch (error) {
    // Generate a new layout even when browser storage is unavailable.
  }
  const layout = generateNightFloor(floor, Math.floor(Math.random() * 4294967296), recent);
  if (layout) {
    try {
      localStorage.setItem(NIGHT_LAYOUT_HISTORY_KEY, JSON.stringify([...recent, nightLayoutKey(layout)].slice(-256)));
    } catch (error) {
      // The current run can still use the generated layouts.
    }
  }
  if (!layout) return null;
  const { guide, ...savedLayout } = layout;
  return savedLayout;
}
