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
  const hasScout = function (point) {
    return (state.scout && sameCell(state.scout, point)) || state.otherScouts?.some(scout => sameCell(scout, point));
  };
  if (blockedCell(map, player, gateOpen) || hasScout(player)) return null;

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
      return blockedCell(map, point, gateOpen) || hasScout(point) || sameCell(point, player) || boxes.some(function (box, index) {
        return moved.indexOf(index) === -1 && sameCell(box, point);
      });
    });
    if (blocked) return { moved: moved, blocked: true };

    if (type === "spring") {
      const extra = offset(destinations[0], direction);
      if (!blockedCell(map, extra, gateOpen) && !hasScout(extra) &&
          !boxes.some(function (box) { return sameCell(box, extra); })) {
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
        return sameCell(player, point) || hasScout(point) || hasBox(point);
      });
      if (!travel) return;
      boxes[index] = travel.target;
      boxTravels.push({ index: index, travel: travel });
    });
    playerTravel = terrainTravel(map, player, gateAfterPush, function (point) {
      return hasScout(point) || hasBox(point);
    });
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
const quitScreen = document.getElementById("quit-screen");
const characterScreen = document.getElementById("characters-screen");
const characterTitle = document.getElementById("characters-title");
const characterFeedback = document.getElementById("characters-feedback");
const characterList = document.getElementById("character-list");
const characterForm = document.getElementById("character-form");
const characterName = document.getElementById("character-name");
const newCharacterButton = document.getElementById("new-character");
const characterRestart = document.getElementById("character-restart");
const menuFeedback = document.getElementById("menu-feedback");
const quitFeedback = document.getElementById("quit-feedback");
const startButton = document.getElementById("start");
const continueButton = document.getElementById("continue");
const quitButton = document.getElementById("quit");
const menuButton = document.getElementById("open-menu");
const playingProfile = document.getElementById("playing-profile");
const screens = [startMenu, playScreen, characterScreen, quitScreen];
const nightPlayers = readNightPlayers();
const legacyNight = nightPlayers.roster.length ? null : readNightRun();
const legacyBest = nightPlayers.roster.length ? 0 : readNightBest();
const nightButton = document.getElementById("open-night");
const nightSteps = document.getElementById("night-steps");
const nightStepCount = nightSteps.querySelector("strong");
const nightHealth = document.getElementById("night-health");
const healthLabel = nightHealth.querySelector(".night-health-label");
const hearts = [...nightHealth.querySelector(".night-hearts").children];
const nightTools = document.getElementById("night-tools");
const scoutStatus = document.getElementById("scout-status");
const nightMachine = document.getElementById("night-machine");
const nightReels = document.getElementById("night-reels");
const reelWindows = Array.from(nightReels.children);
const spinButton = document.getElementById("night-spin");
const spinLabel = spinButton.querySelector(".night-spin-label");
const nightRulesButton = document.getElementById("open-night-rules");
const nightRulesDialog = document.getElementById("night-rules");
const nightRulesContent = nightRulesDialog.querySelector(".night-rules-content");
const nightRulesViewport = playScreen.closest("[data-game-viewport]");
const nightChest = document.getElementById("night-chest");
const chestOptions = [...nightChest.querySelectorAll("[data-chest-item]")];
const cheeseButton = document.getElementById("night-cheese");
const bellButton = document.getElementById("night-bell");
const recoverButton = document.getElementById("night-recover");
const rewindBadge = document.getElementById("night-rewinds");
const restartLabel = document.getElementById("night-restart-label");
const restartDialog = document.getElementById("night-restart");
const nightBestLabel = document.getElementById("night-best");
const nightCoinCount = document.querySelector("#night-coins strong");
const shopDialog = document.getElementById("night-shop");
const shopCoinCount = shopDialog.querySelector(".night-shop-coin-count");
const shopBalanceText = shopDialog.querySelector(".night-shop-balance-text");
const shopButtons = [...shopDialog.querySelectorAll("[data-shop-item]")];

let levelIndex;
let currentLevel;
let map;
let state;
let history;
let playerPiece;
let boxPieces;
let facingLeft;
let menuActionPending = false;
let nightPlayer = null;
let pendingCharacter = null;
let nightRun = null;
let nightBest = 0;
let nightSession = null;
let nightGenerationPending = false;
let scoutPieces;
let intentMarkers;
let baitMarker;
let reelMotion = null;

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

