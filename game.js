"use strict";

const DIRECTIONS = {
  up: [0, -1],
  left: [-1, 0],
  down: [0, 1],
  right: [1, 0]
};
const KEY_DIRECTIONS = {
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right"
};
const BOX_TYPES = { b: "plain", s: "spring", t: "twin" };
const BELT_DIRECTIONS = { "^": "up", "<": "left", v: "down", ">": "right" };
const SAVE_KEY = "odd-boxes-campaign-v2";
const PREVIOUS_SAVE_KEY = "odd-boxes-campaign-v1";
const LEGACY_SAVE_KEY = "odd-boxes-progress-v1";
const SAVE_SLOT_COUNT = 3;
const PREVIOUS_LEVELS = [0, 1, 2, null, 3, 4];

function readMap(rows) {
  const walls = new Set();
  const goals = new Set();
  const plates = new Set();
  const gates = new Set();
  const belts = new Map();
  const portalTiles = [];
  const portals = new Map();
  const boxes = [];
  const width = rows[0].length;
  const height = rows.length;
  let player;

  rows.forEach(function (row, y) {
    Array.from(row).forEach(function (tile, x) {
      const key = y * width + x;
      if (tile === "#") walls.add(key);
      if (tile === "o" || tile === "p") goals.add(key);
      if (tile === "p") plates.add(key);
      if (tile === "d") gates.add(key);
      if (BELT_DIRECTIONS[tile]) belts.set(key, BELT_DIRECTIONS[tile]);
      if (tile === "a") portalTiles.push({ x: x, y: y });
      if (tile === "@") player = { x: x, y: y };
      if (BOX_TYPES[tile]) boxes.push({ x: x, y: y, type: BOX_TYPES[tile] });
    });
  });

  if (portalTiles.length === 2) {
    const entrance = portalTiles[0];
    const exit = portalTiles[1];
    portals.set(entrance.y * width + entrance.x, exit);
    portals.set(exit.y * width + exit.x, entrance);
  }
  return { width: width, height: height, walls: walls, goals: goals, plates: plates, gates: gates,
    belts: belts, portals: portals, layout: rows.join("\n"),
    initial: { player: player, boxes: boxes, steps: 0, discovered: false } };
}

function offset(point, direction) {
  return Object.assign({}, point, { x: point.x + direction[0], y: point.y + direction[1] });
}

