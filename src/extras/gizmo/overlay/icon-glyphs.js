/**
 * The glyph of an icon, named for the component it marks.
 *
 * @typedef {'camera' | 'light' | 'audiolistener' | 'sound' | 'particlesystem'} OverlayIcon
 */

/**
 * A stroke or fill of an icon glyph, in CSS pixels:
 * - `['line', x0, y0, x1, y1, ...]` - A polyline through the points.
 * - `['arc', x, y, radius, from, to, segments]` - An arc as straight segments, the angles in
 * radians from the x axis towards the y axis.
 * - `['disc', x, y, radius]` - A filled disc.
 * - `['triangle', apex, base, height]` - A filled triangle on the x axis, from its apex at x =
 * apex widening to its side, height tall, at x = base.
 *
 * @typedef {['line', ...number[]] | ['arc', number, number, number, number, number, number] |
 * ['disc', number, number, number] | ['triangle', number, number, number]} IconStroke
 */

/**
 * The glyphs of the icons, in CSS pixels from the icon center, x to the right and y up the screen.
 *
 * @type {Record<OverlayIcon, IconStroke[]>}
 */
const ICON_GLYPHS = {

    // a sun, a dot with eight spokes
    light: [
        ['disc', 0, 0, 4.5],
        ...Array.from({ length: 8 }, (_, i) => {
            const x = Math.cos(i * Math.PI / 4);
            const y = Math.sin(i * Math.PI / 4);
            return /** @type {IconStroke} */ (['line', 7.5 * x, 7.5 * y, 10.5 * x, 10.5 * y]);
        })
    ],

    // an outlined body with a lens widening to the right
    camera: [
        ['line', -8, -5, 3, -5, 3, 5, -8, 5, -8, -5],
        ['triangle', 4, 9, 8]
    ],

    // a microphone, its rounded head held in a cradle on a stand
    audiolistener: [
        ['line', -3, 1, -3, 5],
        ['line', 3, 1, 3, 5],
        ['arc', 0, 5, 3, 0, Math.PI, 6],
        ['arc', 0, 1, 3, Math.PI, 2 * Math.PI, 6],
        ['arc', 0, 1, 6, Math.PI, 2 * Math.PI, 8],
        ['line', 0, -5, 0, -8.5],
        ['line', -4, -8.5, 4, -8.5]
    ],

    // a speaker, a box and its cone, with two sound waves
    sound: [
        ['line', -7.5, -3, -4, -3, -4, 3, -7.5, 3, -7.5, -3],
        ['line', -4, -3, 0.5, -7.5, 0.5, 7.5, -4, 3],
        ['arc', 0.5, 0, 4, -0.3 * Math.PI, 0.3 * Math.PI, 4],
        ['arc', 0.5, 0, 8, -0.3 * Math.PI, 0.3 * Math.PI, 6]
    ],

    // a cluster of dots around a larger one
    particlesystem: [
        ['disc', 0, 0, 3.2],
        ...Array.from({ length: 6 }, (_, i) => {
            const angle = (0.5 + i / 3) * Math.PI;
            return /** @type {IconStroke} */ (['disc', 7.5 * Math.cos(angle), 7.5 * Math.sin(angle), i & 1 ? 1.6 : 2.2]);
        })
    ]
};

export { ICON_GLYPHS };