function loadLevel(index) {
  nightSession = null;
  levelIndex = index;
  loadBoard(LEVELS[index]);
}

function loadBoard(level, resume) {
  stopNightReels();
  currentLevel = level;
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
  const initialBoxes = nightSession ? map.initial.boxes : state.boxes;
  const firstType = initialBoxes[0].type;
  const mixed = initialBoxes.some(function (box) { return box.type !== firstType; });
  const featured = level.featuredBox || (mixed ? "mixed" : firstType);
  playScreen.setAttribute("data-crate", level.accent || featured);
  drawPixelSprite(receiptBox, featured === "mixed" ? "plain" : featured);

  board.textContent = "";
  board.style.setProperty("--board-ratio", (100 * map.height / map.width) + "%");
  board.parentElement.style.setProperty("--night-map-ratio", String(map.width / map.height));
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
  boxPieces = initialBoxes.map(function (box) {
    return piece("box " + box.type, box, fragment);
  });
  playerPiece = piece(facingLeft ? "player facing-left" : "player facing-right", state.player, fragment);
  if (nightSession) {
    scoutPieces = nightScouts(state).map(scout => piece("scout", { ...scout, type: "scout" }, fragment));
    intentMarkers = scoutPieces.map((_, rat) => Array.from({ length: NIGHT_SCOUT_MAX_STEPS }, () =>
      cell("scout-intent" + (rat ? " second-rat" : ""), state.scout, fragment)));
    baitMarker = cell("scout-bait", state.scout, fragment);
    [...scoutPieces, ...intentMarkers.flat(), baitMarker].forEach(element => element.setAttribute("aria-hidden", "true"));
  }
  playScreen.classList.toggle("night-shift", Boolean(nightSession));
  nightTools.hidden = !nightSession;
  nightSteps.hidden = !nightSession;
  nightBestLabel.hidden = !nightSession;
  nightHealth.hidden = !nightSession;
  nightRulesButton.hidden = !nightSession;
  restartButton.querySelector("img").hidden = Boolean(nightSession);
  restartLabel.hidden = !nightSession;
  rewindBadge.hidden = !nightSession;
  if (!nightSession) undoButton.removeAttribute("aria-label");
  receiptLayer.hidden = true;
  nightChest.hidden = true;
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
  if (nightSession) boxPieces.forEach(element => { element.hidden = true; });
  state.boxes.forEach(function (box, index) {
    const element = boxPieces[box.id ?? index];
    place(element, box);
    element.classList.toggle("arrived", map.goals.has(cellKey(map, box)));
    element.hidden = Boolean(nightSession && state.caught && sameCell(state.caught, box));
  });

  const level = currentLevel;
  const delivered = deliveredCount(map, state);
  const solved = nightSession ? nightWon(map, state) : delivered === state.boxes.length;
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
    directionButtons[name].disabled = Boolean(nightSession &&
      (solved || nightLost(state) || !state.remaining || state.chestPending || reelMotion));
  });
  if (nightSession) {
    renderNight(solved, delivered);
    return;
  }
  recoverButton.hidden = true;
  receiptLayer.classList.remove("night-failed");
  nextButton.hidden = false;
  receiptLayer.hidden = !solved;
  updateText(playingProfile, "教程 " + (levelIndex + 1) + "/" + LEVELS.length);
  playingProfile.removeAttribute("title");
  playingProfile.removeAttribute("aria-label");
  if (solved) {
    updateText(receiptTitle, level.success);
    const lastLesson = levelIndex + 1 === LEVELS.length;
    updateText(receiptDetail, lastLesson ? "你可以回主菜单开始肉鸽。"
      : state.steps + " 步 · 送达 " + delivered + " 箱");
    updateText(nextButton, lastLesson ? "完成教程" : "下一课");
    if (justSolved) nextButton.focus({ preventScroll: true });
  }
}

