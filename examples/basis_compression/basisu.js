
var loadWasmModule = function(moduleName, jsUrl, binaryUrl, doneCallback) {
    self.importScripts(jsUrl);
    self[moduleName]({ locateFile: () => binaryUrl }).then( doneCallback );
};

var convert = function(basisu, name, buf) {
    // write the png data to a file in virtual wasm filesystem
    basisu.FS.writeFile('input.png', new Int8Array(buf));

    // perform compression
    basisu.callMain(['input.png', '-no_multithreading', '-mipmap', '-y_flip']);

    // read the resulting file data
    var result = basisu.FS.readFile('input.basis', { encoding: 'binary' }).buffer;

    // post result back
    self.postMessage({ name: name, buf: result }, [result]);
};

self.onmessage = (function() {
    var loading = false;
    var basisu = null;
    var queue = [];

    var performWasmCheck = function() {
        if (!loading) {
            loading = true;
            loadWasmModule(
                'basisu',
                '../../lib/basisu.js',
                '../../lib/basisu.wasm',
                function (instance) {
                    basisu = instance;
                    for (var i=0; i<queue.length; ++i) {
                        convert(basisu, queue[i].name, queue[i].buf);
                    }
                }
            );
        }
    };

    return function (message) {
        performWasmCheck();
        if (basisu) {
            convert(basisu, message.data.name, message.data.buf);
        } else {
            queue.push({ name: message.data.name, buf: message.data.buf });
        }
    }
})();
