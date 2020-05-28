// https://parceljs.org/api.html
// Call like: node build\parcel.js

const fs = require('fs');
// Delete .cache folder, otherwise Parcel does nothing while developing this bundler
fs.rmdirSync(".cache", { recursive: true });

const Bundler = require('parcel-bundler');
const Path = require('path');

// Slow, but useful, dumps e.g. `parcel_dump_bundled.json` with complex structures etc. to analyze
var debug = true;

// https://stackoverflow.com/questions/11616630/how-can-i-print-a-circular-structure-in-a-json-like-format
// safely handles circular references
JSON.safeStringify = (obj, indent = 2) => {
	let cache = [];
	const retVal = JSON.stringify(
		obj,
		(key, value) =>
		typeof value === "object" && value !== null
		? cache.includes(value)
		? "circular..." // Duplicate reference found, discard key
		: cache.push(value) && value // Store value in our collection
		: value,
		indent
	);
	cache = null;
	return retVal;
};

// Single entrypoint file location:
//const entryFiles = Path.join(__dirname, './index.html');
const entryFiles = './src/playcanvas.js';

// OR: Multiple files with globbing (can also be .js)
// const entryFiles = './src/*.js';
// OR: Multiple files in an array
// const entryFiles = ['./src/index.html', './some/other/directory/scripts.js'];

// Bundler options
const options = {
	outDir: './build/output', // The out directory to put the build files in, defaults to dist
	outFile: 'playcanvasbundle.js', // The name of the outputFile
	publicUrl: '/', // The url to serve on, defaults to '/'
	watch: false, // Whether to watch the files and rebuild them on change, defaults to process.env.NODE_ENV !== 'production'
	cache: true, // Enabled or disables caching, defaults to true
	cacheDir: '.cache', // The directory cache gets put in, defaults to .cache
	contentHash: false, // Disable content hash from being included on the filename
	global: 'moduleName', // Expose modules as UMD under this name, disabled by default
	minify: false, // Minify files, enabled if process.env.NODE_ENV === 'production'
	scopeHoist: false, // Turn on experimental scope hoisting/tree shaking flag, for smaller production bundles
	target: 'browser', // Browser/node/electron, defaults to browser
	bundleNodeModules: false, // By default, package.json dependencies are not included when using 'node' or 'electron' with 'target' option above. Set to true to adds them to the bundle, false by default
	//https: { // Define a custom {key, cert} pair, use true to generate one or false to use http
	//	cert: './ssl/c.crt', // Path to custom certificate
	//	key: './ssl/k.key' // Path to custom key
	//},
	logLevel: 3, // 5 = save everything to a file, 4 = like 3, but with timestamps and additionally log http requests to dev server, 3 = log info, warnings & errors, 2 = log warnings & errors, 1 = log errors, 0 = log nothing
	hmr: false, // Enable or disable HMR while watching
	hmrPort: 0, // The port the HMR socket runs on, defaults to a random free port (0 in node.js resolves to a random free port)
	sourceMaps: true, // Enable or disable sourcemaps, defaults to enabled (minified builds currently always create sourcemaps)
	hmrHostname: '', // A hostname for hot module reload, default to ''
	detailedReport: false, // Prints a detailed report of the bundles, assets, filesizes and times, defaults to false, reports are only printed if watch is disabled
	autoInstall: false, // Enable or disable auto install of missing dependencies found during bundling
};

(async function() {
	// Initializes a bundler using the entrypoint location and options provided
	const bundler = new Bundler(entryFiles, options);
	bundler.addAssetType('js', require.resolve('./JSAssetPlayCanvas'));

	// `bundled` gets called once Parcel has successfully finished bundling, the main bundle instance gets passed to the callback
	bundler.on('bundled', (bundle) => {
		// bundler contains all assets and bundles, see documentation for details
		if (debug) {
			console.log("Event: bundled");
			fs.writeFileSync("parcel_dump_bundled.json", JSON.safeStringify(bundle));
		}
	});

	// `buildEnd` gets called after each build (aka including every rebuild), this also emits if an error occurred
	bundler.on('buildEnd', () => {
		if (debug) {
			console.log("Event: buildEnd");
		}
	});

	// `buildStart` gets called at the start of the first build, the entryFiles Array gets passed to the callback
	bundler.on('buildStart', entryPoints => {
		if (debug) {
			console.log("Event: buildStart");
			console.log("entryPoints", entryPoints);
		}
	});

	bundler.on('buildError', error => {
		if (debug) {
			console.log("Event: buildError");
			console.log("error", error);
		}
	});

	// Run the bundler, this returns the main bundle
	// Use the events if you're using watch mode as this promise will only trigger once and not for every rebuild
	const bundle = await bundler.bundle();
})();
