/**
 * Generates the UI kit shared by the User Interface examples:
 *
 * - `assets/ui/ui-atlas.png`, a texture atlas of panels, buttons, controls, icons and avatars.
 * - `assets/ui/ui-atlas.mjs`, the atlas asset data: sRGB texture settings, and a frame with a
 * 9-slice border for each sprite.
 *
 * Each sprite is an SVG drawn at two pixels per screen unit, so sprites made with a
 * `pixelsPerUnit` of 2 are sharp on high density displays. Frames are packed with gutters that
 * repeat their edge pixels, so that filtering and mipmaps never sample a neighbor, and the color
 * of transparent pixels is filled in from their neighbors, so that edges don't darken.
 *
 * Run from the examples folder: `node utils/generate-ui-atlas.mjs`.
 */
import fs from 'node:fs';

import sharp from 'sharp';

const SCALE = 2;
const GUTTER = 4;
const WIDTH = 1024;
const OUT = 'assets/ui';

const WHITE = '#fff';
const FILL = `fill="${WHITE}"`;
const STROKE = `fill="none" stroke="${WHITE}" stroke-linecap="round" stroke-linejoin="round"`;
const ROUNDED = `${FILL} stroke="${WHITE}" stroke-linejoin="round"`;

/**
 * @typedef {object} FrameDef
 * @property {string} name - The frame key.
 * @property {number} w - The width in screen units.
 * @property {number} h - The height in screen units.
 * @property {string} body - The SVG content, in a viewBox of `w` by `h`.
 * @property {number[]} [border] - The 9-slice border in screen units: left, bottom, right, top.
 * @property {boolean} [tint] - Whether the frame is white, to be colored by the element.
 */

/**
 * A frame of the atlas.
 *
 * @param {string} name - The frame key.
 * @param {number} w - The width in screen units.
 * @param {number} h - The height in screen units.
 * @param {string} body - The SVG content.
 * @param {{ border?: number[], tint?: boolean }} [options] - The 9-slice border, and whether
 * the frame is white.
 * @returns {FrameDef} The frame.
 */
const frame = (name, w, h, body, { border, tint } = {}) => ({ name, w, h, body, border, tint });

/**
 * A white icon in a 48 x 48 unit frame.
 *
 * @param {string} name - The frame key, without the `icon-` prefix.
 * @param {string} body - The SVG content.
 * @returns {FrameDef} The frame.
 */
const icon = (name, body) => frame(`icon-${name}`, 48, 48, body, { tint: true });

/**
 * A button face in one of its states, with a darker bevel along its bottom edge.
 *
 * @param {string} name - The frame key.
 * @param {string} top - The color of the top of the face.
 * @param {string} bottom - The color of the bottom of the face.
 * @param {string} bevel - The color of the bevel.
 * @param {number} drop - How far the face is pushed down into the bevel.
 * @returns {FrameDef} The frame.
 */
const button = (name, top, bottom, bevel, drop) => frame(name, 64, 64, `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect y="${drop}" width="64" height="${64 - drop}" rx="14" fill="${bevel}"/>
    <rect y="${drop}" width="64" height="58" rx="14" fill="url(#g)"/>`, { border: [16, 22, 16, 16] });

/**
 * An avatar: a head and shoulders on a colored background.
 *
 * @param {number} index - The avatar number.
 * @param {string} background - The background color.
 * @param {string} figure - The color of the figure.
 * @returns {FrameDef} The frame.
 */
const avatar = (index, background, figure) => frame(`avatar-${index}`, 64, 64, `
    <rect width="64" height="64" fill="${background}"/>
    <circle cx="32" cy="26" r="12" fill="${figure}"/>
    <path d="M10 64 C10 46 20 41 32 41 C44 41 54 46 54 64 Z" fill="${figure}"/>`);

const TEETH = [0, 45, 90, 135, 180, 225, 270, 315]
.map(a => `<rect x="20.5" y="5" width="7" height="10" rx="2" transform="rotate(${a} 24 24)"/>`)
.join('');

