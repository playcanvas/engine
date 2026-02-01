import { Script, BoundingBox, GSplatFormat, GSplatContainer, FloatPacking } from 'playcanvas';

/**
 * A script that renders text as gaussian splats, with one splat per non-transparent pixel.
 * The text is displayed on the XZ plane (Y=0), sized to fit in a 1x1 unit area.
 * Use entity transform to scale/position.
 *
 * @example
 * // Add the script to an entity
 * entity.addComponent('script');
 * const textSplat = entity.script.create(GsplatText);
 * textSplat.text = 'Hello World';
 * textSplat.fontSize = 64;
 * textSplat.fillStyle = '#ffffff';
 */
class GsplatText extends Script {
    static scriptName = 'gsplatText';

    /**
     * The text string to render.
     *
     * @attribute
     * @type {string}
     */
    text = '';

    /**
     * Font size in pixels.
     *
     * @attribute
     * @type {number}
     */
    fontSize = 64;

    /**
     * CSS font family.
     *
     * @attribute
     * @type {string}
     */
    fontFamily = 'sans-serif';

    /**
     * Text fill color (CSS color string).
     *
     * @attribute
     * @type {string}
     */
    fillStyle = '#ffffff';

    /**
     * Text stroke/outline color (CSS color string).
     *
     * @attribute
     * @type {string}
     */
    strokeStyle = 'rgba(0,0,0,0.85)';

    /**
     * Stroke width in pixels. If 0, auto-calculated as ~8% of fontSize.
     *
     * @attribute
     * @type {number}
     */
    strokeWidth = 0;

    /**
     * Padding around text in pixels.
     *
     * @attribute
     * @type {number}
     */
    padding = 12;

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
        const hash = `${this.text}|${this.fontSize}|${this.fontFamily}|${this.fillStyle}|${this.strokeStyle}|${this.strokeWidth}|${this.padding}`;
        if (hash !== this._prevHash) {
            this._prevHash = hash;
            this._rebuildFromText();
        }
    }

    /**
     * Rebuilds the splat container from the current text.
     *
     * @private
     */
    _rebuildFromText() {
        if (!this.text) {
            // No text, destroy container
            if (this._container) {
                this._container.destroy();
                this._container = null;
            }
            return;
        }

        const fontSize = this.fontSize;
        const fontFamily = this.fontFamily;
        const padding = this.padding;
        const strokeWidth = this.strokeWidth > 0 ? this.strokeWidth : Math.max(2, Math.round(fontSize * 0.08));

        // Create canvas to render text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('GsplatText: Failed to create canvas context');
            return;
        }

        // Measure text to determine canvas size
        const font = `${fontSize}px ${fontFamily}`;
        ctx.font = font;
        const metrics = ctx.measureText(this.text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = fontSize;

        const width = textWidth + padding * 2 + strokeWidth * 2;
        const height = textHeight + padding * 2 + strokeWidth * 2;

        canvas.width = width;
        canvas.height = height;

        // Re-set font after canvas resize (resets context state)
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;

        // Draw stroke (outline) first, then fill
        if (strokeWidth > 0) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = this.strokeStyle;
            ctx.strokeText(this.text, cx, cy);
        }

        ctx.fillStyle = this.fillStyle;
        ctx.fillText(this.text, cx, cy);

        // Get pixel data
        const imgData = ctx.getImageData(0, 0, width, height);
        const rgba = imgData.data;

        // Pass 1: Count non-transparent pixels
        let totalSplats = 0;
        for (let i = 3; i < rgba.length; i += 4) {
            if (rgba[i] > 0) totalSplats++;
        }

        if (totalSplats === 0) {
            // No visible pixels
            if (this._container) {
                this._container.destroy();
                this._container = null;
            }
            return;
        }

        // Calculate sizing to fit in 1x1 unit area
        const maxDim = Math.max(width, height);
        const spacing = 1.0 / maxDim;
        const splatSize = spacing * 1.1; // Slightly larger to avoid gaps

        const device = this.app.graphicsDevice;

        // Always destroy old container and create new one
        if (this._container) {
            this._container.destroy();
        }

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

        // Build bounding box - based on actual content size
        const aabb = this._tempBox;
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(0.5, splatSize, 0.5);

        // Update container
        this._container.aabb = aabb;
        this._container.update(totalSplats);
    }

    destroy() {
        // Destroy current container (deferred destruction is handled internally)
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}

export { GsplatText };