function cellKey(map, point) {
  return point.y * map.width + point.x;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function pressureState(map, state) {
  const playerKey = cellKey(map, state.player);
  const playerOnPlate = map.plates.has(playerKey);
  const boxOnPlate = state.boxes.some(function (box) { return map.plates.has(cellKey(map, box)); });
  // An open gate stays clear until anything standing in its doorway moves out.
  const gateOpen = playerOnPlate || boxOnPlate || map.gates.has(playerKey) ||
    state.boxes.some(function (box) { return map.gates.has(cellKey(map, box)); });
  return { playerOnPlate: playerOnPlate, boxOnPlate: boxOnPlate, gateOpen: gateOpen };
}

function blockedCell(map, point, gateOpen) {
  return point.x < 0 || point.x >= map.width || point.y < 0 || point.y >= map.height ||
    map.walls.has(cellKey(map, point)) || (!gateOpen && map.gates.has(cellKey(map, point)));
}

function terrainTravel(map, point, gateOpen, occupied) {
  const key = cellKey(map, point);
  const belt = map.belts.get(key);
  const portal = map.portals.get(key);
  if (!belt && !portal) return null;
  const target = portal ? Object.assign({}, point, portal) : offset(point, DIRECTIONS[belt]);
  if (blockedCell(map, target, gateOpen) || occupied(target)) return null;
  return { via: point, target: target, motion: portal ? "warp" : "ride" };
}

function step(map, state, direction) {
  let player = offset(state.player, direction);
  const gateOpen = map.gates.size === 0 || pressureState(map, state).gateOpen;
  if (blockedCell(map, player, gateOpen)) return null;

  const firstBox = state.boxes.findIndex(function (box) { return sameCell(player, box); });
  const boxes = state.boxes.slice();
  let moved = [];
  let effect = "";
  if (firstBox !== -1) {
    const type = boxes[firstBox].type;
    moved = [firstBox];
    if (type === "twin") {
      moved = boxes.map(function (box, index) { return box.type === "twin" ? index : -1; })
        .filter(function (index) { return index !== -1; });
    }

    const destinations = moved.map(function (index) { return offset(boxes[index], direction); });
    const blocked = destinations.some(function (point) {
      // Linked boxes move together. A box may occupy a tile a linked box just left.
      return blockedCell(map, point, gateOpen) || sameCell(point, player) || boxes.some(function (box, index) {
        return moved.indexOf(index) === -1 && sameCell(box, point);
      });
    });
    if (blocked) return { moved: moved, blocked: true };

    if (type === "spring") {
      const extra = offset(destinations[0], direction);
      if (!blockedCell(map, extra, gateOpen) && !boxes.some(function (box) { return sameCell(box, extra); })) {
        destinations[0] = extra;
        effect = "hop";
      }
    }
    if (type === "twin") effect = "shuffle";
    moved.forEach(function (index, order) { boxes[index] = destinations[order]; });
  }

  const boxTravels = [];
  let playerTravel = null;
  if (map.belts.size || map.portals.size) {
    const gateAfterPush = map.gates.size === 0 || pressureState(map, { player: player, boxes: boxes }).gateOpen;
    const hasBox = function (point) { return boxes.some(function (box) { return sameCell(box, point); }); };
    // Resolve boxes before the player and trigger terrain at most once per piece per turn.
    moved.forEach(function (index) {
      const travel = terrainTravel(map, boxes[index], gateAfterPush, function (point) {
        return sameCell(player, point) || hasBox(point);
      });
      if (!travel) return;
      boxes[index] = travel.target;
      boxTravels.push({ index: index, travel: travel });
    });
    playerTravel = terrainTravel(map, player, gateAfterPush, hasBox);
    if (playerTravel) player = playerTravel.target;
  }

  return {
    state: { player: player, boxes: boxes, steps: state.steps + 1,
      discovered: state.discovered || firstBox !== -1 || Boolean(playerTravel) },
    moved: moved,
    effect: effect,
    boxTravels: boxTravels,
    playerTravel: playerTravel
  };
}

function deliveredCount(map, state) {
  return state.boxes.filter(function (box) { return map.goals.has(cellKey(map, box)); }).length;
}

function replayBoard(save) {
  if (!save || !Number.isInteger(save.level) || typeof save.layout !== "string" || !Array.isArray(save.moves)) return null;
  const level = LEVELS[save.level];
  if (!level) return null;
  const rows = [level.map].concat(level.previousMaps || []).find(function (layout) {
    return layout.join("\n") === save.layout;
  });
  if (!rows) return null;
  const map = readMap(rows);
  let state = map.initial;
  let facingLeft = false;
  const history = [];
  for (const name of save.moves) {
    if (typeof name !== "string" || !Object.prototype.hasOwnProperty.call(DIRECTIONS, name)) return null;
    if (deliveredCount(map, state) === state.boxes.length) return null;
    const turn = step(map, state, DIRECTIONS[name]);
    if (!turn || turn.blocked) return null;
    history.push({ state: state, direction: name, facingLeft: facingLeft });
    state = turn.state;
    if (name === "left" || name === "right") facingLeft = name === "left";
  }
  return { map: map, state: state, history: history, facingLeft: facingLeft };
}

function translatedBoard(save) {
  if (!save || !Number.isInteger(save.level)) return null;
  const level = PREVIOUS_LEVELS[save.level];
  return Number.isInteger(level) ? Object.assign({}, save, { level: level }) : null;
}

function resumePreviousBoard(save) {
  if (!save) return null;
  const level = LEVELS[save.level];
  // Previous belt boards can prove a clear, but resume with the new spring layout.
  return level.accent === "belt" && save.layout !== level.map.join("\n") ? null : save;
}

function legacyProfile(oldSave) {
  if (oldSave && PREVIOUS_LEVELS[oldSave.level] === null && Array.isArray(oldSave.moves)) {
    return { completed: [], resume: null };
  }
  const save = translatedBoard(oldSave);
  const board = replayBoard(save);
  if (!board) return null;
  return {
    completed: deliveredCount(board.map, board.state) === board.state.boxes.length ? [save.level] : [],
    resume: resumePreviousBoard(save)
  };
}

function emptyProgress() {
  return { active: null, slots: Array(SAVE_SLOT_COUNT).fill(null) };
}

function migrateProgress(saved, progress) {
  if (!saved) return;
  const oldSlots = Array.isArray(saved.slots) ? saved.slots.slice(0, SAVE_SLOT_COUNT) : [];
  oldSlots.forEach(function (save, index) { progress.slots[index] = legacyProfile(save); });
  const current = legacyProfile(saved.current);
  if (current) {
    const currentSignature = JSON.stringify([saved.current.layout, saved.current.moves]);
    const same = oldSlots.findIndex(function (save) {
      return save && JSON.stringify([save.layout, save.moves]) === currentSignature;
    });
    if (same !== -1 && progress.slots[same]) {
      progress.active = same;
    } else {
      const empty = progress.slots.indexOf(null);
      if (empty !== -1) {
        progress.slots[empty] = current;
        progress.active = empty;
      }
    }
  }
  if (progress.active === null) {
    const first = progress.slots.findIndex(Boolean);
    if (first !== -1) progress.active = first;
  }
}

function loadProgress() {
  const progress = emptyProgress();
  try {
    const current = JSON.parse(localStorage.getItem(SAVE_KEY));
    const saved = current || JSON.parse(localStorage.getItem(PREVIOUS_SAVE_KEY));
    if (!saved) {
      migrateProgress(JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY)), progress);
      return progress;
    }
    if (!Array.isArray(saved.slots)) return progress;
    saved.slots.slice(0, SAVE_SLOT_COUNT).forEach(function (slot, index) {
      if (!slot || !Array.isArray(slot.completed)) return;
      const levels = current ? slot.completed : slot.completed.map(function (level) {
        return Number.isInteger(level) ? PREVIOUS_LEVELS[level] : null;
      });
      const completed = levels.filter(function (level) {
        return Number.isInteger(level) && level >= 0 && level < LEVELS.length;
      });
      const resume = current ? slot.resume || null : resumePreviousBoard(translatedBoard(slot.resume));
      progress.slots[index] = { completed: Array.from(new Set(completed)), resume: resume };
    });
    const active = saved.active;
    if (Number.isInteger(active) && progress.slots[active]) progress.active = active;
  } catch (error) {
    // The H5 container may deny local storage. The game still works in this tab.
  }
  return progress;
}