function renderNight(solved, delivered) {
  const { supply } = nightSession;
  const failed = nightLost(state);
  const finished = solved || failed;
  const floor = nightFloorNumber(nightRun);
  const justFinished = finished && receiptLayer.hidden;
  const spinning = reelMotion !== null;
  const openChest = !spinning && state.chestPending;
  const justOpenedChest = openChest && nightChest.hidden;
  const active = state.remaining > 0 && !finished && !openChest;
  const effect = state.roll && nightRollEffect(state.roll);
  nightScouts(state).forEach((rat, index) => {
    place(scoutPieces[index], rat);
    scoutPieces[index].classList.toggle("scout-paused", state.stopped);
  });
  if (state.bait) place(baitMarker, state.bait);
  baitMarker.hidden = !state.bait || finished;
  const trails = [state.trail, ...state.otherTrails];
  const distance = trails.reduce((sum, trail) => sum + trail.length, 0);
  const threatened = trails.some(trail => trail.some(point => scoutWillBite(state, point)));
  intentMarkers.forEach(function (markers, rat) {
    markers.forEach(function (marker, index) {
      const point = trails[rat]?.[index];
      if (point) place(marker, point);
      marker.hidden = !point || finished || spinning;
      const bite = Boolean(point && scoutWillBite(state, point));
      marker.classList.toggle("is-bite", bite);
      const prefix = intentMarkers.length > 1 ? (rat ? "B" : "A") : "";
      updateText(marker, prefix + (index + 1) + (bite ? " 咬" : ""));
    });
  });
  if (!spinning) {
    reelWindows.forEach((reel, index) => showNightFace(reel, state.roll?.[index]));
    nightReels.setAttribute("aria-label", state.roll
      ? "转轮结果：" + state.roll.map(id => NIGHT_FACES[id].name).join("、")
      : "三个转轮等待摇动");
  }
  nightReels.setAttribute("aria-busy", String(spinning));
  const noRewindPrize = state.rules >= 7 && effect?.matching === "rewind";
  nightReels.dataset.match = !spinning && effect?.matching && !noRewindPrize
    ? ["broken", "scout"].includes(effect.matching) ? "penalty" : "reward"
    : "";
  nightMachine.dataset.phase = spinning ? "rolling" : active ? "active" : "ready";
  updateText(spinLabel, spinning ? "转动中" : active ? "结束回合" : "摇转轮");
  spinButton.disabled = Boolean(finished || spinning || openChest || (active && !canEndNightTurn(map, state)));
  const warning = state.stopped ? "鼠已停机" : threatened ? "鼠盯上兔子 · 离开红框"
    : distance ? "巡箱鼠将走 " + distance + " 格" : "鼠暂无路线";
  const ready = state.bitten ? "被咬了！失去 1 点生命" : state.stolen ? "本回合被偷 " + state.stolen + " 箱"
    : state.coinGain ? "本回合 +" + state.coinGain + " 金币" : state.roll ? "" : "先摇三列，凑齐三个触发倍率";
  const match = noRewindPrize ? "三连返工券库存不变 · "
    : effect?.matching ? "三连" + NIGHT_FACES[effect.matching].name + " · " : "";
  const advice = openChest ? "三连宝箱 · 自选道具" : active ? match + warning : ready;
  const notice = finished ? "" : spinning ? "转轮滚动中…" : advice;
  updateText(scoutStatus, notice);
  scoutStatus.hidden = !notice;
  updateText(nightStepCount, String(spinning ? "—" : finished ? 0 : state.remaining));
  nightSteps.classList.toggle("has-steps", state.remaining > 0 && !finished && !spinning);
  updateText(healthLabel, "生命 " + state.health + "/" + NIGHT_MAX_HEALTH);
  hearts.forEach((heart, index) => heart.classList.toggle("empty", index >= state.health));
  updateText(playingProfile, "第" + floor + "层");
  playingProfile.title = nightPlayer.name;
  playingProfile.setAttribute("aria-label", nightPlayer.name + "，第" + floor + "层");
  updateText(nightBestLabel, "最高" + nightBest + "层");
  updateText(nightCoinCount, String(state.coins));
  updateText(cheeseButton.firstElementChild, NIGHT_ITEMS.cheese.name + " ×" + supply.cheese);
  updateText(bellButton.firstElementChild, NIGHT_ITEMS.bell.name + " ×" + supply.bell);
  updateText(rewindBadge, "×" + supply.rewind);
  undoButton.setAttribute("aria-label", "撤回，剩余 " + supply.rewind + " 张返工券");
  undoButton.disabled = solved || spinning || openChest || !supply.rewind || !history.length;
  cheeseButton.disabled = !active || spinning || !supply.cheese || !nightFloor(map, state.player) ||
    Boolean(state.bait && sameCell(state.bait, state.player));
  bellButton.disabled = !active || spinning || !supply.bell || !distance;
  receiptLayer.classList.toggle("night-failed", failed);
  receiptLayer.hidden = !finished;
  nightChest.hidden = !openChest;
  if (justOpenedChest && !playScreen.hidden && !nightRulesDialog.open && !restartDialog.open) {
    chestOptions[0].focus({ preventScroll: true });
  }
  nextButton.hidden = false;
  recoverButton.hidden = !failed || undoButton.disabled;
  if (!finished) return;

  updateText(receiptTitle, failed ? nightFailureText() : "第" + floor + "层签收！");
  updateText(receiptDetail, failed ? (recoverButton.hidden ? "本轮夜班结束。" : "用一张返工券，撤回上一步。")
    : state.steps + " 步 · " + state.turns + " 回合 · 送达 " + delivered + " 箱");
  updateText(nextButton, failed ? "查看结算" : floor % 5 === 0 ? "进入商店" : "去下一层");
  if (justFinished && !playScreen.hidden) {
    if (failed) showNightSummary("failure");
    else focusNightReceipt();
  }
}

