import { Observer } from './playcanvas-observer.mjs';

/**
 * @type {Observer}
 */
let data;
function refresh() {
    data = new Observer({});
}

export { data, refresh };