function nextChallenge(profile) {
  return LEVELS.findIndex(function (level, index) { return !profile.completed.includes(index); });
}

function levelAccess(profile, index) {
  if (!profile || index < 0 || index >= LEVELS.length) return "locked";
  if (profile.completed.includes(index)) return "complete";
  return index === nextChallenge(profile) ? "ready" : "locked";
}

const board = document.getElementById("board");
const title = document.getElementById("level-title");
const message = document.getElementById("message");
const cargo = document.getElementById("cargo");
const undoButton = document.getElementById("undo");
const restartButton = document.getElementById("restart");
const nextButton = document.getElementById("next");
const receiptLayer = document.getElementById("receipt");
const receiptTitle = document.getElementById("receipt-title");
const receiptDetail = document.getElementById("receipt-detail");
const receiptBox = document.getElementById("receipt-box");
const directionButtons = {};
const startMenu = document.getElementById("start-menu");
const playScreen = document.getElementById("play-screen");
const savesScreen = document.getElementById("saves-screen");
const quitScreen = document.getElementById("quit-screen");
const saveList = document.getElementById("save-list");
const savesTitle = document.getElementById("saves-title");
const slotsBackButton = document.getElementById("back-from-saves");
const overwritePanel = document.getElementById("overwrite");
const overwriteMessage = document.getElementById("overwrite-message");
const cancelOverwriteButton = document.getElementById("cancel-overwrite");
const menuFeedback = document.getElementById("menu-feedback");
const savesFeedback = document.getElementById("saves-feedback");
const quitFeedback = document.getElementById("quit-feedback");
const startButton = document.getElementById("start");
const continueButton = document.getElementById("continue");
const savesButton = document.getElementById("open-saves");
const quitButton = document.getElementById("quit");
const menuButton = document.getElementById("open-menu");
const selectScreen = document.getElementById("select-screen");
const selectTitle = document.getElementById("select-title");
const selectProgress = document.getElementById("select-progress");
const selectHint = document.getElementById("select-hint");
const storageWarning = document.getElementById("storage-warning");
const levelRail = document.getElementById("level-rail");
const previousCard = document.getElementById("prev-card");
const nextCard = document.getElementById("next-card");
const cardPosition = document.getElementById("card-position");
const playingProfile = document.getElementById("playing-profile");
const screens = [startMenu, playScreen, savesScreen, quitScreen, selectScreen];
const progress = loadProgress();

