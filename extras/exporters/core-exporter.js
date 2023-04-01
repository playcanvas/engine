class CoreExporter {
    /**
     * Converts a texture to a canvas.
     *
     * @param {Texture} texture - The source texture to be converted.
     * @param {object} options - Object for passing optional arguments.
     * @param {Color} [options.color] - The tint color to modify the texture with.
     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
     * @returns {HTMLCanvasElement|undefined} - The canvas element containing the image.
     */
    textureToCanvas(texture, options = {}) {

        const image = texture.getSource();

        if ((typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
            (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
            (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas) ||
            (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)) {

            // texture dimensions
            let { width, height } = image;
            const maxTextureSize = options.maxTextureSize;
            if (maxTextureSize) {
                const scale = Math.min(maxTextureSize / Math.max(width, height), 1);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }

            // convert to a canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            // tint the texture by specified color
            if (options.color) {
                const { r, g, b } = options.color;

                const imagedata = context.getImageData(0, 0, width, height);
                const data = imagedata.data;

                for (let i = 0; i < data.length; i += 4) {
                    data[i + 0] = data[i + 0] * r;
                    data[i + 1] = data[i + 1] * g;
                    data[i + 2] = data[i + 2] * b;
                }

                context.putImageData(imagedata, 0, 0);
            }

            return canvas;
        }
    }
}

export { CoreExporter };
