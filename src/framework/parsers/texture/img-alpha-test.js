import { PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';

//
// Current state of ImageBitmap (April 2023):
//
// Chrome MacOS and Android (Pixel 3a and Pixel 7 Pro):
//   Correctly loads PNG alpha and runs faster (significantly so on mobile) than HTMLImageElement.
//
// Firefox MacOS:
//   Correctly loads PNG alpha, but runs significantly slower than HTMLImageElement.
//
// Safari MacOS and iOS (iPhone 8 and iPhone 13 Pro Max):
//   Incorrectly loads PNG alpha and runs significantly slower than HTMLImageElement.
//

// 1x1 png image containing rgba(1, 2, 3, 63)
const pngBytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21,
    196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 100, 100, 98, 182, 7, 0, 0, 89, 0, 71, 67, 133, 148, 237,
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
]);

const testAlpha = (device, image) => {
    // create the texture
    const texture = new Texture(device, {
        width: 1,
        height: 1,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        levels: [image]
    });

    // read pixels
    const rt = new RenderTarget({ colorBuffer: texture, depth: false });
    device.setFramebuffer(rt.impl._glFrameBuffer);
    device.initRenderTarget(rt);

    const data = new Uint8ClampedArray(4);
    device.gl.readPixels(0, 0, 1, 1, device.gl.RGBA, device.gl.UNSIGNED_BYTE, data);

    rt.destroy();
    texture.destroy();

    return data[0] === 1 && data[1] === 2 && data[2] === 3 && data[3] === 63;
};

// Test whether ImageBitmap correctly loads PNG alpha data.
const testImageBitmapAlpha = (device) => {
    return createImageBitmap(new Blob([pngBytes], {
        type: 'image/png'
    }), {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none'
    })
        .then((image) => {
            return testAlpha(device, image);
        })
        .catch(e => false);
};

// Test whether image element correctly loads PNG alpha data.
const testImgElementAlpha = (device) => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([pngBytes]));
        image.onload = () => {
            resolve(testAlpha(device, image));
        };
    });
};

class ImgAlphaTest {
    static run(device) {
        testImageBitmapAlpha(device).then((result) => {
            console.log(`imageBitmapIsCorrect=${result}`);
        });

        testImgElementAlpha(device).then((result) => {
            console.log(`imgElementIsCorrect=${result}`);
        });
    }
}

export { ImgAlphaTest };
