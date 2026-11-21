"use strict";

// Each character is one pixel. A period leaves the canvas transparent.
const PIXEL_SPRITES = {
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