function focusNightReceipt() {
  const button = recoverButton.hidden ? nextButton : recoverButton;
  button.focus({ preventScroll: true });
}

function playNight(newRun) {
  const run = newRun || !nightRun ? newNightRun() : nightRun;
  const session = run && beginNightRoom(run);
  if (!session) {
    const notice = characterScreen.hidden ? menuFeedback : characterFeedback;
    if (characterScreen.hidden) showScreen(startMenu, nightButton);
    updateText(notice, run ? "无法恢复这轮进度，可以从「开始肉鸽」开新一轮。"
      : "这次没有生成合适的房间，可以再试一次。");
    notice.hidden = false;
    return;
  }
  nightRun = run;
  nightSession = session;
  nightBest = Math.max(nightBest, nightFloorNumber(run));
  saveNightPlayer();
  const level = nightRoom(nightRun);
  loadBoard({ hint: "把箱子推到发光格，别让巡箱鼠叼走。", ...level }, nightSession);
  showScreen(playScreen, title);
  if (nightLost(state)) showNightSummary("failure");
  else if (!receiptLayer.hidden) focusNightReceipt();
  if (!nightChest.hidden) chestOptions[0].focus({ preventScroll: true });
}

function openNight(newRun = false) {
  if (!nightPlayer || nightGenerationPending) return;
  if (nightRun && !newRun) {
    playNight();
    return;
  }

  const screen = screens.find(item => !item.hidden);
  const notice = screen === characterScreen ? characterFeedback : screen === startMenu ? menuFeedback : scoutStatus;
  updateText(notice, "正在生成夜班地图…");
  notice.hidden = false;
  nightGenerationPending = true;
  // Let the notice paint before the layout search begins.
  window.requestAnimationFrame(function () {
    window.setTimeout(function () {
      nightGenerationPending = false;
      if (!screen.hidden) playNight(newRun);
    }, 0);
  });
}

function recordNightAction(action) {
  state = nightSession.state;
  nightRun.actions.push(action);
  saveNightPlayer();
}

function saveNightPlayer() {
  nightPlayer.run = nightRun;
  nightPlayer.best = nightBest;
  nightPlayers.active = nightPlayer.name;
  writeNightPlayers(nightPlayers);
}

function useNightItem(item) {
  if (!nightSession || !nightAction(nightSession, item)) return;
  recordNightAction(item);
  render();
}

function advanceNightRoom() {
  if (nightGenerationPending) return;
  const floor = nightFloorNumber(nightRun) + 1;
  nightGenerationPending = true;
  nextButton.disabled = true;
  updateText(receiptDetail, "正在生成第" + floor + "层…");
  window.requestAnimationFrame(function () {
    window.setTimeout(function () {
      nightGenerationPending = false;
      nextButton.disabled = false;
      if (playScreen.hidden) return;
      const layout = createNightFloor(floor);
      if (!layout) {
        updateText(receiptDetail, "这次没有找到合适的布局，请再试一次。");
        return;
      }
      nightRun = { floor, layout, health: state.health, coins: state.coins,
        supply: { ...nightSession.supply }, actions: [] };
      playNight();
    }, 0);
  });
}