let levelIndex;
let map;
let state;
let history;
let playerPiece;
let boxPieces;
let facingLeft;
let menuActionPending = false;
let slotMode;
let slotMenuButton;
let pendingSlot;
let storageAvailable = true;
let centeredLevel = 0;
let mouseDrag = null;

function persistProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
  }
  return storageAvailable;
}

function activeProfile() {
  return progress.slots[progress.active] || null;
}

function completeLevel(index) {
  const slot = activeProfile();
  if (!slot || slot.completed.includes(index)) return;
  slot.completed.push(index);
}

function saveBoard(showStatus) {
  const slot = activeProfile();
  if (!slot) return;
  slot.resume = {
    level: levelIndex,
    layout: map.layout,
    moves: history.map(function (turn) { return turn.direction; })
  };
  const saved = persistProgress();
  const status = !saved ? " · 仅本页保存" : showStatus ? " · 已保存" : "";
  updateText(playingProfile, "存档 " + (progress.active + 1) + status);
}

function place(element, point) {
  element.style.left = (100 * point.x / map.width) + "%";
  element.style.top = (100 * point.y / map.height) + "%";
}

function cell(className, point, container) {
  const element = document.createElement("div");
  element.className = className;
  element.style.width = (100 / map.width) + "%";
  element.style.height = (100 / map.height) + "%";
  place(element, point);
  container.appendChild(element);
  return element;
}

function piece(className, point, container) {
  const element = cell("piece " + className, point, container);
  const sprite = document.createElement("div");
  const pixels = document.createElement("canvas");
  sprite.className = "sprite";
  pixels.className = "pixel-art";
  pixels.setAttribute("aria-hidden", "true");
  drawPixelSprite(pixels, point.type || "worker");
  sprite.appendChild(pixels);
  element.appendChild(sprite);
  return element;
}

function loadLevel(index, resume) {
  const level = LEVELS[index];
  levelIndex = index;
  map = resume ? resume.map : readMap(level.map);
  state = resume ? resume.state : map.initial;
  history = resume ? resume.history : [];
  facingLeft = resume ? resume.facingLeft : false;
  title.textContent = level.title;
  if (level.titleArt) {
    const titleArt = document.createElement("img");
    titleArt.className = "pixel-art";
    titleArt.src = level.titleArt;
    titleArt.alt = level.title;
    title.textContent = "";
    title.appendChild(titleArt);
  }
  const firstType = state.boxes[0].type;
  const mixed = state.boxes.some(function (box) { return box.type !== firstType; });
  const featured = level.featuredBox || (mixed ? "mixed" : firstType);
  playScreen.setAttribute("data-crate", level.accent || featured);
  drawPixelSprite(receiptBox, featured === "mixed" ? "plain" : featured);

  board.textContent = "";
  board.style.setProperty("--board-ratio", (100 * map.height / map.width) + "%");
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const point = { x: x, y: y };
      const key = cellKey(map, point);
      let type = (x + y) % 2 === 0 ? "tile" : "tile alt";
      if (map.walls.has(key)) type += " wall";
      if (map.goals.has(key)) type += " goal";
      if (map.plates.has(key)) type += " plate";
      if (map.gates.has(key)) type += " gate";
      if (map.belts.has(key)) type += " belt belt-" + map.belts.get(key);
      if (map.portals.has(key)) type += " portal";
      cell(type, point, fragment).setAttribute("aria-hidden", "true");
    }
  }
  boxPieces = state.boxes.map(function (box) {
    return piece("box " + box.type, box, fragment);
  });
  playerPiece = piece(facingLeft ? "player facing-left" : "player facing-right", state.player, fragment);
  board.appendChild(fragment);
  render();
}

