const JSAsset = require('parcel-bundler/src/assets/JSAsset')
//const { parse } = require('ifdef-loader/preprocessor')

/*
JSAssetPlayCanvas JSAssetPlayCanvas {
  id: 'framework/components/registry.js',
  name: 'C:\\web\\playcanvas-engine\\src\\framework\\components\\registry.js',
  basename: 'registry.js',
  relativeName: 'framework/components/registry.js',
  options: {
    production: false,
    outDir: 'C:\\web\\playcanvas-engine\\build\\output',
    outFile: 'playcanvasbundle.js',
    publicURL: '/',
    watch: false,
    cache: true,
    cacheDir: 'C:\\web\\playcanvas-engine\\.cache',
    killWorkers: true,
    minify: false,
    target: 'browser',
    bundleNodeModules: false,
    hmr: false,
    https: false,
    logLevel: 3,
    entryFiles: [ 'C:\\web\\playcanvas-engine\\src\\playcanvas.js' ],
    hmrPort: 0,
    rootDir: 'C:\\web\\playcanvas-engine\\src',
    sourceMaps: true,
    hmrHostname: '',
    detailedReport: false,
    global: 'moduleName',
    autoinstall: false,
    scopeHoist: false,
    contentHash: false,
    throwErrors: true,
*/

class JSAssetPlayCanvas extends JSAsset {
	async pretransform() {
		// run the loader on the source
		//this.contents = parse(this.contents, { ...process.env })
		if (this.relativeName == "playcanvas.js") {
			console.log("JSAssetPlayCanvas", this);
		} else {
			this.contents = "// " + this.relativeName;
		}
		// continue the normal flow
		return await super.pretransform()
	}
}

module.exports = JSAssetPlayCanvas;
