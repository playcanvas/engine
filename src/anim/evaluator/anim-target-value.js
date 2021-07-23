import { Quat } from '../../math/quat.js';
import { Vec3 } from '../../math/vec3.js';
import { ANIM_LAYER_OVERWRITE } from '../controller/constants.js';

class AnimTargetValue {
    constructor(component, type) {
        this._component = component;
        this.mask = new Int8Array(component.layers.length);
        this.weights = new Float32Array(component.layers.length);
        this.totalWeight = 0;
        this.counter = 0;
        this.layerCounter = 0;
        this.valueType = type;

        if (this.valueType === AnimTargetValue.TYPE_QUAT) {
            this.value = new Quat();
            this._currentValue = new Quat();
        } else {
            this.value = new Vec3();
            this._currentValue = new Vec3();
        }
    }

    weight(index) {
        if (this._component.dirtyWeights) this.updateWeights();
        if (this.totalWeight === 0) return 0;
        return this.weights[index] / this.totalWeight;
    }

    setMask(index, value) {
        this.mask[index] = value;
        if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
            this.mask = this.mask.fill(0, 0, index - 1);
        }
        this.updateWeights();
    }

    updateWeights() {
        this.totalWeight = 0;
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[i] = this._component.layers[i].weight;
            this.totalWeight += this.mask[i] * this.weights[i];
        }
    }

    updateValue(index, value) {
        if (this.counter === 0) {
            this.value.set(0, 0, 0, 1);
        }
        this._currentValue.set(...value);
        switch (this.valueType) {
            case (AnimTargetValue.TYPE_QUAT): {
                this.value.mul(this._currentValue.slerp(Quat.IDENTITY, this._currentValue, this.weight(index)));
                break;
            }
            case (AnimTargetValue.TYPE_VEC3): {
                this.value.add(this._currentValue.mulScalar(this.weight(index)));
                break;
            }
        }
    }
}

AnimTargetValue.TYPE_QUAT = 'QUATERNION';
AnimTargetValue.TYPE_VEC3 = 'VECTOR3';

export {
    AnimTargetValue
};