function updateText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function facePlayer(left) {
  facingLeft = left;
  playerPiece.classList.toggle("facing-left", left);
  playerPiece.classList.toggle("facing-right", !left);
}

function render() {
  place(playerPiece, state.player);
  state.boxes.forEach(function (box, index) {
    place(boxPieces[index], box);
    boxPieces[index].classList.toggle("arrived", map.goals.has(cellKey(map, box)));
  });

  const level = LEVELS[levelIndex];
  const delivered = deliveredCount(map, state);
  const solved = delivered === state.boxes.length;
  const justSolved = solved && receiptLayer.hidden;
  const pressure = map.plates.size ? pressureState(map, state) : null;
  let hint = (state.discovered && level.reveal) || level.hint;
  if (pressure && state.steps > 0) {
    if (pressure.boxOnPlate) hint = level.heldHint || hint;
    else if (pressure.playerOnPlate) hint = level.pressedHint || hint;
    else hint = level.releasedHint || hint;
  }
  board.classList.toggle("solved", solved);
  board.classList.toggle("gate-open", Boolean(pressure && pressure.gateOpen));
  board.classList.toggle("plate-pressed", Boolean(pressure && (pressure.playerOnPlate || pressure.boxOnPlate)));
  updateText(cargo, "已送达 " + delivered + "/" + state.boxes.length);
  updateText(message, solved ? "" : hint);
  undoButton.disabled = history.length === 0;
  Object.keys(directionButtons).forEach(function (name) {
    directionButtons[name].classList.toggle("demo-move", state.steps === 0 && name === level.firstMove);
  });
  receiptLayer.hidden = !solved;
  if (solved) {
    if (justSolved) completeLevel(levelIndex);
    updateText(receiptTitle, level.success);
    updateText(receiptDetail, state.steps + " 步 · 送达 " + delivered + " 箱");
    updateText(nextButton, levelAccess(activeProfile(), levelIndex + 1) === "locked" ? "返回选关" : "下一单");
    if (justSolved) nextButton.focus({ preventScroll: true });
  }
}

function animatePieces(elements, effect) {
  if (elements.length === 0) return;
  elements.forEach(function (element) { element.removeAttribute("data-motion"); });
  // Commit the reset so quick consecutive moves can replay the same animation.
  void board.offsetWidth;
  elements.forEach(function (element) { element.setAttribute("data-motion", effect); });
}

function animateTravel(element, from, travel, effect) {
  [["from", from], ["via", travel.via], ["to", travel.target]].forEach(function (stage) {
    element.style.setProperty("--travel-" + stage[0] + "-x", (100 * stage[1].x / map.width) + "%");
    element.style.setProperty("--travel-" + stage[0] + "-y", (100 * stage[1].y / map.height) + "%");
  });
  animatePieces([element], travel.motion === "ride" && effect === "hop" ? "ride-hop" : travel.motion);
}

board.addEventListener("animationend", function (event) {
  if (!event.target.classList.contains("sprite") || event.pseudoElement) return;
  const piece = event.target.parentElement;
  if (piece.getAttribute("data-motion") === event.animationName) piece.removeAttribute("data-motion");
});

function move(name) {
  if (deliveredCount(map, state) === state.boxes.length) return;
  const result = step(map, state, DIRECTIONS[name]);
  if (!result) {
    animatePieces([playerPiece], "bump");
    return;
  }

  const affected = result.moved.map(function (index) { return boxPieces[index]; });
  if (result.blocked) {
    animatePieces([playerPiece].concat(affected), "bump");
    return;
  }

  const previous = state;
  history.push({ state: previous, direction: name, facingLeft: facingLeft });
  state = result.state;
  if (result.playerTravel) animateTravel(playerPiece, previous.player, result.playerTravel);
  else animatePieces([playerPiece], "walk");
  const travelIndices = result.boxTravels.map(function (item) { return item.index; });
  const pushed = result.moved.filter(function (index) { return !travelIndices.includes(index); });
  animatePieces(pushed.map(function (index) { return boxPieces[index]; }), result.effect || "nudge");
  result.boxTravels.forEach(function (item) {
    animateTravel(boxPieces[item.index], previous.boxes[item.index], item.travel, result.effect);
  });
  if (name === "left" || name === "right") facePlayer(name === "left");
  render();
  saveBoard();
}