/** @type {FrameDef[]} */
const FRAMES = [
    // panels
    frame('panel', 64, 64, `<rect width="64" height="64" rx="16" ${FILL}/>`, {
        border: [16, 16, 16, 16],
        tint: true
    }),
    frame('panel-outline', 64, 64, `<rect x="1.5" y="1.5" width="61" height="61" rx="14.5" ${STROKE}
        stroke-width="3"/>`, { border: [16, 16, 16, 16], tint: true }),
    frame('shadow', 112, 112, `
        <defs><filter id="b" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="7"/></filter></defs>
        <rect x="24" y="24" width="64" height="64" rx="16" fill="#000" fill-opacity="0.55" filter="url(#b)"/>`, {
        border: [40, 40, 40, 40]
    }),
    // a ruled sheet of paper whose middle repeats every 16 units, for tiled sprites
    frame('paper', 64, 64, `
        <rect width="64" height="64" rx="10" fill="#f7f1e3"/>
        <path d="M0 24 H64 M0 40 H64" stroke="#c7d5ea" stroke-width="1.5"/>
        <path d="M11 0 V64" stroke="#e8a9a4" stroke-width="1.5"/>`, { border: [16, 16, 16, 16] }),

    // button states, for sprite change buttons
    button('button', '#4a5a7e', '#3c4968', '#262f44', 0),
    button('button-hover', '#57698f', '#485779', '#2c364d', 0),
    button('button-pressed', '#3a4764', '#333e58', '#222a3b', 4),
    button('button-inactive', '#2f3542', '#2b303c', '#22262e', 0),

    // controls
    frame('track', 32, 16, `<rect width="32" height="16" rx="8" ${FILL}/>`, {
        border: [8, 8, 8, 8],
        tint: true
    }),
    frame('knob', 32, 32, `
        <circle cx="16" cy="17" r="14" fill="#000" fill-opacity="0.3"/>
        <circle cx="16" cy="16" r="13" fill="#f4f6fa"/>
        <circle cx="16" cy="16" r="12.25" fill="none" stroke="#c9cfdb" stroke-width="1.5"/>`),
    frame('checkbox', 32, 32, `<rect x="2" y="2" width="28" height="28" rx="8" ${STROKE} stroke-width="3"/>`, {
        tint: true
    }),
    frame('check', 32, 32, `<path d="M9 16.5 L14 21.5 L23.5 10.5" ${STROKE} stroke-width="4"/>`, { tint: true }),
    frame('radio', 32, 32, `<circle cx="16" cy="16" r="13.5" ${STROKE} stroke-width="3"/>`, { tint: true }),
    frame('radio-dot', 32, 32, `<circle cx="16" cy="16" r="7" ${FILL}/>`, { tint: true }),
    frame('circle', 64, 64, `<circle cx="32" cy="32" r="32" ${FILL}/>`, { tint: true }),

    // icons
    icon('close', `<path d="M14 14 L34 34 M34 14 L14 34" ${STROKE} stroke-width="5"/>`),
    icon('back', `<path d="M29 11 L16 24 L29 37" ${STROKE} stroke-width="5"/>`),
    icon('next', `<path d="M19 11 L32 24 L19 37" ${STROKE} stroke-width="5"/>`),
    icon('down', `<path d="M11 18 H37 L24 33 Z" ${ROUNDED} stroke-width="3"/>`),
    icon('up', `<path d="M11 30 H37 L24 15 Z" ${ROUNDED} stroke-width="3"/>`),
    icon('plus', `<path d="M24 11 V37 M11 24 H37" ${STROKE} stroke-width="5"/>`),
    icon('minus', `<path d="M11 24 H37" ${STROKE} stroke-width="5"/>`),
    icon('info', `
        <circle cx="24" cy="24" r="18" ${STROKE} stroke-width="3.5"/>
        <path d="M24 22 V33" ${STROKE} stroke-width="4"/>
        <circle cx="24" cy="15.5" r="2.6" ${FILL}/>`),
    icon('pause', `
        <rect x="13" y="11" width="8" height="26" rx="2.5" ${FILL}/>
        <rect x="27" y="11" width="8" height="26" rx="2.5" ${FILL}/>`),
    icon('gear', `<g ${FILL}>${TEETH}
        <path fill-rule="evenodd" d="M24 10 A14 14 0 1 1 23.99 10 Z M24 18.5 A5.5 5.5 0 1 0 24.01 18.5 Z"/></g>`),
    icon('star', `<path d="M24 6 L29.3 17.7 L42 19 L32.4 27.6 L35.1 40.2 L24 33.8 L12.9 40.2 L15.6 27.6
        L6 19 L18.7 17.7 Z" ${ROUNDED} stroke-width="2"/>`),
    icon('trophy', `
        <path d="M15 8 H33 V20 A9 9 0 0 1 15 20 Z" ${FILL}/>
        <path d="M15 12 H9 A6 6 0 0 0 15 22 M33 12 H39 A6 6 0 0 1 33 22" ${STROKE} stroke-width="3"/>
        <path d="M21 28 H27 V34 H21 Z M14 36 H34 V41 H14 Z" ${FILL}/>`),
    icon('heart', `<path d="M24 40 C12 31 6 25 6 17.5 C6 12 10 8 15 8 C19 8 22 10.5 24 14 C26 10.5 29 8 33 8
        C38 8 42 12 42 17.5 C42 25 36 31 24 40 Z" ${FILL}/>`),
    icon('coin', `<path fill-rule="evenodd" ${FILL} d="M24 7 A17 17 0 1 1 23.99 7 Z
        M24 10.5 A13.5 13.5 0 1 0 24.01 10.5 Z M24 12.5 A11.5 11.5 0 1 1 23.99 12.5 Z"/>`),
    icon('gem', `<path d="M15 9 H33 L42 19 L24 40 L6 19 Z" ${ROUNDED} stroke-width="2"/>`),
    icon('potion', `<path d="M19 6 H29 V9 H27 V17 C34 19.5 39 25 39 31 C39 38 32 42 24 42 C16 42 9 38 9 31
        C9 25 14 19.5 21 17 V9 H19 Z" ${FILL}/>`),
    icon('sword', `
        <path d="M38 6 L42 10 L22 30 L18 26 Z" ${FILL}/>
        <path d="M13 23 L25 35 M18 30 L9 39" ${STROKE} stroke-width="4.5"/>`),
    icon('shield', `<path d="M24 5 L40 11 V22 C40 32 33 39 24 43 C15 39 8 32 8 22 V11 Z" ${FILL}/>`),
    icon('key', `
        <path fill-rule="evenodd" ${FILL} d="M16 10 A10 10 0 1 1 15.99 10 Z M16 15.5 A4.5 4.5 0 1 0 16.01 15.5 Z"/>
        <path d="M23 27 L40 44 M33 37 L37 33 M29 33 L32 30" ${STROKE} stroke-width="4.5"/>`),
    icon('bolt', `<path d="M27 4 L10 27 H22 L19 44 L38 19 H26 Z" ${ROUNDED} stroke-width="1.5"/>`),
    icon('flame', `<path d="M24 4 C27 12 36 17 36 29 C36 37 31 43 24 43 C17 43 12 37 12 29 C12 22 17 18 19 12
        C21 17 23 19 25 19 C26 14 25 9 24 4 Z" ${FILL}/>`),
    icon('lock', `
        <path d="M15 21 V16 A9 9 0 0 1 33 16 V21" ${STROKE} stroke-width="4.5"/>
        <rect x="10" y="20" width="28" height="22" rx="5" ${FILL}/>`),
    icon('music', `
        <path d="M18 34 V11 L37 7 V30" ${STROKE} stroke-width="4"/>
        <circle cx="13" cy="34" r="6" ${FILL}/><circle cx="32" cy="30" r="6" ${FILL}/>`),
    icon('sound', `
        <path d="M8 19 H15 L25 10 V38 L15 29 H8 Z" ${ROUNDED} stroke-width="2"/>
        <path d="M31 17 A9 9 0 0 1 31 31 M35.5 12 A16 16 0 0 1 35.5 36" ${STROKE} stroke-width="3.5"/>`),
    icon('grip', `<path d="M40 22 L22 40 M40 30 L30 40 M40 38 L38 40" ${STROKE} stroke-width="3.5"/>`),
    icon('pin', `<path fill-rule="evenodd" ${FILL} d="M24 44 C16 33 10 26 10 19 A14 14 0 0 1 38 19
        C38 26 32 33 24 44 Z M24 13 A6 6 0 1 0 24.01 13 Z"/>`),
    icon('chest', `
        <path d="M7 20 A9 9 0 0 1 16 11 H32 A9 9 0 0 1 41 20 V23 H7 Z M7 26 H41 V39 H7 Z" ${FILL}/>
        <rect x="20.5" y="20" width="7" height="10" rx="1.5" ${FILL}/>`),

    // avatars
    avatar(1, '#2f9e8f', '#c8f0e8'),
    avatar(2, '#7b5cc9', '#e2d8fb'),
    avatar(3, '#d9774b', '#fbe1d2'),
    avatar(4, '#3f7fd6', '#d6e6fb')
];

