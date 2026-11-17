// The heads up display of the Splash One demo, built from the engine's element components.
//
// Every shape on it - the radar, the target boxes, the lock brackets, the arrows - is drawn into a small
// white texture when the display is created, and tinted by the element color, so the whole display
// needs no image assets and stays crisp at any resolution.

import {
    ADDRESS_CLAMP_TO_EDGE,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    Entity,
    FILTER_LINEAR,
    PIXELFORMAT_RGBA8,
    SCALEMODE_BLEND,
    Texture,
    Vec2,
    Vec3,
    Vec4,
    math
} from 'playcanvas';

/**
 * @import { AppBase, Asset, CameraComponent, GraphicsDevice } from 'playcanvas'
 */

export const HUD_GREEN = new Color(0.55, 1, 0.62);
export const HUD_RED = new Color(1, 0.26, 0.2);
export const HUD_AMBER = new Color(1, 0.72, 0.28);
export const HUD_WHITE = new Color(1, 1, 1);

// the enemy missiles on the radar, and where they were launched from - a color of their own, so they
// do not read as aircraft
export const HUD_MISSILE = new Color(1, 0.36, 1);

const DIM_GREEN = new Color(0.55, 1, 0.62, 0.35);
const OUTLINE = new Color(0, 0, 0, 0.75);

// the radar - how far it sees, and how big it is drawn
export const RADAR_RANGE = 7000;
const RADAR_RADIUS = 92;

const MAX_MARKERS = 40;
const MAX_THREATS = 10;

// scratch for the radar position of a contact
const _radar = new Vec2();
const MAX_BLIPS = 64;

/**
 * Draws a white shape into a texture, from a function returning the coverage of each pixel.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} name - The texture name.
 * @param {number} size - The size in pixels.
 * @param {(x: number, y: number) => number} coverage - Returns the opacity at a point, with both
 * coordinates running from minus one to one, y up.
 * @returns {Texture} The texture.
 */
const createShape = (device, name, size, coverage) => {
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // four samples per pixel, for smooth edges
            let sum = 0;
            for (let s = 0; s < 4; s++) {
                const u = ((x + (s % 2) * 0.5 + 0.25) / size) * 2 - 1;
                const v = 1 - ((y + Math.floor(s / 2) * 0.5 + 0.25) / size) * 2;
                sum += math.clamp(coverage(u, v), 0, 1);
            }
            const alpha = Math.round((sum / 4) * 255);
            const o = (y * size + x) * 4;

            // premultiplied white
            pixels[o] = alpha;
            pixels[o + 1] = alpha;
            pixels[o + 2] = alpha;
            pixels[o + 3] = alpha;
        }
    }
    const texture = new Texture(device, {
        name,
        width: size,
        height: size,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        levels: [pixels]
    });
    texture.upload();
    return texture;
};

/**
 * A line of a given width at a given distance, as coverage.
 *
 * @param {number} distance - The distance from the center of the line.
 * @param {number} width - The width of the line.
 * @param {number} pixel - The size of a pixel, in the same units.
 * @returns {number} The coverage.
 */
const stroke = (distance, width, pixel) => math.clamp((width * 0.5 - Math.abs(distance)) / pixel + 0.5, 0, 1);

/**
 * Generates the shapes the display is drawn with.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {Record<string, Texture>} The textures.
 */
const createShapes = (device) => {
    const px = 2 / 128;
    return {
        ring: createShape(device, 'HudRing', 128, (x, y) => stroke(Math.hypot(x, y) - 0.9, 0.06, px)),
        thickRing: createShape(device, 'HudThickRing', 128, (x, y) => stroke(Math.hypot(x, y) - 0.86, 0.14, px)),
        disc: createShape(device, 'HudDisc', 128, (x, y) => (1 - Math.hypot(x, y)) * 64),
        thinRing: createShape(device, 'HudThinRing', 256, (x, y) => stroke(Math.hypot(x, y) - 0.96, 0.012, 2 / 256)),
        dot: createShape(device, 'HudDot', 32, (x, y) => (1 - Math.hypot(x, y)) * 16),
        diamond: createShape(device, 'HudDiamond', 64, (x, y) =>
            stroke(Math.abs(x) + Math.abs(y) - 0.78, 0.16, 2 / 64)
        ),
        square: createShape(device, 'HudSquare', 64, (x, y) =>
            stroke(Math.max(Math.abs(x), Math.abs(y)) - 0.78, 0.14, 2 / 64)
        ),
        // the outline of a hexagon, marking a ship
        hexagon: createShape(device, 'HudHexagon', 64, (x, y) =>
            stroke(Math.max(Math.abs(x), Math.abs(x) * 0.5 + Math.abs(y) * 0.866) - 0.78, 0.14, 2 / 64)
        ),
        // a hull seen from above, its bow up, the shape of a ship on the radar
        ship: createShape(device, 'HudShip', 64, (x, y) => {
            const half = 0.26 * Math.min(1, (0.95 - y) / 0.6);
            return Math.min(half - Math.abs(x), y + 0.9) * 32;
        }),
        bracket: createShape(device, 'HudBracket', 128, (x, y) => {
            // four corners of a square, with the middle of each side left open
            const edge = stroke(Math.max(Math.abs(x), Math.abs(y)) - 0.9, 0.07, px);
            const corner = Math.min(Math.abs(x), Math.abs(y)) > 0.45 ? 1 : 0;
            return edge * corner;
        }),
        arrow: createShape(device, 'HudArrow', 64, (x, y) => {
            // a chevron pointing up, its apex at the top
            return stroke(y + Math.abs(x) * 1.1 - 0.5, 0.28, 2 / 64) * (y > -0.6 ? 1 : 0);
        }),
        triangle: createShape(device, 'HudTriangle', 32, (x, y) => {
            // a filled triangle pointing up, the shape of an aircraft on the radar
            const inside = Math.min(y + 0.75, 0.406 * (0.85 - y) - Math.abs(x));
            return inside * 16;
        }),
        cross: createShape(device, 'HudCross', 64, (x, y) => {
            const arm = Math.max(stroke(x, 0.1, 2 / 64), stroke(y, 0.1, 2 / 64));
            const r = Math.hypot(x, y);
            return arm * (r > 0.3 && r < 0.9 ? 1 : 0);
        }),
        radar: createShape(device, 'HudRadar', 256, (x, y) => {
            const r = Math.hypot(x, y);
            if (r > 1) {
                return 0;
            }
            const p = 2 / 256;
            const rings = Math.max(
                stroke(r - 0.995, 0.012, p) * 1.5,
                stroke(r - 0.66, 0.008, p),
                stroke(r - 0.33, 0.008, p)
            );
            const axes = Math.max(stroke(x, 0.006, p), stroke(y, 0.006, p)) * 0.6;
            // the field of view wedge, faintly brighter ahead
            const ahead = y > 0 && Math.abs(x) < y * 0.62 ? 0.08 : 0;
            return Math.max(rings, axes, 0.32 * (1 - r * 0.4) + ahead);
        }),
        bar: createShape(device, 'HudBar', 8, () => 1)
    };
};

