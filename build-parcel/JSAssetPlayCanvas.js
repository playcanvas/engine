var Preprocessor = require("preprocessor");
var fs = require("fs");
var JSAsset = require("parcel-bundler/src/assets/JSAsset");

function preprocess(contents, optionsPlayCanvas) {
    var pp = new Preprocessor(contents);
    return pp.process({
        PROFILER: optionsPlayCanvas.PROFILER,
        DEBUG:    optionsPlayCanvas.DEBUG,
        RELEASE:  optionsPlayCanvas.RELEASE
    });
}

function ensurePlayCanvasOptions() {
    if (global.optionsPlayCanvas === undefined) {
        //console.log("Ensuring optionsPlayCanvas...");
        global.optionsPlayCanvas = fs.readFileSync("output/options.json").toJSON();
    }
}

class JSAssetPlayCanvas extends JSAsset {
    async pretransform() {
        ensurePlayCanvasOptions();
        var optionsPlayCanvas = global.optionsPlayCanvas;
        this.contents = preprocess(this.contents, optionsPlayCanvas);
        this.contents = this.contents.replace("__CURRENT_SDK_VERSION__", optionsPlayCanvas.__CURRENT_SDK_VERSION__);
        this.contents = this.contents.replace("__REVISION__"           , optionsPlayCanvas.__REVISION__);
        this.contents = this.contents.replace(/throw new Error/g       , "throw Error");
        this.contents = this.contents.replace(/throw new TypeError/g   , "throw TypeError");
        // continue the normal flow
        return await super.pretransform()
    }
}

module.exports = JSAssetPlayCanvas;