/**
 * Standalone textures, written as `assets/ui/<name>.png`, for images that show a whole texture.
 *
 * @type {FrameDef[]}
 */
const TEXTURES = [
    // a landscape at dusk, for pictures such as a profile's cover
    frame('landscape', 400, 400, `
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2d5a9e"/><stop offset="0.7" stop-color="#f0a86e"/>
            <stop offset="1" stop-color="#f7cf8f"/>
        </linearGradient></defs>
        <rect width="400" height="400" fill="url(#sky)"/>
        <circle cx="275" cy="190" r="44" fill="#ffe3a3"/>
        <path d="M0 250 L70 190 L120 225 L200 150 L280 230 L340 185 L400 225 V400 H0 Z" fill="#6f78a8"/>
        <path d="M0 290 C80 250 150 300 230 265 C300 235 350 275 400 255 V400 H0 Z" fill="#4c5c86"/>
        <path d="M0 330 C90 300 170 345 260 318 C330 298 370 320 400 310 V400 H0 Z" fill="#2e3d5c"/>
        <path d="M0 370 C120 350 250 385 400 360 V400 H0 Z" fill="#1f2a40"/>`),
    // level art of four shapes, for pictures that are fitted to their elements
    frame('level-forest', 320, 180, `
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#7cc4ef"/><stop offset="1" stop-color="#d9f0e0"/>
        </linearGradient></defs>
        <rect width="320" height="180" fill="url(#sky)"/>
        <circle cx="250" cy="45" r="20" fill="#fff6c8"/>
        <path d="M0 110 C60 85 120 100 170 90 C230 78 280 95 320 88 V180 H0 Z" fill="#8fc17a"/>
        <path d="M0 135 C70 115 140 135 210 122 C260 113 300 125 320 120 V180 H0 Z" fill="#5f9e5a"/>
        <path d="M60 128 L72 96 L84 128 Z M90 134 L100 108 L110 134 Z M230 124 L243 92 L256 124 Z
            M262 130 L272 106 L282 130 Z" fill="#2f5e38"/>
        <path d="M0 160 C80 148 170 165 320 150 V180 H0 Z" fill="#3f7a45"/>`),
    frame('level-crypt', 180, 240, `
        <defs><linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1c1f33"/><stop offset="1" stop-color="#3a3553"/>
        </linearGradient></defs>
        <rect width="180" height="240" fill="url(#dark)"/>
        <path d="M20 240 V110 C20 60 60 35 90 35 C120 35 160 60 160 110 V240 Z" fill="#5b5877"/>
        <path d="M50 240 V120 C50 90 68 72 90 72 C112 72 130 90 130 120 V240 Z" fill="#f29a4a"/>
        <path d="M62 240 V128 C62 104 75 90 90 90 C105 90 118 104 118 128 V240 Z" fill="#ffd08a"/>
        <rect x="45" y="205" width="90" height="15" fill="#55526f"/>
        <rect x="30" y="220" width="120" height="20" fill="#4a4766"/>`),
    frame('level-desert', 360, 180, `
        <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f28b54"/><stop offset="1" stop-color="#fbd38d"/>
        </linearGradient></defs>
        <rect width="360" height="180" fill="url(#dusk)"/>
        <circle cx="90" cy="70" r="30" fill="#fff1c4"/>
        <path d="M200 120 L250 60 L300 120 Z" fill="#c9824a"/>
        <path d="M250 60 L300 120 H270 Z" fill="#a8683a"/>
        <path d="M0 125 C80 105 160 130 240 115 C300 104 340 118 360 112 V180 H0 Z" fill="#e8b36b"/>
        <path d="M0 150 C100 135 200 160 360 140 V180 H0 Z" fill="#d49a55"/>`),
    frame('level-peak', 240, 240, `
        <defs><linearGradient id="cold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9fc3e8"/><stop offset="1" stop-color="#e6eef7"/>
        </linearGradient></defs>
        <rect width="240" height="240" fill="url(#cold)"/>
        <path d="M0 190 L70 110 L100 140 L150 60 L240 175 V240 H0 Z" fill="#7d8aa6"/>
        <path d="M150 60 L125 100 L140 95 L150 108 L162 94 L178 96 Z" fill="#fff"/>
        <path d="M70 110 L58 124 L70 120 L80 128 Z" fill="#fff"/>
        <path d="M0 205 C60 195 120 210 240 198 V240 H0 Z" fill="#4f6b8c"/>`),
    // a map of the world the levels are in, for showing part of a texture: an island with a
    // landmark for each level, the paths between them, and a compass. The levels are at the
    // mountain's summit, the pyramid's tip, the tallest pine and the top of the crypt's arch.
    frame('world-map', 400, 300, `
        <rect width="400" height="300" fill="#2e5d8a"/>
        <path d="M18 26 q4 -4 8 0 q4 4 8 0 M52 40 q4 -4 8 0 q4 4 8 0 M232 18 q4 -4 8 0 q4 4 8 0
            M300 28 q4 -4 8 0 q4 4 8 0 M372 50 q4 -4 8 0 q4 4 8 0 M378 124 q4 -4 8 0 q4 4 8 0
            M380 196 q4 -4 8 0 q4 4 8 0 M302 284 q4 -4 8 0 q4 4 8 0 M222 286 q4 -4 8 0 q4 4 8 0
            M98 280 q4 -4 8 0 q4 4 8 0 M16 120 q4 -4 8 0 q4 4 8 0 M22 206 q4 -4 8 0 q4 4 8 0" fill="none"
            stroke="#4d7fae" stroke-width="2" stroke-linecap="round"/>
        <defs><path id="land" d="M40 152 C41 140 44 125 50 114 C56 103 64 92 74 84 C84 76 96 69 108 64
            C120 59 135 55 148 54 C161 53 173 61 184 60 C195 59 202 50 214 48 C226 46 241 47 254 48
            C267 49 282 52 294 56 C306 60 318 66 328 74 C338 82 346 92 352 102 C358 112 361 124 362 136
            C363 148 361 160 358 172 C355 184 350 196 344 206 C338 216 329 226 320 234 C311 242 299 248 288 252
            C277 256 263 260 252 260 C241 260 232 253 222 254 C212 255 205 263 194 264 C183 265 170 264 158 262
            C146 260 132 256 120 252 C108 248 96 243 86 236 C76 229 67 221 60 212 C53 203 47 194 44 184
            C41 174 39 164 40 152 Z M352 262 C354 258 361 251 366 250 C371 249 379 252 382 256
            C385 260 386 268 384 272 C382 276 373 280 368 280 C363 280 357 277 354 274 C351 271 350 266 352 262 Z"/>
        </defs>
        <use href="#land" fill="none" stroke="#3b6e9c" stroke-width="16" stroke-linejoin="round"/>
        <use href="#land" fill="#ddcd9c" stroke="#b39c66" stroke-width="2.5"/>
        <path d="M178 146 C181 141 189 137 196 136 C203 135 214 137 220 140 C226 143 230 151 230 156
            C230 161 224 169 218 172 C212 175 201 175 194 174 C187 173 181 169 178 164 C175 159 175 151 178 146 Z"
            fill="#4a7fae" stroke="#3b6e9c" stroke-width="2"/>
        <path d="M110 180 C104 162 108 146 116 134 M158 120 C192 130 228 128 258 116 M292 120 C306 148 306 178 292 204
            M262 238 C222 252 172 250 134 234" fill="none" stroke="#9c7f52" stroke-width="2.4"
            stroke-dasharray="5 5" stroke-linecap="round"/>
        <ellipse cx="106" cy="214" rx="40" ry="26" fill="#7aae64"/>
        <path d="M100 222 L108 189 L116 222 Z M82 226 L90 204 L98 226 Z M118 230 L126 206 L134 230 Z
            M90 240 L97 220 L104 240 Z M110 242 L117 222 L124 242 Z" fill="#2f6b3c"/>
        <path d="M78 130 L101 102 L122 130 Z M140 130 L158 106 L178 130 Z" fill="#7f899e"/>
        <path d="M94 130 L120 90 L148 130 Z" fill="#949eb2"/>
        <path d="M120 90 L111 104 L116 101 L121 106 L126 101 L131 105 Z M158 106 L152 114 L158 112 L163 115 Z"
            fill="#f4f6fa"/>
        <ellipse cx="282" cy="112" rx="46" ry="20" fill="#eab86e"/>
        <path d="M244 124 q12 -7 24 0 M290 126 q14 -8 28 0" fill="none" stroke="#cf9450" stroke-width="2.4"
            stroke-linecap="round"/>
        <path d="M262 114 L280 90 L298 114 Z" fill="#c9824a"/>
        <path d="M280 90 L298 114 H287 Z" fill="#a5663a"/>
        <ellipse cx="286" cy="232" rx="40" ry="18" fill="#6c6a86"/>
        <path d="M270 240 V222 C270 214 276 210 284 210 C292 210 298 214 298 222 V240 Z" fill="#4c4966"/>
        <path d="M277 240 V226 C277 221 280 218 284 218 C288 218 291 221 291 226 V240 Z" fill="#f29a4a"/>
        <path d="M306 236 V229 A4 4 0 0 1 314 229 V236 Z M254 238 V232 A3.5 3.5 0 0 1 261 232 V238 Z"
            fill="#8d8aa6"/>
        <path d="M36 242 L41 262 L36 282 L31 262 Z" fill="#e9dcb4"/>
        <path d="M36 242 L41 262 H31 Z" fill="#f29a4a"/>
        <path d="M16 262 L36 258 L56 262 L36 266 Z" fill="#c9bb8c"/>`),
    // the background of XrMenu buttons, stretched to each button
    frame('menu-button', 170, 54, `
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9ccfff"/><stop offset="1" stop-color="#78b6f2"/>
        </linearGradient></defs>
        <rect width="170" height="54" rx="14" fill="url(#g)"/>
        <rect x="3" y="3" width="164" height="48" rx="11" fill="none" stroke="#e3f1ff" stroke-width="2"/>`)
];

