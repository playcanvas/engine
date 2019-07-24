Object.assign(pc, function () {
    'use strict';

    var GlbAnimationsParser = function () {
    };

    Object.assign(GlbAnimationsParser.prototype, {
        parse: function (glb, onLoaded, onFailed) {
            var decoder = new pc.GLBHelpers.GLTFDecoder(glb, onFailed);
            var gltf = decoder.parseGLTF();
            if (!gltf)
                return;
            var buffers = decoder.extractBuffers();
            if (!buffers)
                return;

            var options = { buffers: buffers };
            this.loadGltf(gltf, options, onLoaded, onFailed);
        },

        loadGltf: function (gltf, options, onLoaded, onFailed) {
            var buffers = (options && options.hasOwnProperty('buffers')) ? options.buffers : undefined;
            var basePath = (options && options.hasOwnProperty('basePath')) ? options.basePath : undefined;
            var processUri = (options && options.hasOwnProperty('processUri')) ? options.processUri : undefined;
            var processAnimationExtras = (options && options.hasOwnProperty('processAnimationExtras')) ? options.processAnimationExtras : undefined;
            var processGlobalExtras = (options && options.hasOwnProperty('processGlobalExtras')) ? options.processGlobalExtras : undefined;

            var context = new AnimLoaderContext(onLoaded, onFailed);
            Object.assign(context, {
                basePath: basePath,
                buffers: buffers,
                gltf: gltf,
                processUri: processUri,
                processAnimationExtras: processAnimationExtras,
                processGlobalExtras: processGlobalExtras
            });

            context.loadBuffers();
        }
    });

    function AnimLoaderContext(onLoaded, onFailed) {
        this._onLoaded = onLoaded;
        this._onFailed = onFailed;
    }

    AnimLoaderContext.prototype.loadBuffers = function () {
        new pc.GLBHelpers.BuffersLoader(this, this.parseAll.bind(this)).load();
    };

    AnimLoaderContext.prototype.parseAll = function () {
        try {
            var nodeLoader = new pc.GLBHelpers.NodeLoader();
            this.parse('nodes', nodeLoader.translate.bind(nodeLoader));
            var animLoader = new pc.GLBHelpers.AnimationLoader();
            this.parse('animations', animLoader.translate.bind(animLoader));
            this._onLoaded(this.animations);
        } catch (err) {
            this._onFailed(err);
        }
    };

    AnimLoaderContext.prototype.parse = function (property, translator) {
        if (this.gltf.hasOwnProperty(property)) {
            var arr = this.gltf[property];
            this[property] = new Array(arr.length);
            for (var idx = 0; idx < arr.length; idx++) {
                this[property][idx] = translator(this, arr[idx]);
            }
        }
    };

    return {
        GlbAnimationsParser: GlbAnimationsParser
    };
}());
