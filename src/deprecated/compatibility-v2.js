import { StandardMaterial } from '../scene/materials/standard-material.js';

// useGammaTonemap is renamed to useGamma
Object.defineProperty(StandardMaterial.prototype, 'useGamma', {
    get: function () {
        return this.useGammaTonemap;
    },
    set: function (value) {
        this.useGammaTonemap = value;
    }
});

// ignore aoIntensity as it's not supported
Object.defineProperty(StandardMaterial.prototype, 'aoIntensity', {
    get: function () {
        return 1;
    },
    set: function (value) {
    }
});

// dummy export to avoid the module being removed by rollup
// TODO: remove this export when the module has other exports
export function __dummyFunction() {
}