/**
 * The heads up display.
 */
export class Hud {
    /**
     * @param {AppBase} app - The application.
     * @param {Asset} font - The font asset.
     */
    constructor(app, font) {
        this.app = app;
        this.font = font;
        this.shapes = createShapes(app.graphicsDevice);

        this.screen = new Entity('Hud');
        this.screen.addComponent('screen', {
            referenceResolution: new Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(this.screen);

        /** @type {Map<Entity, string>} */
        this._texts = new Map();

        const CENTER = new Vec4(0.5, 0.5, 0.5, 0.5);
        const TOP = new Vec4(0.5, 1, 0.5, 1);
        const ORIGIN = new Vec4(0, 0, 0, 0);
        const BOTTOM_RIGHT = new Vec4(1, 0, 1, 0);

        // the full screen washes, for being hit and for the end of a mission
        this.damageFlash = this._image(
            new Vec4(0, 0, 1, 1),
            0,
            0,
            0,
            0,
            this.shapes.bar,
            new Color(0.8, 0.05, 0.02),
            0
        );
        this.damageFlash.element.margin = new Vec4(0, 0, 0, 0);
        this.scrim = this._image(new Vec4(0, 0, 1, 1), 0, 0, 0, 0, this.shapes.bar, new Color(0, 0, 0), 0);
        this.scrim.element.margin = new Vec4(0, 0, 0, 0);

        // the markers projected over the world, positioned in pixels from the bottom left corner
        this.world = new Entity('HudWorld');
        this.world.addComponent('element', {
            anchor: ORIGIN,
            pivot: new Vec2(0, 0),
            width: 0,
            height: 0
        });
        this.screen.addChild(this.world);

        this.lockCircle = this._image(ORIGIN, 0, 0, 100, 100, this.shapes.thinRing, DIM_GREEN, 0.5, this.world);
        this.boresight = this._image(ORIGIN, 0, 0, 30, 30, this.shapes.cross, HUD_GREEN, 0.9, this.world);
        this.velocityMarker = this._image(ORIGIN, 0, 0, 14, 14, this.shapes.ring, HUD_GREEN, 0.8, this.world);
        this.aimMarker = this._image(ORIGIN, 0, 0, 30, 30, this.shapes.ring, HUD_WHITE, 0.85, this.world);

        this.markers = [];
        for (let i = 0; i < MAX_MARKERS; i++) {
            const marker = this._image(ORIGIN, 0, 0, 22, 22, this.shapes.diamond, HUD_RED, 1, this.world);
            marker.enabled = false;
            this.markers.push(marker);
        }

        // the enemy missiles in the air, marked wherever they are in view
        this.missileMarkers = [];
        for (let i = 0; i < 8; i++) {
            const marker = this._image(ORIGIN, 0, 0, 18, 18, this.shapes.ring, HUD_RED, 1, this.world);
            marker.enabled = false;
            this.missileMarkers.push(marker);
        }

        this.killMarkers = [];
        for (let i = 0; i < 6; i++) {
            const marker = this._image(ORIGIN, 0, 0, 30, 30, this.shapes.cross, HUD_RED, 1, this.world);
            marker.setLocalEulerAngles(0, 0, 45);
            marker.enabled = false;
            this.killMarkers.push(marker);
        }

        this.bracket = this._image(ORIGIN, 0, 0, 64, 64, this.shapes.bracket, HUD_RED, 1, this.world);
        this.bracketLabel = this._text(ORIGIN, new Vec2(0.5, 0), 0, 0, 15, 0, this.world);
        this.bracketRange = this._text(ORIGIN, new Vec2(0.5, 1), 0, 0, 14, 0, this.world);
        this.offscreenArrow = this._image(ORIGIN, 0, 0, 40, 40, this.shapes.arrow, HUD_RED, 1, this.world);

        // the threats - incoming missiles and the enemies that can fire on the player - pointed out
        // at the edge of the screen while out of view, each with its time to impact or its distance
        this.threatArrows = [];
        this.threatLabels = [];
        for (let i = 0; i < MAX_THREATS; i++) {
            const arrow = this._image(ORIGIN, 0, 0, 30, 30, this.shapes.triangle, HUD_RED, 1, this.world);
            arrow.enabled = false;
            this.threatArrows.push(arrow);
            const label = this._text(ORIGIN, new Vec2(0.5, 0.5), 0, 0, 13, 0, this.world);
            label.enabled = false;
            this.threatLabels.push(label);
        }

        // flight readouts either side of the boresight
        this.speedLabel = this._text(CENTER, new Vec2(1, 0.5), -300, 22, 12, 0.25);
        this.speedText = this._text(CENTER, new Vec2(1, 0.5), -300, 0, 26);
        this.altLabel = this._text(CENTER, new Vec2(0, 0.5), 300, 22, 12, 0.25);
        this.altText = this._text(CENTER, new Vec2(0, 0.5), 300, 0, 26);
        this.gText = this._text(CENTER, new Vec2(1, 0.5), -300, -24, 13);
        this.throttleText = this._text(CENTER, new Vec2(0, 0.5), 300, -24, 13);
        this.setText(this.speedLabel, 'SPEED');
        this.setText(this.altLabel, 'ALTITUDE');
        this.speedLabel.element.opacity = 0.6;
        this.altLabel.element.opacity = 0.6;

        // The radar in the bottom right corner, and the weapons and the airframe in the bottom left,
        // clear of the jet in the middle of the frame. The left block sits high enough to leave the
        // corner to the frame counter the examples browser shows there.
        this.radarCenter = new Vec2(-RADAR_RADIUS - 34, RADAR_RADIUS + 34);
        const { x: rx, y: ry } = this.radarCenter;

        // a dark backing, so the contacts read against a bright sky or glittering water
        this.radarBack = this._image(
            BOTTOM_RIGHT,
            rx,
            ry,
            RADAR_RADIUS * 2,
            RADAR_RADIUS * 2,
            this.shapes.disc,
            new Color(0, 0.02, 0.01),
            0.5
        );
        this.radar = this._image(
            BOTTOM_RIGHT,
            rx,
            ry,
            RADAR_RADIUS * 2,
            RADAR_RADIUS * 2,
            this.shapes.radar,
            HUD_GREEN,
            0.55
        );
        this.radarPlayer = this._image(BOTTOM_RIGHT, rx, ry, 14, 16, this.shapes.triangle, HUD_WHITE, 1);
        // the expanding rings that call out a missile launch on the radar
        this.pings = [];
        for (let i = 0; i < 6; i++) {
            const ping = this._image(BOTTOM_RIGHT, 0, 0, 10, 10, this.shapes.thickRing, HUD_MISSILE, 1);
            ping.enabled = false;
            this.pings.push(ping);
        }

        this.blips = [];
        for (let i = 0; i < MAX_BLIPS; i++) {
            const blip = this._image(BOTTOM_RIGHT, 0, 0, 10, 10, this.shapes.triangle, HUD_RED, 1);
            blip.enabled = false;
            this.blips.push(blip);
        }
        // a ring around the active target - white is kept for the player's own jet alone
        this.radarLock = this._image(BOTTOM_RIGHT, 0, 0, 22, 22, this.shapes.thickRing, HUD_RED, 1);
        this.radarLock.enabled = false;
        this.radarRange = this._text(BOTTOM_RIGHT, new Vec2(0.5, 0), rx, ry + RADAR_RADIUS + 6, 11, 0.25);
        this.radarRange.element.opacity = 0.6;
        this.setText(this.radarRange, `RADAR ${RADAR_RANGE / 1000} KM`);

        const BOTTOM_LEFT = new Vec4(0, 0, 0, 0);
        const left = new Vec2(0, 0);
        this.weaponsLabel = this._text(BOTTOM_LEFT, left, 36, 196, 12, 0.25);
        this.missileText = this._text(BOTTOM_LEFT, left, 36, 162, 30);
        this.flareText = this._text(BOTTOM_LEFT, left, 36, 136, 15);
        this.defenseText = this._text(BOTTOM_LEFT, left, 36, 226, 13);
        this.hullLabel = this._text(BOTTOM_LEFT, left, 36, 108, 12, 0.25);
        this.hullBack = this._image(BOTTOM_LEFT, 36 + 80, 98, 160, 6, this.shapes.bar, HUD_GREEN, 0.2);
        this.hullFill = this._image(BOTTOM_LEFT, 36, 98, 160, 6, this.shapes.bar, HUD_GREEN, 0.9);
        this.hullFill.element.pivot = new Vec2(0, 0.5);
        this.setText(this.weaponsLabel, 'MISSILES');
        this.setText(this.hullLabel, 'HULL');
        this.weaponsLabel.element.opacity = 0.6;
        this.hullLabel.element.opacity = 0.6;

        // the state of the mission along the top - what is left to destroy, and a bar filling up
        // towards the end of the mission
        // a counter for each class of target the mission has, then the score and the time, spaced out
        // from the middle by however many there are
        this.counters = [0, 1, 2, 3].map(() => this._text(TOP, new Vec2(0.5, 1), 0, -18, 15, 0.25));
        this.counterCount = -1;
        this.scoreText = this._text(TOP, new Vec2(0.5, 1), 90, -18, 15, 0.25);
        this.timeText = this._text(TOP, new Vec2(0.5, 1), 270, -18, 15, 0.25);
        this.progressBack = this._image(TOP, 0, -46, 600, 4, this.shapes.bar, HUD_GREEN, 0.18);
        this.progressFill = this._image(TOP, -300, -46, 600, 4, this.shapes.bar, HUD_GREEN, 0.9);
        this.progressFill.element.pivot = new Vec2(0, 0.5);

        this._createBriefing(CENTER);
        this._createDebrief(CENTER);

        // calls out events near the top, warnings in the middle, and the mission state on a banner
        this.messageText = this._text(TOP, new Vec2(0.5, 1), 0, -92, 22, 0.5);
        this.subMessageText = this._text(TOP, new Vec2(0.5, 1), 0, -122, 15, 0.25);
        this.warningText = this._text(CENTER, new Vec2(0.5, 0.5), 0, 175, 24, 0.75);
        this.warningText.element.color = HUD_RED;
        this.hintText = this._text(CENTER, new Vec2(0.5, 0.5), 0, -290, 16);

        this.messageClock = -1;
        this.messageDuration = 0;
        this.flash = 0;
        this.bracketSpin = 0;
    }

    /**
     * Builds the briefing shown before each mission - what it takes to win, what the jet carries,
     * how to fly it, and the button that starts it.
     *
     * @param {Vec4} center - The anchor at the middle of a parent.
     * @private
     */
    _createBriefing(center) {
        const root = new Entity('Briefing');
        root.addComponent('element', {
            anchor: center,
            pivot: new Vec2(0.5, 0.5),
            width: 720,
            height: 500
        });
        root.setLocalPosition(0, 10, 0);
        this.screen.addChild(root);
        this.briefing = root;

        const left = -330;
        const right = 40;
        const label = (x, y, text) => {
            const entity = this._text(center, new Vec2(0, 0.5), x, y, 12, 0.5, root);
            this.setText(entity, text);
            entity.element.opacity = 0.6;
            return entity;
        };
        const block = (x, y, size, color) => {
            const entity = this._text(center, new Vec2(0, 1), x, y, size, 0, root);
            entity.element.alignment = new Vec2(0, 1);
            entity.element.lineHeight = size + 9;
            entity.element.color = color;
            return entity;
        };

        this.briefingBack = this._image(
            center,
            0,
            0,
            720,
            500,
            this.shapes.bar,
            new Color(0.01, 0.03, 0.025),
            0.8,
            root
        );
        this._image(center, 0, 248, 720, 3, this.shapes.bar, HUD_GREEN, 0.9, root);

        // the name of the game, on a tab standing on the top edge
        const tab = this._image(center, 0, 264, 250, 32, this.shapes.bar, HUD_GREEN, 0.95, root);
        const logo = this._text(center, new Vec2(0.5, 0.5), 0, 0, 17, 0.75, tab);
        this.setText(logo, 'SPLASH ONE');
        logo.element.color = new Color(0.02, 0.06, 0.03);
        logo.element.outlineThickness = 0;

        this.briefingTitle = this._text(center, new Vec2(0.5, 0.5), 0, 205, 38, 0.5, root);
        this.briefingName = this._text(center, new Vec2(0.5, 0.5), 0, 166, 18, 0.25, root);
        this.briefingName.element.color = HUD_WHITE;
        this.briefingConditions = this._text(center, new Vec2(0.5, 0.5), 0, 140, 13, 0.25, root);
        this.briefingConditions.element.opacity = 0.7;
        this._image(center, 0, 116, 640, 1, this.shapes.bar, HUD_GREEN, 0.25, root);

        label(left, 94, 'OBJECTIVES');
        this.briefingObjectives = block(left, 80, 16, HUD_WHITE);
        label(right, 94, 'LOADOUT');
        this.briefingLoadout = block(right, 80, 16, HUD_WHITE);

        // everything below the objectives, moved down when there are more of them than fit
        const below = root.children.length;
        this._image(center, 0, 4, 640, 1, this.shapes.bar, HUD_GREEN, 0.25, root);

        label(left, -16, 'CONTROLS');
        const leftKeys = block(left, -30, 13, HUD_AMBER);
        const leftActions = block(left + 150, -30, 13, HUD_WHITE);
        const rightKeys = block(right, -30, 13, HUD_AMBER);
        const rightActions = block(right + 120, -30, 13, HUD_WHITE);
        this.setText(leftKeys, ['MOUSE', 'LEFT CLICK, SPACE', 'RIGHT CLICK, TAB', 'SHIFT', 'X'].join('\n'));
        this.setText(leftActions, ['Steer', 'Fire a missile', 'Next target', 'Afterburner', 'Air brake'].join('\n'));
        this.setText(rightKeys, ['F', 'C, HOLD', 'W A S D', 'WHEEL', 'ESC'].join('\n'));
        this.setText(
            rightActions,
            ['Flares', 'Look at the target', 'Fly by hand', 'Camera distance', 'Release the mouse'].join('\n')
        );

        // the start button, which also captures the mouse for flying
        const button = this._image(center, 0, -196, 280, 50, this.shapes.bar, HUD_GREEN, 0.95, root);
        button.element.useInput = true;
        button.addComponent('button', {
            imageEntity: button,
            hoverTint: new Color(0.85, 1, 0.88),
            pressedTint: new Color(0.35, 0.75, 0.45)
        });
        const start = this._text(center, new Vec2(0.5, 0.5), 0, 0, 18, 0.25, button);
        this.setText(start, 'START MISSION');
        start.element.color = new Color(0.02, 0.06, 0.03);
        start.element.outlineThickness = 0;
        this.startButton = button;

        const hint = this._text(center, new Vec2(0.5, 0.5), 0, -238, 12, 0.25, root);
        this.setText(hint, 'OR PRESS ENTER · GAMEPAD: START');
        hint.element.opacity = 0.6;

        this.briefingBelow = root.children.slice(below).map((entity) => ({
            entity: /** @type {Entity} */ (entity),
            y: entity.getLocalPosition().y
        }));
        root.enabled = false;
    }

    /**
     * Creates the debrief shown at the end of a mission, in the same style as the briefing - how it
     * went, what was destroyed, how well it was flown and a rating, and a button to go on.
     *
     * @param {Vec4} center - The anchor at the middle of the screen.
     * @private
     */
    _createDebrief(center) {
        const root = new Entity('Debrief');
        root.addComponent('element', {
            anchor: center,
            pivot: new Vec2(0.5, 0.5),
            width: 720,
            height: 500
        });
        root.setLocalPosition(0, 10, 0);
        this.screen.addChild(root);
        this.debrief = root;

        const left = -330;
        const right = 40;
        const label = (x, y, text) => {
            const entity = this._text(center, new Vec2(0, 0.5), x, y, 12, 0.5, root);
            this.setText(entity, text);
            entity.element.opacity = 0.6;
            return entity;
        };
        const row = (x, y, pivotX) => {
            const entity = this._text(center, new Vec2(pivotX, 0.5), x, y, 16, 0.05, root);
            entity.element.color = HUD_WHITE;
            return entity;
        };

        this._image(center, 0, 0, 720, 500, this.shapes.bar, new Color(0.01, 0.03, 0.025), 0.8, root);
        this.debriefAccent = this._image(center, 0, 248, 720, 3, this.shapes.bar, HUD_GREEN, 0.9, root);

        this.debriefTitle = this._text(center, new Vec2(0.5, 0.5), 0, 205, 34, 0.45, root);
        this.debriefName = this._text(center, new Vec2(0.5, 0.5), 0, 166, 18, 0.25, root);
        this.debriefName.element.color = HUD_WHITE;
        this.debriefReason = this._text(center, new Vec2(0.5, 0.5), 0, 140, 13, 0.3, root);
        this._image(center, 0, 116, 640, 1, this.shapes.bar, HUD_GREEN, 0.25, root);

        // what was destroyed, a row for each class of target, and how the mission was flown
        label(left, 94, 'TARGETS');
        label(right, 94, 'PERFORMANCE');
        this.debriefTargets = [];
        this.debriefStats = [];
        for (let i = 0; i < 5; i++) {
            const y = 66 - i * 25;
            this.debriefTargets.push({ name: row(left, y, 0), value: row(-40, y, 1) });
            this.debriefStats.push({ name: row(right, y, 0), value: row(330, y, 1) });
        }
        this._image(center, 0, -70, 640, 1, this.shapes.bar, HUD_GREEN, 0.25, root);

        // the rating, a letter that lands once the score has counted up, and what it means
        this.debriefRating = this._text(center, new Vec2(0.5, 0.5), 0, -108, 54, 0, root);
        this.debriefRatingWord = this._text(center, new Vec2(0.5, 0.5), 0, -146, 13, 0.5, root);

        // the button to go on, which also captures the mouse for flying
        const button = this._image(center, 0, -196, 280, 50, this.shapes.bar, HUD_GREEN, 0.95, root);
        button.element.useInput = true;
        button.addComponent('button', {
            imageEntity: button,
            hoverTint: new Color(0.85, 1, 0.88),
            pressedTint: new Color(0.35, 0.75, 0.45)
        });
        this.debriefButtonText = this._text(center, new Vec2(0.5, 0.5), 0, 0, 18, 0.25, button);
        this.debriefButtonText.element.color = new Color(0.02, 0.06, 0.03);
        this.debriefButtonText.element.outlineThickness = 0;
        this.debriefButton = button;

        const hint = this._text(center, new Vec2(0.5, 0.5), 0, -238, 12, 0.25, root);
        this.setText(hint, 'OR PRESS ENTER · GAMEPAD: START');
        hint.element.opacity = 0.6;

        // every element of the panel with its own opacity, which the panel fades in with - its text has
        // no outline, which would not fade with it, and is not needed over the panel's dark backing
        /** @type {{ element: any, opacity: number }[]} */
        this.debriefFade = [];
        const collect = (/** @type {Entity} */ entity) => {
            if (entity !== root && entity.element) {
                this.debriefFade.push({ element: entity.element, opacity: entity.element.opacity });
                if (entity.element.type === ELEMENTTYPE_TEXT) {
                    entity.element.outlineThickness = 0;
                }
            }
            entity.children.forEach((child) => collect(/** @type {Entity} */ (child)));
        };
        collect(root);
        this.debriefTime = -1;
        /** @type {{ entity: Entity, value: number, format: (n: number) => string }|null} */
        this.debriefCount = null;
        root.enabled = false;
    }

    /**
     * Shows the debrief at the end of a mission.
     *
     * @param {object} debrief - What to show.
     * @param {boolean} debrief.success - Whether the mission was won.
     * @param {string} debrief.title - The headline.
     * @param {string} debrief.name - The name of the operation.
     * @param {string} debrief.reason - Why it ended.
     * @param {{ name: string, value: string, done: boolean }[]} debrief.targets - A row for each class
     * of target.
     * @param {{ name: string, value: string|number, format?: (n: number) => string }[]} debrief.stats - A
     * row for each figure - a number with a format counts up as the panel appears.
     * @param {string} debrief.rating - The rating, a letter.
     * @param {string} debrief.ratingWord - What the rating means.
     * @param {string} debrief.button - What the button says.
     */
    showDebrief({ success, title, name, reason, targets, stats, rating, ratingWord, button }) {
        const color = success ? HUD_GREEN : HUD_RED;
        this.debriefAccent.element.color = color;
        this.debriefTitle.element.color = color;
        this.debriefReason.element.color = color;
        this.setText(this.debriefTitle, title);
        this.setText(this.debriefName, name);
        this.setText(this.debriefReason, reason);
        this.debriefTargets.forEach((entry, i) => {
            const target = targets[i];
            this.setText(entry.name, target ? target.name : '');
            this.setText(entry.value, target ? target.value : '');
            entry.value.element.color = target && target.done ? HUD_GREEN : HUD_WHITE;
        });
        this.debriefCount = null;
        this.debriefStats.forEach((entry, i) => {
            const stat = stats[i];
            this.setText(entry.name, stat ? stat.name : '');
            if (stat && typeof stat.value === 'number' && stat.format) {
                this.debriefCount = { entity: entry.value, value: stat.value, format: stat.format };
                this.setText(entry.value, stat.format(0));
            } else {
                this.setText(entry.value, stat ? `${stat.value}` : '');
            }
        });
        this.setText(this.debriefRating, rating);
        this.setText(this.debriefRatingWord, ratingWord);
        this.debriefRating.element.color = success ? HUD_AMBER : HUD_RED;
        this.debriefRatingWord.element.color = success ? HUD_AMBER : HUD_RED;
        this.setText(this.debriefButtonText, button);

        // any message still showing from the mission would sit over the panel
        this.messageClock = -1;
        this.setText(this.messageText, '');
        this.setText(this.subMessageText, '');
        this.debriefTime = 0;
        this._updateDebrief(0);
        this.debrief.enabled = true;
    }

    /**
     * Hides the debrief.
     */
    hideDebrief() {
        this.debrief.enabled = false;
        this.debriefTime = -1;
    }

    /**
     * Fades the debrief in, sliding up into place, counts its score up, and lands the rating.
     *
     * @param {number} dt - The time step.
     * @private
     */
    _updateDebrief(dt) {
        if (this.debriefTime < 0) {
            return;
        }
        this.debriefTime += dt;
        const t = this.debriefTime;
        const fade = math.smoothstep(0, 0.45, t);
        for (const { element, opacity } of this.debriefFade) {
            element.opacity = opacity * fade;
        }
        this.debrief.setLocalPosition(0, 10 - (1 - fade) * 24, 0);

        const count = this.debriefCount;
        if (count) {
            const progress = math.smoothstep(0.35, 1.5, t);
            this.setText(count.entity, count.format(Math.round(count.value * progress)));
        }

        // the rating lands with a little bounce once the count is done
        const land = math.clamp((t - 1.55) / 0.3, 0, 1);
        const scale = land < 1 ? 1.8 - 0.8 * land * land : 1;
        this.debriefRating.setLocalScale(scale, scale, 1);
        this.debriefRating.element.opacity = land;
        this.debriefRatingWord.element.opacity = math.clamp((t - 1.75) / 0.3, 0, 1);
    }

    /**
     * Shows the briefing for a mission.
     *
     * @param {object} briefing - What to show.
     * @param {string} briefing.title - The mission number.
     * @param {string} briefing.name - The name of the operation.
     * @param {string} briefing.conditions - The time of day and the weather.
     * @param {string} briefing.objectives - What has to be destroyed, one line each.
     * @param {string} briefing.loadout - What the jet carries, one line each.
     */
    showBriefing({ title, name, conditions, objectives, loadout }) {
        this.setText(this.briefingTitle, title);
        this.setText(this.briefingName, name);
        this.setText(this.briefingConditions, conditions);
        this.setText(this.briefingObjectives, objectives);
        this.setText(this.briefingLoadout, loadout);

        // three lines fit above the controls - the panel grows down for each line more, and stays
        // in the middle of the screen
        const lines = Math.max(objectives.split('\n').length, loadout.split('\n').length);
        const extra = Math.max(0, lines - 3) * 25;
        for (const { entity, y } of this.briefingBelow) {
            const p = entity.getLocalPosition();
            entity.setLocalPosition(p.x, y - extra, 0);
        }
        this.briefingBack.element.height = 500 + extra;
        this.briefingBack.setLocalPosition(0, -extra / 2, 0);
        this.briefing.element.height = 500 + extra;
        this.briefing.setLocalPosition(0, 10 + extra / 2, 0);
        this.briefing.enabled = true;
    }

    /**
     * Hides the briefing.
     */
    hideBriefing() {
        this.briefing.enabled = false;
    }

    /**
     * Adds an image element.
     *
     * @param {Vec4} anchor - The anchor.
     * @param {number} x - The x offset.
     * @param {number} y - The y offset.
     * @param {number} width - The width.
     * @param {number} height - The height.
     * @param {Texture} texture - The shape.
     * @param {Color} color - The tint.
     * @param {number} opacity - The opacity.
     * @param {Entity} [parent] - The parent, the screen by default.
     * @returns {Entity} The element entity.
     * @private
     */
    _image(anchor, x, y, width, height, texture, color, opacity, parent = this.screen) {
        const entity = new Entity('HudImage');
        entity.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor,
            pivot: new Vec2(0.5, 0.5),
            width,
            height,
            texture,
            color,
            opacity
        });
        entity.setLocalPosition(x, y, 0);
        parent.addChild(entity);
        return entity;
    }

