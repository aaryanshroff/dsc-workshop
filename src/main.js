import kaplay from "kaplay";
import { generateMapDataURL, WATER_RGB } from "./map_generator.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TILE_SIZE = 16;          
const PLAYER_SPEED = 200;      
const TURN_SPEED = 150;        
const BULLET_SPEED = 400;      

// Enemy config
const ENEMY_SPEED = 100;       
const ENEMY_RANGE = 250;       
const ENEMY_FIRE_RATE = 1.5;   

// --- MAP GENERATION CONFIG ---
// Change this to "random", "value", or "perlin"
const NOISE_TYPE = "perlin"; 
const MAP_WIDTH_TILES = 100;
const MAP_HEIGHT_TILES = 100;
const NOISE_SCALE = 0.08; // Smaller number = larger islands

// ---------------------------------------------------------------------------
// Init kaplay
// ---------------------------------------------------------------------------
const k = kaplay({
    width:  800,
    height: 600,
    background: [20, 20, 30],
    global: false,
    scale: 1,
});

// ---------------------------------------------------------------------------
// Load Assets
// ---------------------------------------------------------------------------
const SPRITESHEET_URL = "/assets/Spritesheet/roguelikeSheet_transparent.png";
const SPACING = 1;
const SHEET_COLS = 57;
const SHEET_ROWS = 31;
const atlas = {};
for (let row = 0; row < SHEET_ROWS; row++) {
    for (let col = 0; col < SHEET_COLS; col++) {
        const idx = row * SHEET_COLS + col;
        atlas[`tile_${idx}`] = {
            x: col * (TILE_SIZE + SPACING),
            y: row * (TILE_SIZE + SPACING),
            width: TILE_SIZE,
            height: TILE_SIZE,
        };
    }
}
k.loadSpriteAtlas(SPRITESHEET_URL, atlas);

const TANK_SHEET_URL = "/assets/Spritesheet/sheet_tanks.png";
const tankAtlas = {
    tank_green: { x: 669, y: 182, width: 75, height: 70 },
};
k.loadSpriteAtlas(TANK_SHEET_URL, tankAtlas);

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

