export const WATER_RGB = { r: 50, g: 100, b: 200 };
export const LAND_RGB = { r: 74, g: 222, b: 128 }; // #4ade80
export const SAND_RGB = { r: 194, g: 178, b: 128 };

const NUM_CELLS = 8;
const MAP_SIZE = 100;
const NOISE_TYPE = "perlin";

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
    throw new Error("TODO");
  }
}

// ---------------------------------------------------------------------------
// TODO 2. Value Noise
// ---------------------------------------------------------------------------
class ValueNoise extends NoiseGenerator {
  constructor() {
    super();
    this.grid = [];
    for (let y = 0; y <= NUM_CELLS; y++) {
      const row = [];
      for (let x = 0; x <= NUM_CELLS; x++) {
        row.push(Math.random());
      }
      this.grid.push(row);
    }
  }

  getNoise(x, y) {
    const xProp = (x / MAP_SIZE) * NUM_CELLS;
    const gX = Math.floor(xProp);
    const percentCellX = xProp - gX;

    const yProp = (y / MAP_SIZE) * NUM_CELLS;
    const gY = Math.floor(yProp);
    const percentCellY = yProp - gY;

    const topLeft = this.grid[gX][gY];
    const topRight = this.grid[gX + 1][gY];
    const bottomLeft = this.grid[gX][gY + 1];
    const bottomRight = this.grid[gX + 1][gY + 1];

    const topVal = lerp(topLeft, topRight, fade(percentCellX));
    const bottomVal = lerp(bottomLeft, bottomRight, fade(percentCellX));

    return lerp(topVal, bottomVal, fade(percentCellY));
  }
}

// ---------------------------------------------------------------------------
// TODO 3. Perlin Noise
// ---------------------------------------------------------------------------
class PerlinNoise extends NoiseGenerator {
  constructor() {
    super();
    this.grid = [];
    for (let y = 0; y <= NUM_CELLS; y++) {
      const row = [];
      for (let x = 0; x <= NUM_CELLS; x++) {
        const angle = Math.random() * Math.PI * 2;
        row.push({
          x: Math.cos(angle),
          y: Math.sin(angle),
        });
      }
      this.grid.push(row);
    }
  }

  getNoise(x, y) {
    const xProp = (x / MAP_SIZE) * NUM_CELLS;
    const gX = Math.floor(xProp);
    const percentCellX = xProp - gX;

    const yProp = (y / MAP_SIZE) * NUM_CELLS;
    const gY = Math.floor(yProp);
    const percentCellY = yProp - gY;

    const topLeft = this.grid[gX][gY];
    const topRight = this.grid[gX + 1][gY];
    const bottomLeft = this.grid[gX][gY + 1];
    const bottomRight = this.grid[gX + 1][gY + 1];

    // Dot products
    const tlDot = dotProduct(topLeft.x, topLeft.y, percentCellX, percentCellY);
    const trDot = dotProduct(
      topRight.x,
      topRight.y,
      percentCellX - 1,
      percentCellY,
    );
    const blDot = dotProduct(
      bottomLeft.x,
      bottomLeft.y,
      percentCellX,
      percentCellY - 1,
    );
    const brDot = dotProduct(
      bottomRight.x,
      bottomRight.y,
      percentCellX - 1,
      percentCellY - 1,
    );

    const topVal = lerp(tlDot, trDot, fade(percentCellX));
    const bottomVal = lerp(blDot, brDot, fade(percentCellX));

    return (lerp(topVal, bottomVal, fade(percentCellY)) + 1) / 2;
  }
}

// ---------------------------------------------------------------------------
// Main Generator Function
// ---------------------------------------------------------------------------
export function generateMapDataURL(width = MAP_SIZE, height = MAP_SIZE) {
  let noiseGen;

  if (NOISE_TYPE === "random") {
    noiseGen = new RandomNoise();
  } else if (NOISE_TYPE === "value") {
    noiseGen = new ValueNoise();
  } else if (NOISE_TYPE === "perlin") {
    noiseGen = new PerlinNoise();
  } else {
    throw new Error(`Unknown noise type: ${NOISE_TYPE}`);
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

      // // TODO 4. Sand
      // if (val >= 0.5) {
      //   color = LAND_RGB;
      // } else if (val >= 0.45) {
      //   color = SAND_RGB;
      // } else {
      //   color = WATER_RGB;
      // }
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