function nightFailureText() {
  if (state.health === 0) return "兔子的生命耗尽了！";
  return state.boxes.length === 0 ? "箱子全被偷走了！" : "箱子被叼走了！";
}

function showNightSummary(mode) {
  if (restartDialog.open) return;
  const failed = mode === "failure";
  const restarting = mode === "restart";
  updateText(document.getElementById("night-final-floor"), nightFloorNumber(nightRun) + " 层");
  updateText(document.getElementById("night-final-best"), nightBest + " 层");
  updateText(document.getElementById("night-final-reason"), failed ? nightFailureText()
    : restarting ? "重开会从第 1 层开始。" : "返回主菜单后可以继续本轮。");
  document.getElementById("night-summary-cancel").hidden = failed;
  document.getElementById("night-summary-menu").hidden = restarting;
  document.getElementById("night-summary-rewind").hidden = !failed || undoButton.disabled;
  document.getElementById("night-summary-restart").hidden = !failed && !restarting;
  restartDialog.returnValue = "cancel";
  restartDialog.showModal();
}

function renderNightShop() {
  const floor = nightFloorNumber(nightRun);
  drawPixelNumber(shopCoinCount, state.coins);
  updateText(shopBalanceText, "余额 " + state.coins + " 金币");
  shopButtons.forEach(function (button) {
    const id = button.dataset.shopItem;
    const sold = state.purchases.includes(id);
    const price = nightShopPrice(id, floor);
    updateText(button.querySelector("strong"), sold ? "已购" : price + " 金币");
    button.disabled = sold || state.coins < price;
  });
}

function showNightFace(reel, id) {
  const faceId = id || "";
  if (reel.dataset.face === faceId && reel.firstElementChild.childElementCount === 3) return;
  const faceIndex = NIGHT_FACE_IDS.indexOf(id);
  const before = NIGHT_FACE_IDS[(faceIndex + NIGHT_FACE_IDS.length - 1) % NIGHT_FACE_IDS.length];
  const after = NIGHT_FACE_IDS[(faceIndex + 1) % NIGHT_FACE_IDS.length];
  reel.dataset.face = faceId;
  fillNightReel(reel, [before, id, after], 1);
}

function nightFaceArt(id) {
  const canvas = document.createElement("canvas");
  canvas.className = "pixel-art";
  canvas.setAttribute("aria-hidden", "true");
  drawPixelSprite(canvas, NIGHT_FACES[id]?.sprite || "reel-idle");
  return canvas;
}

function reelOffset(index) {
  return "translateY(calc(var(--reel-row-size) * " + -index + "))";
}

function fillNightReel(reel, ids, center) {
  const strip = reel.firstElementChild;
  const cells = ids.map(function (id) {
    const cell = document.createElement("div");
    cell.className = "night-reel-symbol";
    cell.dataset.face = id || "";
    const label = document.createElement("strong");
    label.textContent = NIGHT_FACES[id]?.name || "待摇";
    cell.append(nightFaceArt(id), label);
    return cell;
  });
  strip.replaceChildren(...cells);
  strip.style.transform = reelOffset(center);
  return strip;
}

function animateNightReel(reel, from, id, index) {
  const poolSize = NIGHT_FACE_IDS.length;
  const start = NIGHT_FACE_IDS.indexOf(from);
  const target = NIGHT_FACE_IDS.indexOf(id);
  const before = NIGHT_FACE_IDS[(start + poolSize - 1) % poolSize];
  const after = NIGHT_FACE_IDS[(target + 1) % poolSize];
  const travel = Array.from({ length: 9 + 2 * index }, (_, i) => NIGHT_FACE_IDS[(start + i + 1) % poolSize]);
  const center = travel.length + 2;
  const strip = fillNightReel(reel, [before, from, ...travel, id, after], center);
  return strip.animate([
    { transform: reelOffset(1), offset: 0, easing: "cubic-bezier(.34,.08,.24,1)" },
    { transform: reelOffset(center - 0.75), offset: 0.83, easing: "ease-out" },
    { transform: reelOffset(center + 0.085), offset: 0.95, easing: "ease-in-out" },
    { transform: reelOffset(center), offset: 1 }
  ], { duration: 500 + index * 140 });
}