async function start() {
    // GENERATE THE MAP DYNAMICALLY
    const mapDataUrl = generateMapDataURL(NOISE_TYPE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, NOISE_SCALE);
    const img = await loadImage(mapDataUrl);

    const canvas = document.createElement("canvas");
    canvas.width  = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    const MAP_W = img.width;
    const MAP_H = img.height;

    // Build walkability grid
    const walkable = new Uint8Array(MAP_W * MAP_H);
    for (let i = 0; i < MAP_W * MAP_H; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        walkable[i] = (r === WATER_RGB.r && g === WATER_RGB.g && b === WATER_RGB.b) ? 0 : 1;
    }

    function isWalkable(tileX, tileY) {
        if (tileX < 0 || tileX >= MAP_W || tileY < 0 || tileY >= MAP_H) return false;
        return walkable[tileY * MAP_W + tileX] === 1;
    }

    // -----------------------------------------------------------------------
    // High-Performance Map Rendering
    // -----------------------------------------------------------------------
    const bigCanvas = document.createElement("canvas");
    bigCanvas.width = MAP_W * TILE_SIZE;
    bigCanvas.height = MAP_H * TILE_SIZE;
    const bigCtx = bigCanvas.getContext("2d");
    bigCtx.imageSmoothingEnabled = false;

    const sheetImg = await loadImage(SPRITESHEET_URL);
    const WATER_TILE_INDEX = 0; 
    const LAND_TILE_INDEX = 5;  

    for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
            const tileIdx = walkable[ty * MAP_W + tx] ? LAND_TILE_INDEX : WATER_TILE_INDEX;
            const meta = atlas[`tile_${tileIdx}`];
            if (meta) {
                bigCtx.drawImage(
                    sheetImg,
                    meta.x, meta.y, meta.width, meta.height,
                    tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                );
            }
        }
    }

    k.loadSprite("map_sprite", bigCanvas.toDataURL());
    k.add([
        k.sprite("map_sprite"),
        k.pos(0, 0),
        k.z(0),
        k.anchor("topleft"),
    ]);

    // -----------------------------------------------------------------------
    // Mathematical Collision Check Helper
    // -----------------------------------------------------------------------
    const HITBOX_RADIUS = TILE_SIZE * 0.35; 

    function canMoveTo(x, y) {
        const tL = isWalkable(Math.floor((x - HITBOX_RADIUS) / TILE_SIZE), Math.floor((y - HITBOX_RADIUS) / TILE_SIZE));
        const tR = isWalkable(Math.floor((x + HITBOX_RADIUS) / TILE_SIZE), Math.floor((y - HITBOX_RADIUS) / TILE_SIZE));
        const bL = isWalkable(Math.floor((x - HITBOX_RADIUS) / TILE_SIZE), Math.floor((y + HITBOX_RADIUS) / TILE_SIZE));
        const bR = isWalkable(Math.floor((x + HITBOX_RADIUS) / TILE_SIZE), Math.floor((y + HITBOX_RADIUS) / TILE_SIZE));
        return tL && tR && bL && bR;
    }

    // -----------------------------------------------------------------------
    // Player Setup
    // -----------------------------------------------------------------------
    let spawnX = Math.floor(MAP_W / 2);
    let spawnY = Math.floor(MAP_H / 2);

    outer:
    for (let radius = 0; radius < Math.max(MAP_W, MAP_H); radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                if (isWalkable(spawnX + dx, spawnY + dy)) {
                    spawnX += dx;
                    spawnY += dy;
                    break outer;
                }
            }
        }
    }

    const TANK_SRC_W = 75;
    const PLAYER_SCALE = TILE_SIZE / TANK_SRC_W;
    
    const player = k.add([
        k.sprite("tank_green"),
        k.pos(spawnX * TILE_SIZE + TILE_SIZE / 2, spawnY * TILE_SIZE + TILE_SIZE / 2),
        k.scale(PLAYER_SCALE),
        k.rotate(0), 
        k.anchor("center"),
        k.area({ scale: 0.8 }),
        k.z(1),
        "player",
    ]);

    k.setCamScale(2);

    // -----------------------------------------------------------------------
    // Enemy Setup & Spawner
    // -----------------------------------------------------------------------
    function spawnEnemy() {
        let ex = 0, ey = 0;
        let valid = false;
        
        while (!valid) {
            ex = Math.floor(Math.random() * MAP_W);
            ey = Math.floor(Math.random() * MAP_H);
            valid = isWalkable(ex, ey);
        }

        k.add([
            k.sprite("tank_green"),
            k.color(255, 100, 100),
            k.pos(ex * TILE_SIZE + TILE_SIZE / 2, ey * TILE_SIZE + TILE_SIZE / 2),
            k.scale(PLAYER_SCALE),
            k.rotate(0),
            k.anchor("center"),
            k.area({ scale: 0.8 }),
            k.z(1),
            "enemy",
            { shotTimer: 0 }
        ]);
    }

    for(let i = 0; i < 5; i++) {
        spawnEnemy();
    }

    // -----------------------------------------------------------------------
    // Core Logic (Movement, Camera, AI)
    // -----------------------------------------------------------------------
    k.onUpdate(() => {
        if (k.isKeyDown("left") || k.isKeyDown("a")) player.angle -= TURN_SPEED * k.dt();
        if (k.isKeyDown("right") || k.isKeyDown("d")) player.angle += TURN_SPEED * k.dt();

        let moveDir = 0;
        if (k.isKeyDown("up") || k.isKeyDown("w")) moveDir = 1;
        if (k.isKeyDown("down") || k.isKeyDown("s")) moveDir = -1;

        if (moveDir !== 0) {
            const rad = (player.angle - 90) * (Math.PI / 180);
            const vx = Math.cos(rad) * moveDir * PLAYER_SPEED * k.dt();
            const vy = Math.sin(rad) * moveDir * PLAYER_SPEED * k.dt();

            if (canMoveTo(player.pos.x + vx, player.pos.y)) player.pos.x += vx;
            if (canMoveTo(player.pos.x, player.pos.y + vy)) player.pos.y += vy;
        }

        k.setCamPos(k.getCamPos().lerp(k.vec2(player.pos.x, player.pos.y), 0.1));
    });

    k.onUpdate("enemy", (enemy) => {
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        enemy.angle = targetAngle;

        if (dist > ENEMY_RANGE) {
            const rad = (enemy.angle - 90) * (Math.PI / 180);
            const vx = Math.cos(rad) * ENEMY_SPEED * k.dt();
            const vy = Math.sin(rad) * ENEMY_SPEED * k.dt();

            if (canMoveTo(enemy.pos.x + vx, enemy.pos.y)) enemy.pos.x += vx;
            if (canMoveTo(enemy.pos.x, enemy.pos.y + vy)) enemy.pos.y += vy;
        }

        enemy.shotTimer += k.dt();
        if (dist <= ENEMY_RANGE && enemy.shotTimer >= ENEMY_FIRE_RATE) {
            enemy.shotTimer = 0;
            fireBullet(enemy, true); 
        }
    });

    // -----------------------------------------------------------------------
    // Shooting System
    // -----------------------------------------------------------------------
    function fireBullet(shooter, isEnemyBullet) {
        const rad = (shooter.angle - 90) * (Math.PI / 180);
        const barrelDistance = TILE_SIZE * 0.8; 
        const spawnX = shooter.pos.x + Math.cos(rad) * barrelDistance;
        const spawnY = shooter.pos.y + Math.sin(rad) * barrelDistance;

        k.add([
            k.rect(3, 8),                  
            k.color(isEnemyBullet ? [255, 50, 50] : [255, 200, 0]),          
            k.pos(spawnX, spawnY),
            k.rotate(shooter.angle),        
            k.anchor("center"),
            k.area(), 
            k.offscreen({ destroy: true }),
            "bullet",                      
            {
                vx: Math.cos(rad) * BULLET_SPEED,
                vy: Math.sin(rad) * BULLET_SPEED,
                isEnemy: isEnemyBullet
            }
        ]);
    }

    k.onKeyPress("space", () => {
        fireBullet(player, false);
    });

    k.onUpdate("bullet", (b) => {
        b.move(b.vx, b.vy);
        
        if (!isWalkable(Math.floor(b.pos.x / TILE_SIZE), Math.floor(b.pos.y / TILE_SIZE))) {
            k.destroy(b);
        }
    });

    k.onCollide("bullet", "enemy", (b, e) => {
        if (!b.isEnemy) { 
            k.destroy(b);
            k.destroy(e);
            console.log("Enemy destroyed!");
        }
    });

    k.onCollide("bullet", "player", (b, p) => {
        if (b.isEnemy) { 
            k.destroy(b);
            console.log("Player hit!");
        }
    });
}

start();