    /**
     * Adds a text element.
     *
     * @param {Vec4} anchor - The anchor.
     * @param {Vec2} pivot - The pivot.
     * @param {number} x - The x offset.
     * @param {number} y - The y offset.
     * @param {number} size - The font size.
     * @param {number} [letterSpacing] - The space between its letters, as a fraction of the font size,
     * to space it out.
     * @param {Entity} [parent] - The parent, the screen by default.
     * @returns {Entity} The element entity.
     * @private
     */
    _text(anchor, pivot, x, y, size, letterSpacing = 0, parent = this.screen) {
        const entity = new Entity('HudText');
        entity.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor,
            pivot,
            fontAsset: this.font.id,
            fontSize: size,
            letterSpacing,
            text: '',
            color: HUD_GREEN,
            outlineColor: OUTLINE,
            outlineThickness: 0.5
        });
        entity.setLocalPosition(x, y, 0);
        parent.addChild(entity);
        return entity;
    }

    /**
     * Sets the text of an element, only when it has changed, as every change rebuilds its mesh.
     *
     * @param {Entity} entity - The text entity.
     * @param {string} text - The text.
     */
    setText(entity, text) {
        if (this._texts.get(entity) !== text) {
            this._texts.set(entity, text);
            entity.element.text = text;
        }
    }

    /**
     * Calls out an event near the top of the screen.
     *
     * @param {string} text - The message.
     * @param {string} [sub] - A second line.
     * @param {number} [duration] - How long it shows for, in seconds.
     * @param {Color} [color] - Its color.
     */
    message(text, sub = '', duration = 2.2, color = HUD_GREEN) {
        this.setText(this.messageText, text);
        this.setText(this.subMessageText, sub);
        this.messageText.element.color = color;
        this.subMessageText.element.color = color;
        this.messageClock = 0;
        this.messageDuration = duration;
    }

    /**
     * Flashes the screen red, for taking a hit.
     *
     * @param {number} strength - How strong the flash is.
     */
    hit(strength) {
        this.flash = Math.max(this.flash, strength);
    }

    /**
     * The number of display units per CSS pixel. The display is laid out in device pixels divided by
     * the screen scale, while positions projected from the world come in CSS pixels.
     *
     * @returns {number} The number of units.
     */
    get unitsPerPixel() {
        const device = this.app.graphicsDevice;
        const ratio = device.width / Math.max(device.clientRect.width, 1);
        return ratio / (this.screen.screen.scale || 1);
    }

    /**
     * Shows or hides the in flight part of the display.
     *
     * @param {boolean} visible - Whether it is visible.
     */
    setFlightVisible(visible) {
        for (const entity of [
            this.world,
            this.speedLabel,
            this.speedText,
            this.altLabel,
            this.altText,
            this.gText,
            this.throttleText,
            this.radarBack,
            this.radar,
            this.radarPlayer,
            this.radarRange,
            this.weaponsLabel,
            this.missileText,
            this.flareText,
            this.defenseText,
            this.hullLabel,
            this.hullBack,
            this.hullFill,
            ...this.counters,
            this.scoreText,
            this.timeText,
            this.progressBack,
            this.progressFill
        ]) {
            entity.enabled = visible;
        }
        if (!visible) {
            this.blips.forEach((blip) => {
                blip.enabled = false;
            });
            this.radarLock.enabled = false;
        }
    }

    /**
     * Places an element over a point in the world.
     *
     * @param {Entity} entity - The element entity, a child of the world layer.
     * @param {Vec3} screen - The canvas position, as returned by worldToScreen.
     * @param {number} height - The canvas height in pixels.
     */
    place(entity, screen, height) {
        const units = this.unitsPerPixel;
        entity.setLocalPosition(screen.x * units, (height - screen.y) * units, 0);
    }

    /**
     * Advances the timed parts of the display - messages and flashes.
     *
     * @param {number} dt - The time step.
     */
    update(dt) {
        if (this.messageClock >= 0) {
            this.messageClock += dt;
            const left = this.messageDuration - this.messageClock;
            const opacity = math.clamp(left * 2, 0, 1) * math.clamp(this.messageClock * 6, 0, 1);
            this.messageText.element.opacity = opacity;
            this.subMessageText.element.opacity = opacity * 0.85;
            if (left <= 0) {
                this.messageClock = -1;
                this.setText(this.messageText, '');
                this.setText(this.subMessageText, '');
            }
        }

        this.flash = Math.max(0, this.flash - dt * 1.8);
        this.damageFlash.element.opacity = this.flash * 0.45;
        this.damageFlash.enabled = this.flash > 0.001;
        this._updateDebrief(dt);
    }

    /**
     * Sets one of the mission's counters along the top.
     *
     * @param {number} index - The counter.
     * @param {string} text - What it says.
     * @param {boolean} done - Whether its targets are all destroyed, which shows it in white.
     */
    counter(index, text, done) {
        const counter = this.counters[index];
        if (counter) {
            this.setText(counter, text);
            counter.element.color = done ? HUD_WHITE : HUD_GREEN;
        }
    }

    /**
     * Blanks the counters from an index on, and spaces out the ones in use with the score and the time
     * when their number changes.
     *
     * @param {number} count - The number of counters in use.
     */
    hideCounters(count) {
        for (let i = count; i < this.counters.length; i++) {
            this.setText(this.counters[i], '');
        }
        if (count !== this.counterCount) {
            this.counterCount = count;
            const items = [...this.counters.slice(0, count), this.scoreText, this.timeText];
            items.forEach((item, i) => {
                item.setLocalPosition((i - (items.length - 1) / 2) * 180, -18, 0);
            });
        }
    }

    /**
     * Updates a radar blip.
     *
     * @param {number} index - The blip.
     * @param {number} dx - The x offset of the contact from the player, in meters.
     * @param {number} dz - The z offset of the contact from the player, in meters.
     * @param {number} heading - The player heading, in radians.
     * @param {Texture} shape - The shape of the blip.
     * @param {Color} color - The color of the blip.
     * @param {number} size - The size of the blip.
     * @param {number} rotation - The rotation of the blip relative to the player, in degrees.
     * @param {number} [opacity] - The opacity of the blip, for blinking it.
     * @returns {boolean} False if the contact is beyond the radar range.
     */
    blip(index, dx, dz, heading, shape, color, size, rotation, opacity = 1) {
        const blip = this.blips[index];
        if (!blip) {
            return false;
        }

        const clamped = this._radarPosition(dx, dz, heading);
        blip.enabled = true;
        blip.element.texture = shape;
        blip.element.color = color;
        blip.element.opacity = (clamped ? 0.45 : 1) * opacity;
        blip.element.width = size;
        blip.element.height = size;
        blip.setLocalPosition(_radar.x, _radar.y, 0);
        blip.setLocalEulerAngles(0, 0, -rotation);
        return !clamped;
    }

    /**
     * Rings the active target's blip on the radar.
     *
     * @param {number} index - The blip of the active target, or -1 for none.
     * @param {Color} color - The color of the ring.
     */
    lockBlip(index, color) {
        const blip = this.blips[index];
        const ring = this.radarLock;
        ring.enabled = !!blip?.enabled;
        if (ring.enabled) {
            ring.element.color = color;
            ring.setLocalPosition(blip.getLocalPosition());
        }
    }

    /**
     * Shows a launch ping on the radar - two rings expanding out of the launch point.
     *
     * @param {number} index - The ping.
     * @param {number} dx - The x offset of the launch from the player, in meters.
     * @param {number} dz - The z offset of the launch from the player, in meters.
     * @param {number} heading - The player heading, in radians.
     * @param {number} age - How long ago the launch was, in seconds.
     */
    ping(index, dx, dz, heading, age) {
        const ping = this.pings[index];
        if (!ping) {
            return;
        }
        this._radarPosition(dx, dz, heading);
        const t = (age % 0.6) / 0.6;
        const size = 10 + t * 64;
        ping.enabled = age < 1.2;
        ping.element.width = size;
        ping.element.height = size;
        ping.element.opacity = (1 - t) * (age < 0.6 ? 1 : 0.6);
        ping.setLocalPosition(_radar.x, _radar.y, 0);
    }

    /**
     * Hides the pings from an index on.
     *
     * @param {number} from - The first ping to hide.
     */
    hidePings(from) {
        for (let i = from; i < this.pings.length; i++) {
            this.pings[i].enabled = false;
        }
    }

    /**
     * Works out where a contact is drawn on the radar, into a shared vector.
     *
     * @param {number} dx - The x offset of the contact from the player, in meters.
     * @param {number} dz - The z offset of the contact from the player, in meters.
     * @param {number} heading - The player heading, in radians.
     * @returns {boolean} True if the contact is beyond the radar range, and was pulled in to its edge.
     * @private
     */
    _radarPosition(dx, dz, heading) {
        // rotated into the player's frame, so straight ahead is up
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        const right = dx * cos - dz * sin;
        const ahead = -dx * sin - dz * cos;
        let distance = Math.hypot(right, ahead) / RADAR_RANGE;
        const clamped = distance > 1;
        if (clamped) {
            distance = 1;
        }
        const angle = Math.atan2(right, ahead);
        _radar.set(
            this.radarCenter.x + Math.sin(angle) * distance * (RADAR_RADIUS - 6),
            this.radarCenter.y + Math.cos(angle) * distance * (RADAR_RADIUS - 6)
        );
        return clamped;
    }

    /**
     * Hides the blips from an index on.
     *
     * @param {number} from - The first blip to hide.
     */
    hideBlips(from) {
        for (let i = from; i < this.blips.length; i++) {
            this.blips[i].enabled = false;
        }
    }
}

const _screen = new Vec3();

/**
 * Projects a point to the canvas, returning whether it is in front of the camera.
 *
 * @param {CameraComponent} camera - The camera.
 * @param {Vec3} position - The world position.
 * @param {Vec3} out - Receives the canvas position, in pixels from the top left.
 * @returns {boolean} True if the point is in front of the camera.
 */
export const project = (camera, position, out) => {
    camera.worldToScreen(position, out);
    _screen.sub2(position, camera.entity.getPosition());
    return _screen.dot(camera.entity.forward) > 0;
};