/**
 * Fill in the color of transparent pixels, so that filtering blends the edge of a shape with its
 * own color rather than black.
 *
 * @param {Buffer} data - RGBA pixels.
 * @param {number} w - The width in pixels.
 * @param {number} h - The height in pixels.
 * @param {boolean} tint - Whether the frame is white, in which case every pixel becomes white.
 */
const bleed = (data, w, h, tint) => {
    if (tint) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i + 1] = data[i + 2] = 255;
        }
        return;
    }

    // colored frames: grow the colors outwards into the transparent pixels, a pixel per pass
    const known = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        known[i] = data[i * 4 + 3] > 0 ? 1 : 0;
    }
    for (let pass = 0; pass < 8; pass++) {
        const next = known.slice();
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (known[y * w + x]) {
                    continue;
                }
                const sum = [0, 0, 0];
                let count = 0;
                for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                    if (nx >= 0 && ny >= 0 && nx < w && ny < h && known[ny * w + nx]) {
                        const j = (ny * w + nx) * 4;
                        sum[0] += data[j];
                        sum[1] += data[j + 1];
                        sum[2] += data[j + 2];
                        count++;
                    }
                }
                if (count) {
                    const i = (y * w + x) * 4;
                    for (let c = 0; c < 3; c++) {
                        data[i + c] = Math.round(sum[c] / count);
                    }
                    next[y * w + x] = 1;
                }
            }
        }
        known.set(next);
    }
};

