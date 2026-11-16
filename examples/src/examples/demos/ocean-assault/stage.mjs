// The raiders of the Ocean Assault demo: what each one is, how it flies and shoots, and the order
// they arrive in.

/**
 * @import { Entity } from 'playcanvas'
 */

// The size of the screen, in pixels. The world has the same units, with its origin at the bottom
// left of the screen.
export const WIDTH = 192;
export const HEIGHT = 256;

/**
 * What a raider can see of the game, and how it shoots.
 *
 * @typedef {object} World
 * @property {{ x: number, y: number, alive: boolean }} player - The player's seaplane.
 * @property {number} loop - How many times the stage has been cleared, which raises the pace.
 * @property {number} scrolled - The whole pixels the sea has gone by this frame.
 * @property {(x: number, y: number, vx: number, vy: number) => void} orb - Fires a slow shot.
 * @property {(x: number, y: number, vx: number, vy: number) => void} needle - Fires a fast shot.
 * @property {(x: number, y: number, speed: number) => void} missile - Launches a missile, which
 * turns toward the player as it flies.
 */

/**
 * @typedef {object} EnemyType
 * @property {string} frames - The start of the names of its frames in the sprite sheet.
 * @property {number} hp - The hits it takes.
 * @property {number} radius - The radius it is hit within, in pixels.
 * @property {number} score - The points for destroying it.
 * @property {boolean} big - Whether it goes up in a large explosion.
 * @property {boolean} sea - Whether it sails rather than flies: it has no shadow and cannot be
 * flown into.
 * @property {number} drop - The chance it leaves a power up behind.
 * @property {(enemy: Enemy, dt: number, world: World) => void} shoot - Its shooting.
 */

/**
 * @typedef {object} Enemy
 * @property {Entity} entity - Its sprite.
 * @property {Entity} shadow - Its shadow on the sea.
 * @property {boolean} active - Whether it is in play.
 * @property {EnemyType} type - What it is.
 * @property {keyof typeof PATHS} path - How it flies.
 * @property {number} x - Its position.
 * @property {number} y - Its position.
 * @property {number} x0 - Where it came in.
 * @property {number} vx - Its velocity, for the paths that keep one.
 * @property {number} vy - Its velocity, for the paths that keep one.
 * @property {number} side - 1 to head right, -1 to head left.
 * @property {number} index - Its place in its formation.
 * @property {number} age - The seconds since it arrived.
 * @property {number} hp - The hits it has left.
 * @property {number} flash - The seconds it stays white for, after a hit.
 * @property {number} cooldown - The seconds until it shoots again.
 */

// Shots speed up, and come more often, each time the stage is cleared
const pace = (/** @type {World} */ world) => 1 + world.loop * 0.2;

/**
 * @param {number} x - Where the shot starts.
 * @param {number} y - Where the shot starts.
 * @param {World} world - The game.
 * @param {number} speed - The speed of the shot.
 * @param {number} [spread] - An angle to turn the shot by, in radians.
 * @returns {number[]} The velocity of a shot at the player.
 */
const aim = (x, y, world, speed, spread = 0) => {
    const angle = Math.atan2(world.player.y - y, world.player.x - x) + spread;
    return [Math.cos(angle) * speed, Math.sin(angle) * speed];
};

/** @type {Record<string, EnemyType>} */
export const ENEMIES = {
    // a fast delta wing, in formations. One in three takes a shot on the way in.
    dart: {
        frames: 'dart',
        hp: 1,
        radius: 7,
        score: 100,
        big: false,
        sea: false,
        drop: 0.02,
        shoot(enemy, dt, world) {
            const shooter = enemy.index % (world.loop > 0 ? 2 : 3) === 0;
            if (shooter && enemy.cooldown < 0 && enemy.age > 0.7 && enemy.y > 100) {
                enemy.cooldown = Infinity;
                const [vx, vy] = aim(enemy.x, enemy.y, world, 125 * pace(world));
                world.needle(enemy.x, enemy.y - 6, vx, vy);
            }
        }
    },

    // a slow biplane that keeps shooting at the player
    wasp: {
        frames: 'wasp',
        hp: 3,
        radius: 7,
        score: 200,
        big: false,
        sea: false,
        drop: 0.05,
        shoot(enemy, dt, world) {
            if (enemy.cooldown < 0 && enemy.y > 70 && enemy.y < HEIGHT - 8) {
                enemy.cooldown = 1.5 / pace(world);
                const [vx, vy] = aim(enemy.x, enemy.y, world, 64 * pace(world));
                world.orb(enemy.x, enemy.y - 6, vx, vy);
            }
        }
    },

    // a twin engined bomber that holds the top of the screen and fires fans of three
    gunship: {
        frames: 'gunship',
        hp: 16,
        radius: 13,
        score: 1000,
        big: true,
        sea: false,
        drop: 1,
        shoot(enemy, dt, world) {
            if (enemy.cooldown < 0 && enemy.y < HEIGHT - 20) {
                enemy.cooldown = 1.8 / pace(world);
                for (const spread of [-0.32, 0, 0.32]) {
                    const [vx, vy] = aim(enemy.x, enemy.y, world, 60 * pace(world), spread);
                    world.orb(enemy.x, enemy.y - 10, vx, vy);
                }
            }
        }
    },

    // a gunboat on the sea below, which launches missiles
    boat: {
        frames: 'boat',
        hp: 12,
        radius: 9,
        score: 600,
        big: true,
        sea: true,
        drop: 0.25,
        shoot(enemy, dt, world) {
            if (enemy.cooldown < 0 && enemy.y > 40 && enemy.y < HEIGHT - 16) {
                enemy.cooldown = 2.8 / pace(world);
                world.missile(enemy.x, enemy.y + 2, 112 * pace(world));
            }
        }
    }
};

