import { Vec4 } from "./vec4.js";

// this is a 32x32x32 blue noise texture
import base64String from './blue-noise-data.js';

let data = null;
const initData = () => {
    if (!data) {
        const binaryString = atob(base64String);

        // the data stores an array of RGBA 8-bit values, each of the color channels represents
        // a separate blue noise stream
        data = Uint8Array.from(binaryString, char => char.charCodeAt(0));
    }
};

const blueNoiseData = () => {
    initData();
    return data;
};

/**
 * Blue noise based random numbers API.
 *
 * @ignore
 */
class BlueNoise {
    seed = 0;

    constructor(seed = 0) {
        this.seed = seed * 4;
        initData();
    }

    _next() {
        this.seed = (this.seed + 4) % data.length;
    }

    value() {
        this._next();
        return data[this.seed] / 255;
    }

    vec4(dest = new Vec4()) {
        this._next();
        return dest.set(data[this.seed], data[this.seed + 1], data[this.seed + 2], data[this.seed + 3]).mulScalar(1 / 255);
    }
}

export { BlueNoise, blueNoiseData };