function stopNightReels() {
  reelMotion?.forEach(animation => animation.cancel());
  reelMotion = null;
}

function useNightReels() {
  if (!nightSession || reelMotion !== null || state.chestPending) return;
  const action = state.remaining ? "end" : rollNightReels();
  const previous = state;
  const result = nightAction(nightSession, action);
  if (!result) return;
  recordNightAction(action);
  if (result.ended) animateNightScout(previous);
  if (!result.rolled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    render();
    return;
  }
  const motion = reelWindows.map((reel, index) => animateNightReel(reel, previous.roll?.[index], action[index], index));
  reelMotion = motion;
  Promise.allSettled(motion.map(animation => animation.finished)).then(function () {
    if (reelMotion !== motion) return;
    stopNightReels();
    render();
  });
  render();
}

function animatePieces(elements, effect) {
  if (elements.length === 0) return;
  elements.forEach(function (element) { element.removeAttribute("data-motion"); });
  // Commit the reset so quick consecutive moves can replay the same animation.
  void board.offsetWidth;
  elements.forEach(function (element) { element.setAttribute("data-motion", effect); });
}

function animateNightScout(previous) {
  const oldRats = nightScouts(previous);
  const moved = nightScouts(state).map((rat, index) => sameCell(rat, oldRats[index]) ? null : scoutPieces[index]).filter(Boolean);
  animatePieces(moved, "walk");
  if (state.health < previous.health) {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      playerPiece.querySelector("canvas").animate([
        { filter: "brightness(1) drop-shadow(0 0 0 #ce4a49)" },
        { filter: "brightness(1.4) drop-shadow(0 0 5px #ce4a49)" },
        { filter: "brightness(1) drop-shadow(0 0 0 #ce4a49)" }
      ], { duration: 320 });
    }
  }
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
  if (nightSession && (nightLost(state) || !state.remaining || state.chestPending || reelMotion !== null ||
      restartDialog.open || nightRulesDialog.open || shopDialog.open)) return;
  if (deliveredCount(map, state) === state.boxes.length) return;
  const result = nightSession ? nightAction(nightSession, name) : step(map, state, DIRECTIONS[name]);
  if (!result) {
    animatePieces([playerPiece], "bump");
    return;
  }

  const previous = state;
  const movedPiece = index => boxPieces[previous.boxes[index].id ?? index];
  const affected = result.moved.map(movedPiece);
  if (result.blocked) {
    animatePieces([playerPiece].concat(affected), "bump");
    return;
  }

  if (nightSession) {
    recordNightAction(name);
    animateNightScout(previous);
  } else {
    history.push({ state: previous, direction: name, facingLeft: facingLeft });
    state = result.state;
  }
  if (result.playerTravel) animateTravel(playerPiece, previous.player, result.playerTravel);
  else animatePieces([playerPiece], "walk");
  const travelIndices = result.boxTravels.map(function (item) { return item.index; });
  const pushed = result.moved.filter(function (index) { return !travelIndices.includes(index); });
  animatePieces(pushed.map(movedPiece), result.effect || "nudge");
  result.boxTravels.forEach(function (item) {
    animateTravel(movedPiece(item.index), previous.boxes[item.index], item.travel, result.effect);
  });
  if (name === "left" || name === "right") facePlayer(name === "left");
  render();
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
  if (playScreen.hidden || restartDialog.open || nightRulesDialog.open || shopDialog.open ||
      !direction || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (!directionButtons[direction].disabled) animateButton(directionButtons[direction]);
  move(direction);
});
function undoMove() {
  if (history.length === 0) return;
  const turn = history[history.length - 1];
  const previous = turn.state;
  const moved = previous.boxes.flatMap(function (box, index) {
    const current = nightSession ? state.boxes.find(candidate => candidate.id === box.id) : state.boxes[index];
    return !current || !sameCell(current, box) ? [boxPieces[box.id ?? index]] : [];
  });
  if (nightSession) {
    if (!nightAction(nightSession, "rewind")) return;
    recordNightAction("rewind");
  } else {
    history.pop();
    state = previous;
  }
  facePlayer(turn.facingLeft);
  animatePieces([playerPiece], "walk");
  animatePieces(moved, "nudge");
  render();
}
undoButton.addEventListener("click", undoMove);
recoverButton.addEventListener("click", function () {
  undoMove();
  title.focus({ preventScroll: true });
});
restartButton.addEventListener("click", function () {
  if (nightSession) {
    showNightSummary("restart");
    return;
  }
  loadLevel(levelIndex);
});
nextButton.addEventListener("click", function () {
  if (nightSession) {
    if (nightLost(state)) showNightSummary("failure");
    else if (nightFloorNumber(nightRun) % 5 === 0) {
      renderNightShop();
      shopDialog.returnValue = "";
      shopDialog.showModal();
    } else advanceNightRoom();
    return;
  }
  if (levelIndex + 1 < LEVELS.length) playLevel(levelIndex + 1);
  else showScreen(startMenu, nightButton);
});

