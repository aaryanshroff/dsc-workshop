export const WATER_RGB = { r: 50, g: 100, b: 200 };
export const LAND_RGB = { r: 74, g: 222, b: 128 }; // #4ade80
export const SAND_RGB = { r: 194, g: 178, b: 128 };

// --- Math Utilities ---
const lerp = (a, b, t) => a + t * (b - a);
const fade = (t) => 6 * t**5 - 15 * t**4 + 10 * t**3;
const dotProduct = (gx, gy, dx, dy) => (gx * dx) + (gy * dy);

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
// 1. Pure White Noise
// ---------------------------------------------------------------------------
class RandomNoise extends NoiseGenerator {
    constructor() {
        super();
        // No grid precomputation needed for pure random
    }

    getNoise(x, y) {
        return Math.random();
    }
}

// ---------------------------------------------------------------------------
// 2. Value Noise
// ---------------------------------------------------------------------------
class ValueNoise extends NoiseGenerator {
    constructor(width, height, scale) {
        super();
        this.grid = [];
        const cols = Math.ceil(width * scale) + 2;
        const rows = Math.ceil(height * scale) + 2;

        for (let y = 0; y < rows; y++) {
            let row = [];
            for (let x = 0; x < cols; x++) {
                row.push(Math.random());
            }
            this.grid.push(row);
        }
    }

    getNoise(x, y) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        const u = x - cx;
        const v = y - cy;

        const v00 = this.grid[cy][cx];
        const v10 = this.grid[cy][cx + 1];
        const v01 = this.grid[cy + 1][cx];
        const v11 = this.grid[cy + 1][cx + 1];

        const uSmooth = fade(u);
        const vSmooth = fade(v);

        const top = lerp(v00, v10, uSmooth);
        const bottom = lerp(v01, v11, uSmooth);
        return lerp(top, bottom, vSmooth);
    }
}

// ---------------------------------------------------------------------------
// 3. Perlin Noise
// ---------------------------------------------------------------------------
class PerlinNoise extends NoiseGenerator {
    constructor(width, height, scale) {
        super();
        this.grid = [];
        const cols = Math.ceil(width * scale) + 2;
        const rows = Math.ceil(height * scale) + 2;

        for (let y = 0; y < rows; y++) {
            let row = [];
            for (let x = 0; x < cols; x++) {
                const angle = Math.random() * Math.PI * 2;
                row.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            this.grid.push(row);
        }
    }

    getNoise(x, y) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        const u = x - cx;
        const v = y - cy;

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
export function generateMapDataURL(type = "perlin", width = 100, height = 100, scale = 0.08, { sand = false } = {}) {
    let noiseGen;

    if (type === "random") {
        noiseGen = new RandomNoise();
    } else if (type === "value") {
        noiseGen = new ValueNoise(width, height, scale);
    } else if (type === "perlin") {
        noiseGen = new PerlinNoise(width, height, scale);
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
            const val = noiseGen.getNoise(x * scale, y * scale);
            
            let color;
            if (sand && val >= 0.45 && val < 0.5) {
                color = SAND_RGB;
            } else if (val >= 0.5) {
                color = LAND_RGB;
            } else {
                color = WATER_RGB;
            }

            const i = (y * width + x) * 4;
            imgData.data[i]     = color.r;
            imgData.data[i + 1] = color.g;
            imgData.data[i + 2] = color.b;
            imgData.data[i + 3] = 255; 
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
}