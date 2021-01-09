import { EventHandler } from '../core/event-handler.js';
import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';

/**
 * @class
 * @name pc.XrTrackedImage
 * @classdesc The tracked image interface that is created by the Image Tracking system and is provided as a list from {@link pc.XrImageTracking#images}. It contains information about the tracking state as well as the position and rotation of the tracked image.
 * @description The tracked image interface that is created by the Image Tracking system and is provided as a list from {@link pc.XrImageTracking#images}. It contains information about the tracking state as well as the position and rotation of the tracked image.
 * @param {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap} image - Image that is matching the real world image as closely as possible. Resolution of images should be at least 300x300. High resolution does NOT improve tracking performance. Color of image is irrelevant, so greyscale images can be used. Images with too many geometric features or repeating patterns will reduce tracking stability.
 * @param {number} width - Width (in meters) of image in real world. Providing this value as close to the real value will improve tracking quality.
 * @property {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap} image Image that is used for tracking.
 * @property {number} width Width that is provided to assist tracking performance. This property can be updated only when the AR session is not running.
 * @property {boolean} trackable True if image is trackable. A too small resolution or invalid images can be untrackable by the underlying AR system.
 * @property {boolean} tracking True if image is in tracking state and being tracked in real world by the underlying AR system.
 * @property {boolean} emulated True if image was recently tracked but currently is not actively tracked due to inability of identifying the image by the underlying AR system. Position and rotation will be based on the previously known transformation assuming the tracked image has not moved.
 */
class XrTrackedImage extends EventHandler {
    constructor(image, width) {
        super();

        this._image = image;
        this._bitmap = null;
        this._width = width;
        this._measuredWidth = 0;
        this._trackable = false;
        this._tracking = false;
        this._emulated = false;
        this._pose = null;

        this._position = new Vec3();
        this._rotation = new Quat();
    }

    /**
     * @event
     * @name pc.XrTrackedImage#tracked
     * @description Fired when image becomes actively tracked.
     */

    /**
     * @event
     * @name pc.XrTrackedImage#untracked
     * @description Fired when image is no more actively tracked.
     */

    prepare() {
        var self = this;

        if (this._bitmap) {
            return {
                image: this._bitmap,
                widthInMeters: this._width
            };
        }

        return createImageBitmap(this._image)
            .then(function (bitmap) {
                self._bitmap = bitmap;
                return {
                    image: self._bitmap,
                    widthInMeters: self._width
                };
            });
    }

    destroy = function () {
        this._image = null;
        this._pose = null;

        if (this._bitmap) {
            this._bitmap.close();
            this._bitmap = null;
        }
    }

    /**
     * @function
     * @name pc.XrTrackedImage#getPosition
     * @description Get the position of the tracked image. The position is the most recent one based on the tracked image state.
     * @returns {pc.Vec3} Position in world space.
     * @example
     * // update entity position to match tracked image position
     * entity.setPosition(trackedImage.getPosition());
     */
    getPosition() {
        if (this._pose) this._position.copy(this._pose.transform.position);
        return this._position;
    }

    /**
     * @function
     * @name pc.XrTrackedImage#getRotation
     * @description Get the rotation of the tracked image. The rotation is the most recent based on the tracked image state.
     * @returns {pc.Quat} Rotation in world space.
     * @example
     * // update entity rotation to match tracked image rotation
     * entity.setRotation(trackedImage.getRotation());
     */
    getRotation = function () {
        if (this._pose) this._rotation.copy(this._pose.transform.orientation);
        return this._rotation;
    }

    get image() {
        return this._image;
    }

    get width() {
        return this._width;
    }

    set width(value) {
        this._width = value;
    }

    get trackable() {
        return this._trackable;
    }

    get tracking() {
        return this._tracking;
    }

    get emulated() {
        return this._emulated;
    }
}

export { XrTrackedImage };
