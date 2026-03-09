export const WATER_RGB = { r: 50, g: 100, b: 200 };
export const LAND_RGB = { r: 74, g: 222, b: 128 }; // #4ade80
export const SAND_RGB = { r: 194, g: 178, b: 128 };

const NUM_CELLS = 8;
const MAP_SIZE = 100;

// --- Math Utilities ---
const lerp = (a, b, t) => a + t * (b - a);
const fade = (t) => 6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3;
const dotProduct = (gx, gy, dx, dy) => gx * dx + gy * dy;

// ---------------------------------------------------------------------------
// Abstract Base Class
// ---------------------------------------------------------------------------
class NoiseGenerator {
  constructor() {
    if (new.target === NoiseGenerator) {
      throw new TypeError("Cannot construct Abstract instances directly");
    }
  }

  // Every subclass must implement this
  getNoise(x, y) {
    throw new Error("Method 'getNoise(x, y)' must be implemented.");
  }
}

// ---------------------------------------------------------------------------
// TODO 1. Pure White Noise
// ---------------------------------------------------------------------------
class RandomNoise extends NoiseGenerator {
  constructor() {
    super();
  }

  getNoise(x, y) {
    throw new Error("TODO")
  }
}

// ---------------------------------------------------------------------------
// TODO 2. Value Noise
// ---------------------------------------------------------------------------
class ValueNoise extends NoiseGenerator {
  constructor() {
    super();
  }

  getNoise(tileX, tileY) {
    throw new Error("TODO")
  }
}

// ---------------------------------------------------------------------------
// TODO 3. Perlin Noise
// ---------------------------------------------------------------------------
class PerlinNoise extends NoiseGenerator {
  constructor() {
    super();
    this.grid = [];
    const cols = NUM_CELLS + 1;
    const rows = NUM_CELLS + 1;

    for (let y = 0; y < rows; y++) {
      let row = [];
      for (let x = 0; x < cols; x++) {
        const angle = Math.random() * Math.PI * 2;
        row.push({ x: Math.cos(angle), y: Math.sin(angle) });
      }
      this.grid.push(row);
    }
  }

  getNoise(tileX, tileY) {
    const nx = tileX * NUM_CELLS / MAP_SIZE;
    const ny = tileY * NUM_CELLS / MAP_SIZE;
    const cx = Math.floor(nx);
    const cy = Math.floor(ny);
    const u = nx - cx;
    const v = ny - cy;

    const g00 = this.grid[cy][cx];
    const g10 = this.grid[cy][cx + 1];
    const g01 = this.grid[cy + 1][cx];
    const g11 = this.grid[cy + 1][cx + 1];

    const d00 = dotProduct(g00.x, g00.y, u, v);
    const d10 = dotProduct(g10.x, g10.y, u - 1, v);
    const d01 = dotProduct(g01.x, g01.y, u, v - 1);
    const d11 = dotProduct(g11.x, g11.y, u - 1, v - 1);

    const uSmooth = fade(u);
    const vSmooth = fade(v);

    const top = lerp(d00, d10, uSmooth);
    const bottom = lerp(d01, d11, uSmooth);
    const val = lerp(top, bottom, vSmooth);

    return (val + 1) / 2; // Normalize to 0..1
  }
}

// ---------------------------------------------------------------------------
// Main Generator Function
// ---------------------------------------------------------------------------
export function generateMapDataURL(
  type = "perlin",
  width = MAP_SIZE,
  height = MAP_SIZE,
) {
  let noiseGen;

  if (type === "random") {
    noiseGen = new RandomNoise();
  } else if (type === "value") {
    noiseGen = new ValueNoise();
  } else if (type === "perlin") {
    noiseGen = new PerlinNoise();
  } else {
    throw new Error(`Unknown noise type: ${type}`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = noiseGen.getNoise(x, y);

      let color;

      // TODO 4. Sand
      color = val >= 0.5 ? LAND_RGB : WATER_RGB;

      const i = (y * width + x) * 4;
      imgData.data[i] = color.r;
      imgData.data[i + 1] = color.g;
      imgData.data[i + 2] = color.b;
      imgData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}
