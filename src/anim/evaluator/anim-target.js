/**
 * @private
 * @callback AnimSetter
 * @description Callback function that the {@link AnimEvaluator} uses to set final animation values.
 * These callbacks are stored in {@link AnimTarget} instances which are constructed by an
 * {@link AnimBinder}.
 * @param {number[]} value - Updated animation value.
 */

/**
 * @private
 * @class
 * @name AnimTarget
 * @classdesc Stores the information required by {@link AnimEvaluator} for updating a target value.
 * @param {AnimSetter} func - This function will be called when a new animation value is output by
 * the {@link AnimEvaluator}.
 * @param {'vector'|'quaternion'} type - The type of animation data this target expects.
 * @param {number} components - The number of components on this target (this should ideally match the number
 * of components found on all attached animation curves).
 */
class AnimTarget {
    constructor(func, type, components, targetPath) {
        this._func = func;
        this._type = type;
        this._components = components;
        this._targetPath = targetPath;
        this._isTransform = (this._targetPath.substring(this._targetPath.length - 13) === 'localRotation') ||
        (this._targetPath.substring(this._targetPath.length - 13) === 'localPosition') ||
        (this._targetPath.substring(this._targetPath.length - 10) === 'localScale');
    }

    get func() {
        return this._func;
    }

    get type() {
        return this._type;
    }

    get components() {
        return this._components;
    }

    get targetPath() {
        return this._targetPath;
    }

    get isTransform() {
        return this._isTransform;
    }
}

export { AnimTarget };
