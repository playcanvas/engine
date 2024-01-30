import { MIN_DESKTOP_WIDTH } from './constants.mjs';

/**
 * @returns {'portrait'|'landscape'} Orientation, which is either 'portrait' (width < 601 px) or
 * 'landscape' (every width >= 601, not aspect related)
 */
// @ts-ignore
const getOrientation = () => (window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'portrait' : 'landscape');

export { getOrientation };
