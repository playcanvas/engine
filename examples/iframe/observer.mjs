import { Observer } from './playcanvas-observer.mjs';

let data;
function refresh() {
    data = new Observer({});
}

export { data, refresh };
