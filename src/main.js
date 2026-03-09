import kaplay from "kaplay";
import { generateMapDataURL, WATER_RGB, SAND_RGB } from "./map_generator.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TILE_SIZE = 16;          
const PLAYER_SPEED = 200;      
const TURN_SPEED = 150;        
const BULLET_SPEED = 400;
const SAND_SPEED_MULTIPLIER = 0.15;
const ENABLE_SAND = false;

// Enemy config
const ENEMY_SPEED = 100;       
const ENEMY_RANGE = 250;       
const ENEMY_FIRE_RATE = 1.5;
const PLAYER_MAX_HP = 5;
const ENEMY_MAX_HP = 3;
const MAX_ENEMIES = 5;
const ENEMY_SPAWN_INTERVAL = 5;

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
    const mapDataUrl = generateMapDataURL(NOISE_TYPE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, NOISE_SCALE, { sand: ENABLE_SAND });
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

    // Build terrain grid: 0 = water, 1 = land, 2 = sand
    const terrain = new Uint8Array(MAP_W * MAP_H);
    for (let i = 0; i < MAP_W * MAP_H; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        if (r === WATER_RGB.r && g === WATER_RGB.g && b === WATER_RGB.b) {
            terrain[i] = 0;
        } else if (r === SAND_RGB.r && g === SAND_RGB.g && b === SAND_RGB.b) {
            terrain[i] = 2;
        } else {
            terrain[i] = 1;
        }
    }

    function getTerrain(tileX, tileY) {
        if (tileX < 0 || tileX >= MAP_W || tileY < 0 || tileY >= MAP_H) return 0;
        return terrain[tileY * MAP_W + tileX];
    }

    function isWalkable(tileX, tileY) {
        return getTerrain(tileX, tileY) !== 0;
    }

    function getSpeedMultiplier(x, y) {
        const tileX = Math.floor(x / TILE_SIZE);
        const tileY = Math.floor(y / TILE_SIZE);
        return getTerrain(tileX, tileY) === 2 ? SAND_SPEED_MULTIPLIER : 1.0;
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
    const SAND_TILE_INDEX = 8;

    for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
            const t = terrain[ty * MAP_W + tx];
            const tileIdx = t === 2 ? SAND_TILE_INDEX : t === 1 ? LAND_TILE_INDEX : WATER_TILE_INDEX;
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
        { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP },
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
            { shotTimer: 0, hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP }
        ]);
    }

    for (let i = 0; i < MAX_ENEMIES; i++) {
        spawnEnemy();
    }

    let spawnTimer = 0;
    k.onUpdate(() => {
        if (gameOver) return;
        spawnTimer += k.dt();
        if (spawnTimer >= ENEMY_SPAWN_INTERVAL && k.get("enemy").length < MAX_ENEMIES) {
            spawnEnemy();
            spawnTimer = 0;
        }
    });

    // -----------------------------------------------------------------------
    // Score & Map Toggle
    // -----------------------------------------------------------------------
    let score = 0;
    let showMap = false;
    let gameOver = false;

    k.add([
        k.rect(50, 20),
        k.pos(k.width() - 60, 10),
        k.color(60, 60, 60),
        k.fixed(),
        k.z(100),
        k.area(),
        k.anchor("topleft"),
        "mapBtn",
    ]);

    k.add([
        k.text("Map", { size: 12 }),
        k.pos(k.width() - 35, 20),
        k.fixed(),
        k.z(101),
        k.anchor("center"),
        k.color(255, 255, 255),
        "mapBtnText",
    ]);

    k.onClick("mapBtn", () => {
        showMap = !showMap;
        if (showMap) {
            const mapW = MAP_W * TILE_SIZE;
            const mapH = MAP_H * TILE_SIZE;
            const scaleX = k.width() / mapW;
            const scaleY = k.height() / mapH;
            k.setCamScale(Math.min(scaleX, scaleY));
            k.setCamPos(k.vec2(mapW / 2, mapH / 2));
        } else {
            k.setCamScale(2);
        }
    });

    // -----------------------------------------------------------------------
    // Core Logic (Movement, Camera, AI)
    // -----------------------------------------------------------------------
    k.onUpdate(() => {
        if (gameOver) return;
        if (k.isKeyDown("left") || k.isKeyDown("a")) player.angle -= TURN_SPEED * k.dt();
        if (k.isKeyDown("right") || k.isKeyDown("d")) player.angle += TURN_SPEED * k.dt();

        let moveDir = 0;
        if (k.isKeyDown("up") || k.isKeyDown("w")) moveDir = 1;
        if (k.isKeyDown("down") || k.isKeyDown("s")) moveDir = -1;

        if (moveDir !== 0) {
            const rad = (player.angle - 90) * (Math.PI / 180);
            const speed = PLAYER_SPEED * getSpeedMultiplier(player.pos.x, player.pos.y);
            const vx = Math.cos(rad) * moveDir * speed * k.dt();
            const vy = Math.sin(rad) * moveDir * speed * k.dt();

            if (canMoveTo(player.pos.x + vx, player.pos.y)) player.pos.x += vx;
            if (canMoveTo(player.pos.x, player.pos.y + vy)) player.pos.y += vy;
        }

        if (!showMap) {
            k.setCamPos(k.getCamPos().lerp(k.vec2(player.pos.x, player.pos.y), 0.1));
        }
    });

    k.onUpdate("enemy", (enemy) => {
        if (gameOver) return;
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        enemy.angle = targetAngle;

        if (dist > ENEMY_RANGE) {
            const rad = (enemy.angle - 90) * (Math.PI / 180);
            const speed = ENEMY_SPEED * getSpeedMultiplier(enemy.pos.x, enemy.pos.y);
            const vx = Math.cos(rad) * speed * k.dt();
            const vy = Math.sin(rad) * speed * k.dt();

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
        if (gameOver) return;
        fireBullet(player, false);
    });

    k.onUpdate("bullet", (b) => {
        b.move(b.vx, b.vy);
    });

    k.onCollide("bullet", "enemy", (b, e) => {
        if (!b.isEnemy) {
            k.destroy(b);
            e.hp--;
            if (e.hp <= 0) {
                k.destroy(e);
                score++;
            }
        }
    });

    k.onCollide("bullet", "player", (b) => {
        if (b.isEnemy) {
            k.destroy(b);
            player.hp--;
            if (player.hp <= 0) {
                player.hp = 0;
                player.hidden = true;
                gameOver = true;
            }
        }
    });

    // -----------------------------------------------------------------------
    // Health Bars & Score HUD
    // -----------------------------------------------------------------------
    function drawHealthBar(entity) {
        const barW = TILE_SIZE;
        const barH = 2;
        const x = entity.pos.x - barW / 2;
        const y = entity.pos.y - TILE_SIZE * 0.6;
        const ratio = entity.hp / entity.maxHp;

        k.drawRect({ pos: k.vec2(x, y), width: barW, height: barH, color: k.rgb(80, 80, 80) });
        k.drawRect({ pos: k.vec2(x, y), width: barW * ratio, height: barH, color: ratio > 0.5 ? k.rgb(0, 200, 0) : k.rgb(200, 0, 0) });
    }

    k.onDraw(() => {
        if (!gameOver) {
            drawHealthBar(player);
        }
        k.get("enemy").forEach(drawHealthBar);

        const cam = k.getCamPos();
        const camScale = k.getCamScale();
        const topLeft = k.vec2(cam.x - k.width() / 2 / camScale.x, cam.y - k.height() / 2 / camScale.y);
        k.drawText({
            text: `Score: ${score}`,
            pos: k.vec2(topLeft.x + 5 / camScale.x, topLeft.y + 5 / camScale.y),
            size: 12 / camScale.x,
            color: k.rgb(255, 255, 255),
        });

        if (gameOver) {
            const cx = cam.x;
            const cy = cam.y;
            const s = 1 / camScale.x;

            k.drawRect({
                pos: k.vec2(cx, cy),
                width: 200 * s,
                height: 120 * s,
                anchor: "center",
                color: k.rgb(0, 0, 0),
                opacity: 0.8,
            });
            k.drawText({
                text: "GAME OVER",
                pos: k.vec2(cx, cy - 30 * s),
                size: 24 * s,
                anchor: "center",
                color: k.rgb(255, 50, 50),
            });
            k.drawText({
                text: `Score: ${score}`,
                pos: k.vec2(cx, cy),
                size: 14 * s,
                anchor: "center",
                color: k.rgb(255, 255, 255),
            });
            k.drawRect({
                pos: k.vec2(cx, cy + 35 * s),
                width: 80 * s,
                height: 22 * s,
                anchor: "center",
                color: k.rgb(80, 80, 80),
            });
            k.drawText({
                text: "Restart",
                pos: k.vec2(cx, cy + 35 * s),
                size: 12 * s,
                anchor: "center",
                color: k.rgb(255, 255, 255),
            });
        }
    });

    k.onClick(() => {
        if (!gameOver) return;
        const cam = k.getCamPos();
        const camScale = k.getCamScale();
        const mouse = k.mousePos();
        const worldX = cam.x + (mouse.x - k.width() / 2) / camScale.x;
        const worldY = cam.y + (mouse.y - k.height() / 2) / camScale.y;
        const s = 1 / camScale.x;
        const bx = cam.x - 40 * s;
        const by = cam.y + 24 * s;
        if (worldX >= bx && worldX <= bx + 80 * s && worldY >= by && worldY <= by + 22 * s) {
            location.reload();
        }
    });
}

start();