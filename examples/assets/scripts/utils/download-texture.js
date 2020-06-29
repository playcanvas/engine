// Construct an uncompressed PNG file manually because the canvas API suffers from
// bit loss due to its handling of premultiplied alpha.
// Taken from https://rawgit.com/zholos/js_bitmap/master/bitmap.js
function constructPngUrl(data, width, height) {
    var row = function (data, width, y) {
        var result = "\0";
        var r = y * width * 4;
        for (var x = 0; x < width; x++) {
            result += String.fromCharCode(data[r], data[r + 1], data[r + 2], data[r + 3]);
            r += 4;
        }
        return result;
    };

    var rows = function (data, width, height) {
        var result = "";
        for (var y = 0; y < height; y++)
            result += row(data, width, y);
        return result;
    };

    var adler = function (data) {
        var s1 = 1, s2 = 0;
        for (var i = 0; i < data.length; i++) {
            s1 = (s1 + data.charCodeAt(i)) % 65521;
            s2 = (s2 + s1) % 65521;
        }
        return s2 << 16 | s1;
    };

    var hton = function (i) {
        return String.fromCharCode(i >>> 24, i >>> 16 & 255, i >>> 8 & 255, i & 255);
    };

    var deflate = function (data) {
        var compressed = "\x78\x01";
        var i = 0;
        do {
            var block = data.slice(i, i + 65535);
            var len = block.length;
            compressed += String.fromCharCode(
                ((i += block.length) == data.length) << 0,
                len & 255, len >>> 8, ~len & 255, (~len >>> 8) & 255);
            compressed += block;
        } while (i < data.length);
        return compressed + hton(adler(data));
    };

    var crc32 = function (data) {
        var c = ~0;
        for (var i = 0; i < data.length; i++)
            for (var b = data.charCodeAt(i) | 0x100; b != 1; b >>>= 1)
                c = (c >>> 1) ^ ((c ^ b) & 1 ? 0xedb88320 : 0);
        return ~c;
    };

    var chunk = function (type, data) {
        return hton(data.length) + type + data + hton(crc32(type + data));
    };

    var png = "\x89PNG\r\n\x1a\n" +
        chunk("IHDR", hton(width) + hton(height) + "\x08\x06\0\0\0") +
        chunk("IDAT", deflate(rows(data, width, height))) +
        chunk("IEND", "");

    return "data:image/png;base64," + btoa(png);
}

// Construct a PNG using canvas API. This function is much faster than the manual approach,
// but suffers from canvas premultiplied alpha bit loss.
var constructPngUrlOld = function (data, width, height) {       // eslint-disable-line no-unused-vars
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext('2d');
    context.putImageData(new ImageData(data, width, height), 0, 0);

    return canvas.toDataURL("image/png");
};

// download the data uri
function download(url, filename) {
    var lnk = document.createElement('a');
    lnk.download = filename;
    lnk.href = url;

    // create a "fake" click-event to trigger the download
    if (document.createEvent) {
        var e = document.createEvent("MouseEvents");
        e.initMouseEvent("click", true, true, window,
                         0, 0, 0, 0, 0, false, false, false,
                         false, 0, null);

        lnk.dispatchEvent(e);
    } else if (lnk.fireEvent) {
        lnk.fireEvent("onclick");
    }
}

// read the pixel data of the given texture face
function readPixels(texture, face) {
    var rt = new pc.RenderTarget({ colorBuffer: texture, depth: false, face: face });
    var data = new Uint8ClampedArray(texture.width * texture.height * 4);
    var device = texture.device;
    device.setFramebuffer(rt._glFrameBuffer);
    device.initRenderTarget(rt);
    device.gl.readPixels(0, 0, texture.width, texture.height, device.gl.RGBA, device.gl.UNSIGNED_BYTE, data);
    return data;
}

// flip image data in Y
function flipY(data, width, height) {
    var tmp = new Uint8ClampedArray(width * 4);
    var x, y;
    for (y = 0; y < height / 2; ++y) {
        // copy top line to tmp
        for (x = 0; x < width * 4; ++x) {
            tmp[x] = data[x + y * width * 4];
        }
        data.copyWithin(y * width * 4, (height - y - 1) * width * 4, (height - y) * width * 4);
        // copy tmp to bottom
        for (x = 0; x < width * 4; ++x) {
            data[x + (height - y - 1) * width * 4] = tmp[x];
        }
    }
}

// download the image as png
function downloadTexture(texture, filename, face, flipY_) {         // eslint-disable-line no-unused-vars
    var width;
    var height;
    var data;

    if (texture.cubemap && face === undefined) {
        width = texture.width * 6;
        height = texture.height;
        data = new Uint8ClampedArray(width * height * 4);

        var i, j, k, src, dst;
        for (i = 0; i < 6; ++i) {
            var faceData = readPixels(texture, [1, 4, 0, 5, 2, 3][i]);
            for (j = 0; j < texture.height; ++j) {
                src = j * texture.width * 4;
                dst = j * width * 4 + i * texture.width * 4;
                for (k = 0; k < texture.width; ++k) {
                    data[dst++] = faceData[src++];
                    data[dst++] = faceData[src++];
                    data[dst++] = faceData[src++];
                    data[dst++] = faceData[src++];
                }
            }
        }
    } else {
        width = texture.width;
        height = texture.height;
        data = readPixels(texture, face);
    }

    if (flipY_) {
        flipY(data, width, height);
    }

    download(constructPngUrl(data, width, height), filename);
}