function animateButton(button) {
  button.classList.remove("button-tap");
  void button.offsetWidth;
  button.classList.add("button-tap");
}

document.addEventListener("click", function (event) {
  const button = event.target.closest("button");
  if (button && !button.disabled) animateButton(button);
}, true);

Array.from(document.querySelectorAll("[data-direction]")).forEach(function (button) {
  const direction = button.getAttribute("data-direction");
  directionButtons[direction] = button;
  button.addEventListener("click", function () { move(direction); });
});
document.addEventListener("keydown", function (event) {
  const direction = KEY_DIRECTIONS[event.key];
  if (playScreen.hidden || !direction || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  animateButton(directionButtons[direction]);
  move(direction);
});
undoButton.addEventListener("click", function () {
  if (history.length === 0) return;
  const turn = history.pop();
  const previous = turn.state;
  const moved = boxPieces.filter(function (piece, index) {
    return !sameCell(state.boxes[index], previous.boxes[index]);
  });
  state = previous;
  facePlayer(turn.facingLeft);
  animatePieces([playerPiece], "walk");
  animatePieces(moved, "nudge");
  render();
  saveBoard();
});
restartButton.addEventListener("click", function () {
  loadLevel(levelIndex);
  saveBoard();
});
nextButton.addEventListener("click", function () {
  if (!playLevel(levelIndex + 1)) showLevelSelect();
});

function showScreen(screen, focusTarget) {
  screens.forEach(function (item) { item.hidden = item !== screen; });
  if (screen === startMenu) menuFeedback.hidden = true;
  startMenu.parentElement.classList.toggle("showing-menu", screen !== playScreen);
  startMenu.parentElement.classList.toggle("showing-home", screen === startMenu);
  startMenu.parentElement.classList.toggle("reading-saves", screen === savesScreen && slotMode === "load");
  startMenu.parentElement.classList.toggle("playing", screen === playScreen);
  startMenu.parentElement.classList.toggle("selecting", screen === selectScreen);
  focusTarget.focus({ preventScroll: true });
}

function playLevel(index, resume) {
  if (levelAccess(activeProfile(), index) === "locked") return false;
  loadLevel(index, resume);
  showScreen(playScreen, title);
  saveBoard();
  return true;
}

function continueGame() {
  const slot = activeProfile();
  if (!slot) {
    menuFeedback.hidden = false;
    return;
  }
  const save = slot.resume;
  if (save && levelAccess(slot, save.level) !== "locked") {
    const resume = replayBoard(save);
    if (resume && deliveredCount(resume.map, resume.state) < resume.state.boxes.length) {
      playLevel(save.level, resume);
      return;
    }
  }
  const index = nextChallenge(slot);
  playLevel(index === -1 ? LEVELS.length - 1 : index);
}

function onMenuAction(button, action) {
  button.addEventListener("click", function () {
    if (menuActionPending) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    // Let the press finish before hiding the button with its screen.
    menuActionPending = true;
    window.setTimeout(function () {
      menuActionPending = false;
      action();
    }, 160);
  });
}

const levelCards = LEVELS.map(function (level, index) {
  const card = document.createElement("button");
  const illustration = document.createElement("span");
  const caption = document.createElement("span");
  const status = document.createElement("span");
  card.type = "button";
  card.className = "level-card";
  illustration.className = "card-illustration";
  illustration.setAttribute("aria-hidden", "true");
  if (level.accent === "belt") illustration.classList.add("card-belt");
  if (level.accent === "portal") illustration.classList.add("card-portal");
  caption.className = "card-name";
  caption.textContent = level.title;
  status.className = "card-status";
  const types = new Set(readMap(level.map).initial.boxes.map(function (box) { return box.type; }));
  types.forEach(function (type) {
    const sprite = document.createElement("canvas");
    sprite.className = "pixel-art";
    drawPixelSprite(sprite, type);
    illustration.appendChild(sprite);
  });
  card.appendChild(illustration);
  card.appendChild(caption);
  card.appendChild(status);
  levelRail.appendChild(card);
  onMenuAction(card, function () {
    if (playLevel(index)) return;
    const challenge = nextChallenge(activeProfile());
    selectHint.textContent = "先通关第 " + (challenge + 1) + " 关，才能继续解锁。";
  });
  return { button: card, status: status };
});

function updateCardPosition(index) {
  centeredLevel = index;
  previousCard.disabled = index === 0;
  nextCard.disabled = index === LEVELS.length - 1;
  updateText(cardPosition, (index + 1) + " / " + LEVELS.length);
}

function focusCard(index, animate) {
  const bounded = Math.min(Math.max(index, 0), LEVELS.length - 1);
  const card = levelCards[bounded].button;
  const left = card.offsetLeft + (card.offsetWidth - levelRail.clientWidth) / 2;
  const smooth = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  levelRail.scrollTo({ left: left, behavior: smooth ? "smooth" : "auto" });
  updateCardPosition(bounded);
  return bounded;
}

function nearestCard() {
  const center = levelRail.scrollLeft + levelRail.clientWidth / 2;
  let nearest = 0;
  let distance = Infinity;
  levelCards.forEach(function (card, index) {
    const button = card.button;
    const gap = Math.abs(center - button.offsetLeft - button.offsetWidth / 2);
    if (gap < distance) {
      distance = gap;
      nearest = index;
    }
  });
  return nearest;
}

levelRail.addEventListener("scroll", function () {
  if (levelRail.clientWidth) updateCardPosition(nearestCard());
});

previousCard.addEventListener("click", function () { focusCard(centeredLevel - 1, true); });
nextCard.addEventListener("click", function () { focusCard(centeredLevel + 1, true); });
levelRail.addEventListener("keydown", function (event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const index = focusCard(centeredLevel + (event.key === "ArrowLeft" ? -1 : 1), true);
  levelCards[index].button.focus({ preventScroll: true });
});

levelRail.addEventListener("pointerdown", function (event) {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  mouseDrag = { start: event.clientX, scroll: levelRail.scrollLeft, moved: false };
});
window.addEventListener("pointermove", function (event) {
  if (!mouseDrag || event.pointerType !== "mouse") return;
  if (!(event.buttons & 1)) {
    endMouseDrag();
    return;
  }
  const delta = event.clientX - mouseDrag.start;
  if (!mouseDrag.moved && Math.abs(delta) < 6) return;
  if (!mouseDrag.moved) {
    mouseDrag.moved = true;
    levelRail.classList.add("dragging");
  }
  event.preventDefault();
  levelRail.scrollLeft = mouseDrag.scroll - delta;
});
function endMouseDrag() {
  if (!mouseDrag) return;
  const moved = mouseDrag.moved;
  mouseDrag = null;
  if (!moved) return;
  const index = nearestCard();
  levelRail.classList.remove("dragging");
  focusCard(index, true);
}
window.addEventListener("pointerup", endMouseDrag);
window.addEventListener("pointercancel", endMouseDrag);
window.addEventListener("blur", endMouseDrag);

function showLevelSelect() {
  const profile = activeProfile();
  if (!profile) return;
  const challenge = nextChallenge(profile);
  selectProgress.textContent = "存档 " + (progress.active + 1) + " · " + profile.completed.length + "/" + LEVELS.length;
  selectHint.textContent = "左右拖动货单，点击可挑战或已通关的关卡。";
  storageWarning.hidden = storageAvailable;
  levelCards.forEach(function (card, cardIndex) {
    const access = levelAccess(profile, cardIndex);
    card.button.setAttribute("data-access", access);
    card.button.setAttribute("aria-disabled", access === "locked" ? "true" : "false");
    card.status.textContent = access === "locked" ? "已上锁" : access === "complete" ? "已通关" : "可挑战";
  });
  showScreen(selectScreen, selectTitle);
  focusCard(challenge === -1 ? LEVELS.length - 1 : challenge, false);
}

function showSlotList(feedback) {
  pendingSlot = null;
  overwritePanel.hidden = true;
  saveList.hidden = false;
  savesFeedback.hidden = false;
  savesFeedback.textContent = feedback;
  saveList.textContent = "";
  progress.slots.forEach(function (save, index) {
    const button = document.createElement("button");
    const label = document.createElement("span");
    const detail = document.createElement("span");
    button.type = "button";
    button.className = "secondary-button";
    button.disabled = slotMode === "load" && !save;
    label.className = "slot-label";
    const name = "存档 " + (index + 1);
    if (slotMode === "load") {
      const art = document.createElement("img");
      art.className = "pixel-art slot-art";
      art.src = "./save-slot-" + (index + 1) + ".png";
      art.alt = name;
      label.appendChild(art);
    } else {
      label.textContent = name;
    }
    if (slotMode === "load" && index === progress.active) {
      const marker = document.createElement("small");
      marker.className = "slot-current";
      marker.textContent = "上次游玩";
      label.appendChild(marker);
      button.setAttribute("aria-current", "true");
    }
    detail.className = "slot-detail";
    detail.textContent = save ? "已通关 " + save.completed.length + "/" + LEVELS.length : "空存档";
    if (save) {
      const next = nextChallenge(save);
      const note = document.createElement("small");
      note.textContent = next === -1 ? "全部通关" : "第 " + (next + 1) + " 关可挑战";
      detail.appendChild(note);
    }
    button.appendChild(label);
    button.appendChild(detail);
    saveList.appendChild(button);
    onMenuAction(button, function () {
      if (slotMode === "load") {
        selectSlot(index, false);
      } else if (save) {
        pendingSlot = index;
        overwriteMessage.textContent = "在存档 " + (index + 1) + " 开新游戏？这份通关进度会被清空。";
        saveList.hidden = true;
        savesFeedback.hidden = true;
        overwritePanel.hidden = false;
        cancelOverwriteButton.focus({ preventScroll: true });
      } else {
        selectSlot(index, true);
      }
    });
  });
}

function selectSlot(index, fresh) {
  if (fresh) progress.slots[index] = { completed: [] };
  if (!progress.slots[index]) return;
  progress.active = index;
  persistProgress();
  showLevelSelect();
}

function showSlots(mode, menuButton) {
  slotMode = mode;
  slotMenuButton = menuButton;
  const creating = mode === "new";
  const feedback = progress.slots.some(Boolean) ? "请选择一个存档，再进入选关。" : "还没有存档，请返回主菜单开始新游戏。";
  showSlotList(creating ? "选择一个存档位。通关进度会自动保存。" : feedback);
  showScreen(savesScreen, savesTitle);
}

onMenuAction(startButton, function () { showSlots("new", startButton); });
onMenuAction(continueButton, continueGame);
onMenuAction(savesButton, function () { showSlots("load", savesButton); });
onMenuAction(cancelOverwriteButton, function () {
  const index = pendingSlot;
  showSlotList("选择一个存档位。通关进度会自动保存。");
  saveList.children[index].focus({ preventScroll: true });
});
onMenuAction(document.getElementById("confirm-overwrite"), function () {
  if (pendingSlot !== null) selectSlot(pendingSlot, true);
});
onMenuAction(quitButton, function () {
  quitFeedback.textContent = activeProfile()
    ? (persistProgress() ? "进度已保存在此浏览器。" : "进度仅保留在当前页面。")
    : "下次见。";
  showScreen(quitScreen, document.getElementById("quit-title"));
});
onMenuAction(slotsBackButton, function () {
  showScreen(startMenu, slotMenuButton);
});
onMenuAction(document.getElementById("back-from-quit"), function () { showScreen(startMenu, quitButton); });
onMenuAction(document.getElementById("back-from-select"), function () { showSlots("load", savesButton); });
document.getElementById("save-game").addEventListener("click", function () { saveBoard(true); });
menuButton.addEventListener("click", function () { showScreen(startMenu, continueButton); });

drawPixelSprite(document.getElementById("stamp"), "plain");
loadLevel(0);