/**
 * How a raider moves, by the name a wave gives.
 *
 * @type {Record<string, (enemy: Enemy, dt: number, world: World) => void>}
 */
export const PATHS = {
    // straight down the screen, weaving
    weave(enemy, dt) {
        enemy.y -= 78 * dt;
        enemy.x = enemy.x0 + Math.sin(enemy.age * 3.4) * 20;
    },

    // in from one side at the top, down in an arc, and out across the other side
    sweep(enemy) {
        enemy.x = enemy.x0 + enemy.side * enemy.age * 88;
        enemy.y = HEIGHT - 6 - 118 * (1 - Math.exp(-enemy.age * 1.5)) - 14 * enemy.age;
    },

    // down to a line, a moment to take aim, then a dive at where the player was
    dive(enemy, dt, world) {
        if (enemy.age < 0.9) {
            enemy.y -= 96 * dt;
        } else if (enemy.age < 1.5) {
            enemy.vx = Math.max(-90, Math.min(90, (world.player.x - enemy.x) * 1.4));
            enemy.vy = 0;
        } else {
            enemy.vy -= 420 * dt;
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;
        }
    },

    // a slow descent
    descend(enemy, dt) {
        enemy.y -= 30 * dt;
        enemy.x = enemy.x0 + Math.sin(enemy.age * 1.4 + enemy.index) * 12;
    },

    // down to the top of the screen, to and fro there for a while, then away
    strafe(enemy, dt) {
        if (enemy.age < 13) {
            enemy.y = Math.max(HEIGHT - 62, enemy.y - 40 * dt);
            enemy.x += enemy.side * 20 * dt;
            if (enemy.x < 28 || enemy.x > WIDTH - 28) enemy.side = -enemy.side;
        } else {
            enemy.y += 40 * dt;
        }
    },

    // under way on the sea, at half the speed the sea goes by: it moves with the sea, a pixel for
    // every two of the sea's, so it never shudders against the waves
    sail(enemy, dt, world) {
        enemy.y -= world.scrolled / 2;
    }
};

/**
 * The stage: each wave arrives `at` a time in seconds, as `count` raiders of a type `gap` seconds
 * apart, each `step` pixels along from the last.
 *
 * @type {{ at: number, type: string, path: string, x?: number, side?: number, count?: number, gap?: number, step?: number }[]}
 */
