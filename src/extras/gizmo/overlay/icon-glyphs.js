/**
 * The glyph of an icon, named for the component it marks.
 *
 * @typedef {'camera' | 'light' | 'audiolistener' | 'sound' | 'particlesystem'} OverlayIcon
 */

/**
 * The icon glyphs as SVG content in a 24 by 24 CSS pixel box centered on the origin, y down. They
 * are stroked white, 1.6 pixels wide, and drawn in the theme color by their alpha. An entity with
 * several of the components shows the first glyph in this order.
 *
 * @type {Record<OverlayIcon, string>}
 */
const ICON_GLYPHS = {
    // an outlined body with a lens widening to the right
    camera: `
        <rect x="-8" y="-5" width="11" height="10"/>
        <path d="M4 0L9 -4V4Z" fill="white" stroke="none"/>`,

    // a sun, a dot with eight spokes
    light: `
        <circle r="4.5" fill="white" stroke="none"/>
        <path d="M7.5 0H10.5M-7.5 0H-10.5M0 7.5V10.5M0 -7.5V-10.5
                 M5.303 5.303L7.425 7.425M-5.303 5.303L-7.425 7.425
                 M5.303 -5.303L7.425 -7.425M-5.303 -5.303L-7.425 -7.425"/>`,

    // a microphone, its rounded head held in a cradle on a stand
    audiolistener: `
        <path d="M-3 -1V-5A3 3 0 0 1 3 -5V-1A3 3 0 0 1 -3 -1Z"/>
        <path d="M-6 -1A6 6 0 0 0 6 -1M0 5V8.5M-4 8.5H4"/>`,

    // a speaker, a box and its cone, with two sound waves
    sound: `
        <rect x="-7.5" y="-3" width="3.5" height="6"/>
        <path d="M-4 -3L0.5 -7.5V7.5L-4 3"/>
        <path d="M2.851 -3.236A4 4 0 0 1 2.851 3.236M5.202 -6.472A8 8 0 0 1 5.202 6.472"/>`,

    // a cluster of dots around a larger one
    particlesystem: `
        <g fill="white" stroke="none">
            <circle r="3.2"/>
            <circle cy="-7.5" r="2.2"/>
            <circle cx="-6.495" cy="-3.75" r="1.6"/>
            <circle cx="-6.495" cy="3.75" r="2.2"/>
            <circle cy="7.5" r="1.6"/>
            <circle cx="6.495" cy="3.75" r="2.2"/>
            <circle cx="6.495" cy="-3.75" r="1.6"/>
        </g>`
};

export { ICON_GLYPHS };