/**
 * Rasterize a frame to RGBA pixels at two pixels per screen unit.
 *
 * @param {FrameDef} def - The frame.
 * @returns {Promise<{ def: FrameDef, w: number, h: number, data: Buffer, x: number, y: number }>}
 * The pixels, with a place in the atlas to be filled in.
 */
const rasterize = async (def) => {
    const w = def.w * SCALE;
    const h = def.h * SCALE;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
        viewBox="0 0 ${def.w} ${def.h}">${def.body}</svg>`;
    const data = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    bleed(data, w, h, !!def.tint);
    return { def, w, h, data, x: 0, y: 0 };
};

// lossless: sharp's effort option would quantize to a palette
const PNG = { compressionLevel: 9, adaptiveFiltering: true, palette: false };
fs.mkdirSync(OUT, { recursive: true });

await Promise.all(TEXTURES.map(async (def) => {
    const { w, h, data } = await rasterize(def);
    await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png(PNG).toFile(`${OUT}/${def.name}.png`);
}));

const frames = await Promise.all(FRAMES.map(rasterize));

// pack them in shelves, tallest first
const packed = frames.slice().sort((a, b) => b.h - a.h || a.def.name.localeCompare(b.def.name));
let x = GUTTER;
let y = GUTTER;
let shelf = 0;
for (const f of packed) {
    if (x + f.w + GUTTER > WIDTH) {
        x = GUTTER;
        y += shelf + GUTTER * 2;
        shelf = 0;
    }
    f.x = x;
    f.y = y;
    x += f.w + GUTTER * 2;
    shelf = Math.max(shelf, f.h);
}
const height = 2 ** Math.ceil(Math.log2(y + shelf + GUTTER));

// copy each frame into the atlas, repeating its edge pixels into the gutter around it
const atlas = Buffer.alloc(WIDTH * height * 4);
for (const f of packed) {
    for (let ay = f.y - GUTTER; ay < f.y + f.h + GUTTER; ay++) {
        const sy = Math.min(Math.max(ay - f.y, 0), f.h - 1);
        for (let ax = f.x - GUTTER; ax < f.x + f.w + GUTTER; ax++) {
            const sx = Math.min(Math.max(ax - f.x, 0), f.w - 1);
            const src = (sy * f.w + sx) * 4;
            f.data.copy(atlas, (ay * WIDTH + ax) * 4, src, src + 4);
        }
    }
}

await sharp(atlas, { raw: { width: WIDTH, height, channels: 4 } }).png(PNG).toFile(`${OUT}/ui-atlas.png`);

// frame rects are measured in pixels from the bottom-left corner of the texture
const entries = frames.map(({ def, x: fx, y: fy, w, h }) => {
    const rect = [fx, height - fy - h, w, h].join(', ');
    const border = (def.border ?? [0, 0, 0, 0]).map(v => v * SCALE).join(', ');
    return `        '${def.name}': { rect: [${rect}], pivot: [0.5, 0.5], border: [${border}] }`;
});

fs.writeFileSync(`${OUT}/ui-atlas.mjs`, `// Generated by examples/utils/generate-ui-atlas.mjs. Don't edit by hand.

/**
 * Asset data for the UI kit texture atlas, \`ui-atlas.png\`. Frames are drawn at 2 pixels per
 * screen unit, so create their sprites with a \`pixelsPerUnit\` of 2.
 *
 * @example
 * const ui = new Asset('ui', 'textureatlas', { url: './assets/ui/ui-atlas.png' }, uiAtlasData);
 */
export const uiAtlasData = {
    srgb: true,
    mipmaps: true,
    minfilter: 'linear_mip_linear',
    magfilter: 'linear',
    frames: {
${entries.join(',\n')}
    }
};
`);

console.log(`ui-atlas: ${frames.length} frames, ${WIDTH}x${height}`);
