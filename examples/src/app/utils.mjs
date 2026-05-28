import { MIN_DESKTOP_HEIGHT, MIN_DESKTOP_WIDTH } from './constants.mjs';

/**
 * @typedef {'mobile'|'desktop'} Layout
 */

/**
 * @returns {Layout} The app layout.
 */
const getLayout = () => {
    const win = window.top ?? window;
    const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return win.innerWidth < MIN_DESKTOP_WIDTH || (touch && win.innerHeight < MIN_DESKTOP_HEIGHT) ? 'mobile' : 'desktop';
};

export { getLayout };