function showScreen(screen, focusTarget) {
  screens.forEach(function (item) { item.hidden = item !== screen; });
  if (screen === startMenu) menuFeedback.hidden = true;
  startMenu.parentElement.classList.toggle("showing-menu", screen !== playScreen);
  startMenu.parentElement.classList.toggle("showing-home", screen === startMenu);
  startMenu.parentElement.classList.toggle("choosing-character", screen === characterScreen);
  startMenu.parentElement.classList.toggle("playing", screen === playScreen);
  focusTarget.focus({ preventScroll: true });
}

function playLevel(index) {
  loadLevel(index);
  showScreen(playScreen, title);
}

function enterNightAs(player, fresh) {
  if (nightGenerationPending) return;
  nightPlayer = player;
  nightRun = player.run;
  nightBest = player.best;
  openNight(fresh);
}

function continueGame() {
  const player = nightPlayers.roster.find(item => item.name === nightPlayers.active && item.run) ||
    nightPlayers.roster.findLast(item => item.run);
  if (player) enterNightAs(player, false);
  else if (!nightPlayers.roster.length && legacyNight) showCharacters();
  else {
    updateText(menuFeedback, "还没有肉鸽进度。先点「开始肉鸽」选一个角色。");
    menuFeedback.hidden = false;
  }
}

function showCharacters() {
  characterList.replaceChildren();
  const empty = !nightPlayers.roster.length;
  characterForm.reset();
  characterForm.hidden = !empty;
  newCharacterButton.hidden = empty;
  updateText(characterFeedback, empty ? (legacyNight ? "给第一个角色取名，继续原来的夜班进度。" : "先给你的第一个角色取个名字。")
    : "选择角色开始一轮肉鸽。");
  nightPlayers.roster.forEach(function (player) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    const name = document.createElement("strong");
    const detail = document.createElement("span");
    name.textContent = player.name;
    detail.textContent = player.run ? "第 " + nightFloorNumber(player.run) + " 层 · 最高 " + player.best + " 层"
      : player.best ? "最高 " + player.best + " 层" : "尚未出发";
    button.append(name, detail);
    button.addEventListener("click", function () {
      if (nightGenerationPending) return;
      if (!player.run) {
        enterNightAs(player, true);
        return;
      }
      pendingCharacter = player;
      updateText(document.getElementById("character-restart-message"),
        "继续「" + player.name + "」的进度，或从第 1 层开新一轮。开新一轮会替换当前进度，并保留最高层记录。");
      characterRestart.returnValue = "cancel";
      characterRestart.showModal();
    });
    characterList.append(button);
  });
  showScreen(characterScreen, empty ? characterName : characterTitle);
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