const WAVES = [
    { at: 2, type: 'dart', path: 'weave', x: 56, count: 5, gap: 0.28 },
    { at: 5, type: 'dart', path: 'weave', x: 136, count: 5, gap: 0.28 },
    { at: 8.5, type: 'wasp', path: 'descend', x: 40, count: 3, gap: 0.6, step: 56 },
    { at: 13, type: 'dart', path: 'sweep', side: 1, count: 6, gap: 0.22 },
    { at: 15.5, type: 'dart', path: 'sweep', side: -1, count: 6, gap: 0.22 },
    { at: 18, type: 'boat', path: 'sail', x: 150 },
    { at: 20, type: 'gunship', path: 'strafe', x: 60, side: 1 },
    { at: 23, type: 'dart', path: 'dive', x: 36, count: 4, gap: 0.5, step: 40 },
    { at: 27, type: 'wasp', path: 'descend', x: 64, count: 3, gap: 0.7, step: 32 },
    { at: 30, type: 'boat', path: 'sail', x: 40 },
    { at: 31, type: 'dart', path: 'weave', x: 96, count: 7, gap: 0.24 },
    { at: 34, type: 'dart', path: 'sweep', side: 1, count: 5, gap: 0.2 },
    { at: 34.6, type: 'dart', path: 'sweep', side: -1, count: 5, gap: 0.2 },
    { at: 38, type: 'gunship', path: 'strafe', x: 130, side: -1 },
    { at: 40, type: 'wasp', path: 'descend', x: 30, count: 4, gap: 0.6, step: 44 },
    { at: 44, type: 'dart', path: 'dive', x: 156, count: 4, gap: 0.45, step: -40 },
    { at: 47, type: 'boat', path: 'sail', x: 110 },
    { at: 48, type: 'boat', path: 'sail', x: 70 },
    { at: 50, type: 'dart', path: 'weave', x: 40, count: 6, gap: 0.25 },
    { at: 51, type: 'dart', path: 'weave', x: 152, count: 6, gap: 0.25 },
    { at: 55, type: 'gunship', path: 'strafe', x: 50, side: 1 },
    { at: 56, type: 'gunship', path: 'strafe', x: 142, side: -1 },
    { at: 60, type: 'dart', path: 'sweep', side: 1, count: 8, gap: 0.18 }
];

// When the airship arrives, in seconds
export const BOSS_AT = 67;

/**
 * Every raider of the stage, in the order they arrive.
 *
 * @type {{ at: number, type: EnemyType, path: string, x: number, side: number, index: number }[]}
 */
export const ARRIVALS = WAVES.flatMap(({ at, type, path, x, side = 1, count = 1, gap = 0, step = 0 }) => {
    return Array.from({ length: count }, (_, index) => ({
        at: at + index * gap,
        type: ENEMIES[type],
        path,
        // a wave with no x comes in from off the side it is heading away from
        x: x === undefined ? (side > 0 ? -10 : WIDTH + 10) : x + index * step,
        side,
        index
    }));
}).sort((a, b) => a.at - b.at);

// The airship: its size, and where its three turrets are along it
export const BOSS = {
    hp: 260,
    score: 10000,
    halfWidth: 58,
    halfHeight: 15,
    turrets: [-34, -4, 26]
};

/**
 * @typedef {object} Boss
 * @property {number} x - Its position.
 * @property {number} y - Its position.
 * @property {number} age - The seconds since it arrived.
 * @property {number} cooldown - The seconds until its next attack.
 * @property {number} attack - How many attacks it has made.
 * @property {number} burst - The shots left of a burst of fast shots.
 * @property {number} burstTimer - The seconds until the next shot of the burst.
 */

/**
 * Flies the airship down to the top of the screen, then to and fro there, cycling its attacks.
 *
 * @param {Boss} boss - The airship.
 * @param {number} dt - The time step.
 * @param {World} world - The game.
 */
export const updateBoss = (boss, dt, world) => {
    const rate = pace(world);
    const station = HEIGHT - 58;
    boss.age += dt;

    if (boss.y > station) {
        boss.y = Math.max(station, boss.y - 24 * dt);
        boss.x = WIDTH / 2;
        boss.age = 0;
        return;
    }
    boss.x = WIDTH / 2 + Math.sin(boss.age * 0.55) * 30;

    // a burst of fast shots at the player, from the outer turrets in turn
    boss.burstTimer -= dt;
    if (boss.burst > 0 && boss.burstTimer < 0) {
        boss.burstTimer = 0.16;
        const turret = BOSS.turrets[boss.burst % 2 ? 0 : 2];
        const [vx, vy] = aim(boss.x + turret, boss.y - 12, world, 120 * rate);
        world.needle(boss.x + turret, boss.y - 12, vx, vy);
        boss.burst--;
    }

    boss.cooldown -= dt;
    if (boss.cooldown > 0) return;

    switch (boss.attack++ % 3) {
        case 0:
            // a fan from each turret
            for (const turret of BOSS.turrets) {
                for (let i = -2; i <= 2; i++) {
                    world.orb(boss.x + turret, boss.y - 12, i * 20 * rate, -66 * rate);
                }
            }
            boss.cooldown = 1.7 / rate;
            break;
        case 1:
            // a ring, turned a little each time
            for (let i = 0; i < 18; i++) {
                const angle = (i / 18) * Math.PI * 2 + boss.age;
                world.orb(boss.x, boss.y - 4, Math.cos(angle) * 62 * rate, Math.sin(angle) * 62 * rate);
            }
            boss.cooldown = 1.9 / rate;
            break;
        default:
            boss.burst = 6;
            boss.burstTimer = 0;
            boss.cooldown = 2.4 / rate;
    }
};
