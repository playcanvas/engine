import { Quat } from '../../math/quat.js';
import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';
import { ANIM_LAYER_OVERWRITE } from '../controller/constants.js';

/**
 * @private
 * @class
 * @name AnimTargetValue
 * @classdesc Used to store and update the value of an animation target. This combines the values of multiple layer targets into a single value.
 * @param {AnimComponent} component - The anim component this target value is associated with.
 * @param {string} type - The type of value stored, either quat or vec3.
 */
class AnimTargetValue {
    static TYPE_QUAT = 'QUATERNION';

    static TYPE_VEC3 = 'VECTOR3';

    static _weightedQuaternion = new Vec4();

    constructor(component, type) {
        this._component = component;
        this.mask = new Int8Array(component.layers.length);
        this.weights = new Float32Array(component.layers.length);
        this.totalWeight = 0;
        this.counter = 0;
        this.layerCounter = 0;
        this.valueType = type;
        this.dirty = true;

        if (this.valueType === AnimTargetValue.TYPE_QUAT) {
            this.value = new Quat();
            this._currentValue = new Quat();
        } else {
            this.value = new Vec3();
            this._currentValue = new Vec3();
        }
    }

    getWeight(index) {
        if (this.dirty) this.updateWeights();
        if (this.totalWeight === 0 || !this.mask[index]) {
            return 0;
        }
        return this.weights[index] / this.totalWeight;
    }

    setMask(index, value) {
        this.mask[index] = value;
        if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
            this.mask = this.mask.fill(0, 0, index);
        }
        this.dirty = true;
    }

    updateWeights() {
        this.totalWeight = 0;
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[i] = this._component.layers[i].weight;
            this.totalWeight += this.mask[i] * this.weights[i];
        }
        this.dirty = false;
    }

    updateValue(index, value) {
        if (this.counter === 0) {
            this.value.set(0, 0, 0, 1);
        }
        if (!this.mask[index]) return;
        this._currentValue.set(...value);
        switch (this.valueType) {
            case (AnimTargetValue.TYPE_QUAT): {
                // Blend the current rotation value with the identity quaternion using its weight
                const t = this.getWeight(index);
                AnimTargetValue._weightedQuaternion.set(
                    this._currentValue.x * t,
                    this._currentValue.y * t,
                    this._currentValue.z * t,
                    1.0 - t + this._currentValue.w * t,
                );

                // normalise the weighted vector
                const squaredMagnitude = AnimTargetValue._weightedQuaternion.dot(AnimTargetValue._weightedQuaternion);
                if (squaredMagnitude > 0) AnimTargetValue._weightedQuaternion.mulScalar(1.0 / Math.sqrt(squaredMagnitude));

                // apply the weighted rotation to the current target value
                this.value.mul(AnimTargetValue._weightedQuaternion);
                break;
            }
            case (AnimTargetValue.TYPE_VEC3): {
                // Add the weighted vector to the current target value
                this.value.add(this._currentValue.mulScalar(this.getWeight(index)));
                break;
            }
        }
    }
}

export {
    AnimTargetValue
};