onMenuAction(startButton, function () { playLevel(0); });
onMenuAction(continueButton, continueGame);
onMenuAction(nightButton, showCharacters);
newCharacterButton.addEventListener("click", function () {
  characterForm.hidden = false;
  newCharacterButton.hidden = true;
  updateText(characterFeedback, "给新角色取个名字。");
  characterName.focus();
});
characterForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (nightGenerationPending) return;
  const name = characterName.value.trim();
  const duplicate = nightPlayers.roster.some(player => player.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (!name || duplicate) {
    updateText(characterFeedback, duplicate ? "这个名字已经用过了，请换一个。" : "请先输入角色名字。");
    characterName.focus();
    return;
  }
  if (name.length > 16) return;
  const first = !nightPlayers.roster.length;
  const player = { name, best: first ? legacyBest : 0, run: first ? legacyNight : null };
  nightPlayers.roster.push(player);
  writeNightPlayers(nightPlayers);
  showCharacters();
  enterNightAs(player, !player.run);
});
characterRestart.addEventListener("close", function () {
  const selected = pendingCharacter;
  pendingCharacter = null;
  if (selected && characterRestart.returnValue === "start") enterNightAs(selected, true);
  else if (selected && characterRestart.returnValue === "resume") enterNightAs(selected, false);
});
onMenuAction(document.getElementById("back-from-characters"), function () {
  showScreen(startMenu, nightButton);
});
cheeseButton.title = NIGHT_ITEMS.cheese.hint;
bellButton.title = NIGHT_ITEMS.bell.hint;
cheeseButton.addEventListener("click", function () { useNightItem("cheese"); });
bellButton.addEventListener("click", function () { useNightItem("bell"); });
spinButton.addEventListener("click", useNightReels);

function fitNightRules() {
  if (!nightRulesViewport || !nightRulesDialog.open) return;
  const frame = nightRulesViewport.getBoundingClientRect();
  const dialog = nightRulesDialog.getBoundingClientRect();
  const inset = [frame.top - dialog.top, dialog.right - frame.right,
    dialog.bottom - frame.bottom, frame.left - dialog.left];
  nightRulesDialog.style.setProperty("--rules-inset", inset.map(value => Math.max(0, value) + "px").join(" "));
}

nightRulesButton.addEventListener("click", function () {
  nightRulesDialog.showModal();
  fitNightRules();
  nightRulesContent.scrollTop = 0;
});
nightRulesDialog.addEventListener("close", function () {
  nightRulesButton.focus({ preventScroll: true });
});
if (nightRulesViewport) {
  new ResizeObserver(fitNightRules).observe(nightRulesViewport);
  window.addEventListener("resize", fitNightRules);
  window.addEventListener("scroll", fitNightRules, true);
}
nightRulesDialog.querySelectorAll("[data-rule-face]").forEach(function (heading) {
  heading.prepend(nightFaceArt(heading.dataset.ruleFace));
});
chestOptions.forEach(function (button) {
  const id = button.dataset.chestItem;
  button.prepend(nightFaceArt(id));
  button.title = NIGHT_ITEMS[id].hint;
  button.addEventListener("click", function () {
    const action = "chest-" + id;
    if (!nightSession || !nightAction(nightSession, action)) return;
    recordNightAction(action);
    render();
    title.focus({ preventScroll: true });
  });
});
restartDialog.addEventListener("close", function () {
  if (restartDialog.returnValue === "restart") openNight(true);
  else if (restartDialog.returnValue === "menu") showScreen(startMenu, nightButton);
  else if (restartDialog.returnValue === "rewind") undoMove();
});
drawPixelSprite(shopDialog.querySelector(".night-shop-coin"), "shop-coin");
shopButtons.forEach(function (button) {
  button.querySelector(".night-shop-item").prepend(nightFaceArt(button.dataset.shopItem));
  button.addEventListener("click", function () {
    const action = "buy-" + button.dataset.shopItem;
    if (!nightSession || !nightAction(nightSession, action)) return;
    recordNightAction(action);
    renderNightShop();
    render();
  });
});
shopDialog.addEventListener("close", function () {
  if (shopDialog.returnValue === "advance") advanceNightRoom();
});
onMenuAction(quitButton, function () {
  quitFeedback.textContent = nightPlayers.roster.length
    ? (writeNightPlayers(nightPlayers) ? "角色和肉鸽进度已保存。" : "进度仅保留在当前页面。")
    : "下次见。";
  showScreen(quitScreen, document.getElementById("quit-title"));
});
onMenuAction(document.getElementById("back-from-quit"), function () { showScreen(startMenu, quitButton); });
menuButton.addEventListener("click", function () {
  if (nightSession) showNightSummary(nightLost(state) ? "failure" : "menu");
  else showScreen(startMenu, startButton);
});

drawPixelSprite(document.getElementById("stamp"), "plain");
loadLevel(0);
