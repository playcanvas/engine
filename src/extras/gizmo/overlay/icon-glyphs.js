/**
 * The built-in gizmo icons as SVG markup, named for the component they mark. An icon fills its
 * view box, drawn the gizmo icon size square in the gizmo color by its alpha. Add your own to {@link IconGizmo#icons} in the same form.
 *
 * @type {Record<string, string>}
 * @category Gizmo
 */
const GIZMO_ICONS = {
    // a sun, a dot with eight spokes
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="none" stroke="white" stroke-width="1.6">
        <circle r="4.5" fill="white" stroke="none"/>
        <path d="M7.5 0H10.5M-7.5 0H-10.5M0 7.5V10.5M0 -7.5V-10.5
                 M5.303 5.303L7.425 7.425M-5.303 5.303L-7.425 7.425
                 M5.303 -5.303L7.425 -7.425M-5.303 -5.303L-7.425 -7.425"/>
    </svg>`,

    // an outlined body with a lens widening to the right
    camera: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="none" stroke="white" stroke-width="1.6">
        <rect x="-8" y="-5" width="11" height="10"/>
        <path d="M4 0L9 -4V4Z" fill="white" stroke="none"/>
    </svg>`,

    // a microphone, its rounded head held in a cradle on a stand
    audiolistener: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="none" stroke="white" stroke-width="1.6">
        <path d="M-3 -1V-5A3 3 0 0 1 3 -5V-1A3 3 0 0 1 -3 -1Z"/>
        <path d="M-6 -1A6 6 0 0 0 6 -1M0 5V8.5M-4 8.5H4"/>
    </svg>`,

    // a speaker, a box and its cone, with two sound waves
    sound: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="none" stroke="white" stroke-width="1.6">
        <rect x="-7.5" y="-3" width="3.5" height="6"/>
        <path d="M-4 -3L0.5 -7.5V7.5L-4 3"/>
        <path d="M2.851 -3.236A4 4 0 0 1 2.851 3.236M5.202 -6.472A8 8 0 0 1 5.202 6.472"/>
    </svg>`,

    // a cluster of dots around a larger one
    particlesystem: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="white">
        <circle r="3.2"/>
        <circle cy="-7.5" r="2.2"/>
        <circle cx="-6.495" cy="-3.75" r="1.6"/>
        <circle cx="-6.495" cy="3.75" r="2.2"/>
        <circle cy="7.5" r="1.6"/>
        <circle cx="6.495" cy="3.75" r="2.2"/>
        <circle cx="6.495" cy="-3.75" r="1.6"/>
    </svg>`
};

export { GIZMO_ICONS };
