export * from './index.js';
import { Vec2 } from './core/math/vec2.js';
import { Vec3 } from './core/math/vec3.js';
import { Vec4 } from './core/math/vec4.js';
import { Quat } from './core/math/quat.js';
import { Mat3 } from './core/math/mat3.js';
import { Mat4 } from './core/math/mat4.js';
import { customTypes, customValidations, validateNumber } from '@runtime-type-inspector/runtime';
import 'display-anything/src/style.js';
Object.assign(customTypes, {
    AnimSetter(value) {
        // Fix for type in ./framework/anim/evaluator/anim-target.js
        // The AnimSetter type is not sufficient, just patching in the correct type here
        if (value instanceof Function) {
            return true;
        }
        return value?.set instanceof Function && value?.set instanceof Function;
    },
    AnimBinder(value) {
        // Still using: @implements {AnimBinder}
        // RTI doesn't take notice of that so far and we started removing `@implements` aswell:
        // Testable via graphics/contact-hardening-shadows example.
        return value?.constructor?.name?.endsWith('Binder');
    },
    ComponentData(value) {
        // Used in src/framework/components/collision/trigger.js
        // Why do we neither use @implements nor `extends` for such type?
        // Testable via animation/locomotion example.
        return value?.constructor?.name?.endsWith("ComponentData");
    },
    Renderer(value) {
        // E.g. instance of `ForwardRenderer`
        return value?.constructor?.name?.endsWith("Renderer");
    },
    IArguments(value) {
        // Used in src/core/tags.js
        // Testable via physics/offset-collision example.
        return value[Symbol.iterator] instanceof Function;
    }
});
// For quickly checking props of Vec2/Vec3/Vec4/Quat/Mat3/Mat4 without GC
const propsXY   = ['x', 'y'];
const propsXYZ  = ['x', 'y', 'z'];
const propsXYZW = ['x', 'y', 'z', 'w'];
const props9    = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const props16   = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
/**
 * `@ignoreRTI`
 * @param {any} value - The value.
 * @returns {boolean} Only false if we can find some NaN issues.
 */
function validate(value) {
    /**
     * @param {string|number} prop - Something like 'x', 'y', 'z', 'w', 0, 1, 2, 3, 4 etc.
     * @returns {boolean} Wether prop is a valid number.
     */
    const checkProp = (prop) => {
        return validateNumber(value, prop);
    };
    if (value instanceof Vec2) {
        return propsXY.every(checkProp);
    }
    if (value instanceof Vec3) {
        return propsXYZ.every(checkProp);
    }
    if ((value instanceof Vec4) || (value instanceof Quat)) {
        return propsXYZW.every(checkProp);
    }
    if (value instanceof Mat3) {
        return props9.every(prop => validateNumber(value.data, prop));
    }
    if (value instanceof Mat4) {
        return props16.every(prop => validateNumber(value.data, prop));
    }
    return true;
}
customValidations.push(validate);
