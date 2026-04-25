import { Script, BoundingBox, GSplatFormat, GSplatContainer, FloatPacking } from 'playcanvas';

/**
 * @import { Asset } from 'playcanvas'
 */

/**
 * A script that renders an image as gaussian splats, with one splat per non-transparent pixel.
 * The image is displayed on the XZ plane (Y=0), sized to fit in a 1x1 unit area
 * like the default PlaneGeometry. Use entity transform to scale/position.
 *
 * @example
 * // Add the script to an entity
 * entity.addComponent('script');
 * const image = entity.script.create(GsplatImage, {
 *     attributes: {
 *         imageAsset: myTextureAsset
 *     }
 * });
 */
class GsplatImage extends Script {
    static scriptName = 'gsplatImage';

    /**
     * The texture asset to display as splats.
     *
     * @attribute
     * @type {Asset|undefined}
     * @resource texture
     */
    imageAsset;

    /**
     * GSplatContainer instance.
     *
     * @type {GSplatContainer|null}
     * @private
     */
    _container = null;

    /**
     * GSplatFormat instance.
     *
     * @type {GSplatFormat|null}
     * @private
     */
    _format = null;

    /**
     * Reusable BoundingBox for calculations.
     *
     * @type {BoundingBox}
     * @private
     */
    _tempBox = new BoundingBox();

    /**
     * Hash of previous attribute values for change detection.
     *
     * @type {string}
     * @private
     */
    _prevHash = '';

    initialize() {
        // Create the gsplat component (will set resource later when we have data)
        if (!this.entity.gsplat) {
            this.entity.addComponent('gsplat', {
                unified: true
            });
        }
    }

    postUpdate() {
        // Check for attribute changes using hash comparison
        const hash = `${this.imageAsset?.id}`;
        if (hash !== this._prevHash) {
            this._prevHash = hash;
            this._rebuildFromImage();
        }
    }

    /**
     * Rebuilds the splat container from the current image asset.
     *
     * @private
     */
    _rebuildFromImage() {
        const texture = this.imageAsset?.resource;
        if (!texture) {
            // No texture, destroy container
            if (this._container) {
                this._container.destroy();
                this._container = null;
            }
            return;
        }

        // Get the source image element from the texture
        const source = texture.getSource();
        if (!source) {
            console.warn('GsplatImage: Texture has no source image');
            return;
        }

        const width = texture.width;
        const height = texture.height;

        // Create canvas and draw the image to get pixel data
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('GsplatImage: Failed to create canvas context');
            return;
        }
        ctx.drawImage(source, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const rgba = imgData.data;

        // Pass 1: Count non-transparent pixels
        let totalSplats = 0;
        for (let i = 3; i < rgba.length; i += 4) {
            if (rgba[i] > 0) totalSplats++;
        }

        // Always destroy old container first
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }

        // No visible pixels - nothing to create
        if (totalSplats === 0) {
            return;
        }

        // Calculate sizing to fit in 1x1 unit area
        const maxDim = Math.max(width, height);
        const spacing = 1.0 / maxDim;
        const splatSize = spacing * 1.1; // Slightly larger to avoid gaps

        const device = this.app.graphicsDevice;

        // Create format if needed
        if (!this._format) {
            this._format = GSplatFormat.createSimpleFormat(device);
        }

        // Create new container with exact capacity needed
        this._container = new GSplatContainer(device, totalSplats, this._format);

        // Update gsplat component resource
        if (this.entity.gsplat) {
            this.entity.gsplat.resource = this._container;
        }

        // Lock textures for writing
        const centerTex = this._container.getTexture('dataCenter');
        const colorTex = this._container.getTexture('dataColor');
        const centerData = centerTex.lock();
        const colorData = colorTex.lock();
        const centers = this._container.centers;

        // Pass 2: Fill only non-transparent pixels
        let splatIndex = 0;
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const pixelOffset = (py * width + px) * 4;
                const a = rgba[pixelOffset + 3];

                // Skip transparent pixels
                if (a === 0) continue;

                // Get color from pixel (0-255 -> 0-1)
                const r = rgba[pixelOffset + 0] / 255;
                const g = rgba[pixelOffset + 1] / 255;
                const b = rgba[pixelOffset + 2] / 255;
                const alpha = a / 255;

                // Calculate position on XZ plane, centered at origin
                // X goes from -0.5 to +0.5
                // Z goes from -0.5 to +0.5 (flip Y to get correct orientation)
                const x = (px / maxDim) - 0.5;
                const y = 0;
                const z = -((py / maxDim) - 0.5);

                // Write center data (RGBA32F: x, y, z, size)
                centerData[splatIndex * 4 + 0] = x;
                centerData[splatIndex * 4 + 1] = y;
                centerData[splatIndex * 4 + 2] = z;
                centerData[splatIndex * 4 + 3] = splatSize;

                // Write color data (RGBA16F: r, g, b, a as half-floats)
                colorData[splatIndex * 4 + 0] = FloatPacking.float2Half(r);
                colorData[splatIndex * 4 + 1] = FloatPacking.float2Half(g);
                colorData[splatIndex * 4 + 2] = FloatPacking.float2Half(b);
                colorData[splatIndex * 4 + 3] = FloatPacking.float2Half(alpha);

                // Write centers for sorting
                centers[splatIndex * 3 + 0] = x;
                centers[splatIndex * 3 + 1] = y;
                centers[splatIndex * 3 + 2] = z;

                splatIndex++;
            }
        }

        // Unlock textures
        centerTex.unlock();
        colorTex.unlock();

        // Build bounding box - 1x1 on XZ plane
        const aabb = this._tempBox;
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(0.5, splatSize, 0.5);

        // Update container
        this._container.aabb = aabb;
        this._container.update(totalSplats);
    }

    destroy() {
        // Destroy current container
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}

export { GsplatImage };
