import { EventHandler } from '../core/event-handler.js';
import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';

/**
 * The tracked image interface that is created by the Image Tracking system and is provided as a
 * list from {@link XrImageTracking#images}. It contains information about the tracking state as
 * well as the position and rotation of the tracked image.
 *
 * @augments EventHandler
 */
class XrTrackedImage extends EventHandler {
    /**
     * The tracked image interface that is created by the Image Tracking system and is provided as
     * a list from {@link XrImageTracking#images}. It contains information about the tracking state
     * as well as the position and rotation of the tracked image.
     *
     * @param {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap} image - Image
     * that is matching the real world image as closely as possible. Resolution of images should be
     * at least 300x300. High resolution does NOT improve tracking performance. Color of image is
     * irrelevant, so grayscale images can be used. Images with too many geometric features or
     * repeating patterns will reduce tracking stability.
     * @param {number} width - Width (in meters) of image in real world. Providing this value as
     * close to the real value will improve tracking quality.
     * @hideconstructor
     */
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
     * @name XrTrackedImage#tracked
     * @description Fired when image becomes actively tracked.
     */

    /**
     * @event
     * @name XrTrackedImage#untracked
     * @description Fired when image is no more actively tracked.
     */

    prepare() {
        if (this._bitmap) {
            return {
                image: this._bitmap,
                widthInMeters: this._width
            };
        }

        return createImageBitmap(this._image)
            .then((bitmap) => {
                this._bitmap = bitmap;
                return {
                    image: this._bitmap,
                    widthInMeters: this._width
                };
            });
    }

    destroy() {
        this._image = null;
        this._pose = null;

        if (this._bitmap) {
            this._bitmap.close();
            this._bitmap = null;
        }
    }

    /**
     * Get the position of the tracked image. The position is the most recent one based on the
     * tracked image state.
     *
     * @returns {Vec3} Position in world space.
     * @example
     * // update entity position to match tracked image position
     * entity.setPosition(trackedImage.getPosition());
     */
    getPosition() {
        if (this._pose) this._position.copy(this._pose.transform.position);
        return this._position;
    }

    /**
     * Get the rotation of the tracked image. The rotation is the most recent based on the tracked
     * image state.
     *
     * @returns {Quat} Rotation in world space.
     * @example
     * // update entity rotation to match tracked image rotation
     * entity.setRotation(trackedImage.getRotation());
     */
    getRotation() {
        if (this._pose) this._rotation.copy(this._pose.transform.orientation);
        return this._rotation;
    }
   
    /**
     * Image that is used for tracking.
     *
     * @type {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap}
     */
    get image() {
        return this._image;
    }

    /**
     * Width that is provided to assist tracking performance. This property can be updated only
     * when the AR session is not running.
     *
     * @type {number}
     */
    get width() {
        return this._width;
    }

    set width(value) {
        this._width = value;
    }

    /**
     * True if image is trackable. A too small resolution or invalid images can be untrackable by
     * the underlying AR system.
     *
     * @type {boolean}
     */
    get trackable() {
        return this._trackable;
    }

    /**
     * True if image is in tracking state and being tracked in real world by the underlying AR
     * system.
     *
     * @type {boolean}
     */
    get tracking() {
        return this._tracking;
    }

    /**
     * True if image was recently tracked but currently is not actively tracked due to inability of
     * identifying the image by the underlying AR system. Position and rotation will be based on
     * the previously known transformation assuming the tracked image has not moved.
     *
     * @type {boolean}
     */
    get emulated() {
        return this._emulated;
    }
}

export { XrTrackedImage };
