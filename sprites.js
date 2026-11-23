"use strict";

// Each character is one pixel. A period leaves the canvas transparent.
const PIXEL_SPRITES = {
  "shop-coin": {
    palette: { K: "#734522", H: "#fff5b0", Y: "#ffdb6d", G: "#e6a63f", D: "#bb7428" },
    rows: [
      "............", "....KKKK....", "..KKHHYGKK..", "..KHHYGGDK..",
      ".KHHYHYGDDK.", ".KHYYHYGDDK.", ".KYYGHGGDDK.", ".KYYGHGGDDK.",
      "..KYGGGDDK..", "..KKDDDDKK..", "....KKKK....", "............"
    ]
  },
  "reel-idle": {
    palette: { K: "#82532d", G: "#d5943e", Y: "#efbd62", H: "#ffe4a8" },
    rows: [
      "............", ".....KK.....", "....KHHK....", "...KHHYYK...",
      "..KHHYYYGK..", ".KHHYYYYGGK.", ".KYYYYYGGGK.", "..KYYYGGGK..",
      "...KGGGGK...", "....KGGK....", ".....KK.....", "............"
    ]
  },
  "reel-boot": {
    palette: { K: "#43261d", H: "#f2b474", L: "#bc713f", D: "#8b482e", C: "#e1c295" },
    rows: [
      "............", "..KKKKKK....", "..KHHLLK....", "..KLLCDK....",
      "..KLLCDK....", "..KLLDDKK...", "..KLLLLLLKK.", "..KLLLLHHLK.",
      "..KDDDDLLLK.", "..KKKKKKKKK.", "...K.K.K.K..", "............"
    ]
  },
  "reel-broken": {
    palette: { K: "#402f35", H: "#d2a9a0", L: "#856269", D: "#644951", R: "#e8786b", C: "#edc19e" },
    rows: [
      "............", "..KKKKKK....", "..KHHLLK....", "..KLLCDK....",
      "..KLLCDK....", "..KLLDDKK...", "..KLLLRLRKK.", "..KLHRRRLHK.",
      "..KDDDDRRDK.", "..KKKKKRRKK.", "...K.K...K..", "............"
    ]
  },
  "reel-cheese": {
    palette: { K: "#854c28", H: "#fff1a2", Y: "#ffd66a", G: "#f0ad46", D: "#bf762e" },
    rows: [
      "............", "......KK....", ".....KHHK...", "...KKHHYYK..",
      "..KHHHYYYYK.", ".KHHHYYYGGK.", ".KYYYKKGGGK.", ".KYYYYYGGDK.",
      ".KYDYYGGDDK.", ".KYYYGGDDDK.", "..KKKKKKKK..", "............"
    ]
  },
  "reel-bell": {
    palette: { K: "#66412a", H: "#fff0b2", Y: "#ebbf5f", G: "#c38c33", D: "#935822" },
    rows: [
      "............", ".....KK.....", "....KYHK....", "...KHHYYK...",
      "...KHYYGK...", "...KHYYGK...", "...KYYGGK...", "..KHYYGGDK..",
      ".KHHHYYGGDK.", ".KKKKKKKKKK.", "....KYGK....", ".....KK....."
    ]
  },
  "reel-ticket": {
    palette: { K: "#365b4c", W: "#f5e7ab", H: "#cbe1b5", L: "#91b891", D: "#5e8471" },
    rows: [
      "............", "............", "..KKKKKKKK..", ".KHHHHHHHLK.",
      ".KHWWDWWDLK.", "..KWWDDWDLK.", "..KWDDWWDLK.", ".KHWWWWWDLK.",
      ".KLLLLLLLLK.", "..KKKKKKKK..", "............", "............"
    ]
  },
  "reel-chest": {
    palette: { K: "#503021", H: "#ffe9a5", Y: "#e5af54", W: "#ae693b", D: "#74402f" },
    rows: [
      "............", "............", "..KKKKKKKK..", ".KHYYYYYYHK.",
      ".KYWDDDDWYK.", ".KYWWWWWWYK.", ".KKKKHHKKKK.", ".KYWYHHYWYK.",
      ".KYWWYYWWYK.", ".KYWDDDDWYK.", ".KKKKKKKKKK.", "............"
    ]
  },
  worker: {
    palette: {"K": "#464338", "W": "#fff7e6", "P": "#e98d91", "A": "#a3d7bc", "N": "#785451", "G": "#6cb69c", "Y": "#ffdd78"},
    rows: [
      "................",
      "....KK...KK.....",
      "...KWWK.KWWK....",
      "...KPWK.KWPK....",
      "...KWWKKKWWK....",
      "...KAAAAAAAK....",
      "..KAAAAAAAAAK...",
      "...KWWWWWWWK....",
      "..KWKWWWWWKWK...",
      "..KWPWWNWWPWK...",
      "...KWWWWWWWK....",
      "...KGGGGGGGK....",
      "..KGGYGGYGGGK...",
      "..KGGGGGGGGGK...",
      "...KKK...KKK....",
      "................"
    ]
  },
  scout: {
    palette: { K: "#4b303c", S: "#7d5679", B: "#ad7e9b", P: "#f4aabb", C: "#fff2dc", R: "#bd525d" },
    rows: [
      "................",
      "...KK.....KK....",
      "..KPPK...KPPK...",
      "..KPBBKKKBBPK...",
      "...KBBBBBBBK....",
      "..KBBBBBBBBBK...",
      "..KBKCBBCKBBK...",
      ".KBBBBPPBBBBBK..",
      "..KCPCCCCPCK....",
      "...KRRRRRRK.....",
      "..KSSSSSSSSK....",
      "..KSCKKKCSSK..K.",
      "...KKSSSSKK.KK..",
      "....KKKKKKKKK...",
      "....KK..KK......",
      "................"
    ]
  },
  plain: {
    palette: {"K": "#683f30", "T": "#ffe1a6", "H": "#fff0c4", "M": "#efad66", "D": "#cb7e4e", "P": "#ed8d88", "N": "#815147", "L": "#e49b56"},
    rows: [
      "................",
      "................",
      "...KKKKKKKKKK...",
      "..KTTTHHTTTTTK..",
      ".KTTTTHHTTTTDTK.",
      ".KMMMMHHMMMMDDK.",
      ".KMHHHHHHHMMDDK.",
      ".KMHKHHKHHMMDDK.",
      ".KMHPHNHPMMMDDK.",
      ".KMMMMMMMMMMDDK.",
      ".KMMMMMMMMMMDDK.",
      ".KLLLLLLLLLLDDK.",
      "..KKKKKKKKKKKK..",
      "................",
      "................",
      "................"
    ]
  },
  spring: {
    palette: {"K": "#534060", "T": "#eccef2", "V": "#9b75bb", "M": "#c9a2e2", "D": "#a981c3", "W": "#fff2fd", "H": "#f6e5f8", "P": "#eb90b1", "N": "#794e76"},
    rows: [
      "................",
      "................",
      "...KKKKKKKKKK...",
      "..KTTTVVTTTTTK..",
      ".KTTTTVVTTTTDTK.",
      ".KMMMMVVMMMMDDK.",
      ".KMWWHHWWWMMDDK.",
      ".KMWKWKWKWMMDDK.",
      ".KMWPWNWPWMMDDK.",
      ".KMMMMMMMMMMDDK.",
      "..KKKKKKKKKKKK..",
      ".....KWWWWK.....",
      "......KVVK......",
      ".....KWWWWK.....",
      "....KKKKKKKK....",
      "................"
    ]
  },
  twin: {
    palette: {"K": "#3d536a", "T": "#c7e8f2", "W": "#e9f8ff", "M": "#98c6e2", "D": "#709cbf", "P": "#f596ad", "N": "#5b566f", "L": "#86b5d5"},
    rows: [
      "................",
      "................",
      "...KKKKKKKKKK...",
      "..KTTTWWTTTTTK..",
      ".KTTTTWWTTTTDTK.",
      ".KMMMMWWMMMMDDK.",
      ".KMWWWWWWWMMDDK.",
      ".KMWKWWWKWMMDDK.",
      ".KMWPWNWPWMMDDK.",
      ".KMMMMPPMMMMDDK.",
      ".KMMMMMMMMMMDDK.",
      ".KLLLLLLLLLLDDK.",
      "..KKKKKKKKKKKK..",
      "................",
      "................",
      "................"
    ]
  }
};

function drawPixelSprite(canvas, name) {
  const sprite = PIXEL_SPRITES[name];
  const size = sprite.rows.length;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  sprite.rows.forEach(function (row, y) {
    Array.from(row).forEach(function (pixel, x) {
      if (pixel === ".") return;
      context.fillStyle = sprite.palette[pixel];
      context.fillRect(x, y, 1, 1);
    });
  });
}

const PIXEL_DIGITS = [
  [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  ["#####", "#....", "#....", "####.", "....#", "....#", "####."],
  [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."]
];

function drawPixelNumber(canvas, value) {
  const digits = Array.from(String(value), digit => PIXEL_DIGITS[digit]);
  canvas.width = digits.length * 6 - 1;
  canvas.height = 7;
  const context = canvas.getContext("2d");
  context.fillStyle = "#643b22";
  digits.forEach(function (digit, index) {
    digit.forEach(function (row, y) {
      Array.from(row).forEach(function (pixel, x) {
        if (pixel === "#") context.fillRect(index * 6 + x, y, 1, 1);
      });
    });
  });
}
