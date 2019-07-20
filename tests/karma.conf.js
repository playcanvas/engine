var fs = require('fs');
var path = require('path');

var release = process.argv.includes('--release');
var sourceFiles;

if (release) {
    console.log('Testing release build');
    sourceFiles = [path.resolve('build/output/playcanvas-latest.js')];
} else {
    console.log('Testing unbuilt sources');
    sourceFiles = fs.readFileSync('build/dependencies.txt').toString().split('\n').map(function (value) {
        return path.resolve(value.replace('../', ''));
    });
}

module.exports = function (config) {
    config.set({
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '..',

        // list of files / patterns to load in the browser
        files: sourceFiles.concat([
            // libraries
            'node_modules/sinon/pkg/sinon.js',
            'node_modules/chai/chai.js',

            // test environment setup
            'tests/setup.js',

            // test files - change this to a specific file in order to run a single suite
            'tests/**/test_*.js',

            // resources - list any files here that need to be loaded by tests (i.e. via XHR), or
            // need to be pre-loaded in order to provide helper functions etc.
            { pattern: 'tests/test-assets/**/*.*', included: false, served: true, watched: true, nocache: true },
            { pattern: 'tests/helpers/**/*.js', included: true, served: true, watched: true, nocache: true },
            { pattern: 'tests/framework/components/script/*.*', included: false, served: true, watched: true, nocache: true },
            { pattern: 'tests/input/simulate_event.js', included: true, served: true, watched: true, nocache: true },
            { pattern: 'examples/**/*.*', included: false, served: true, watched: true, nocache: true }
        ]),

        // Serve .gz files with Content-Encoding: gzip
        customHeaders: [{
            match: '.*.gz',
            name: 'Content-Encoding',
            value: 'gzip'
        }],

        // list of files / patterns to exclude
        exclude: [],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {},

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['spec'],

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,

        // browserConsoleLogOptions: config.LOG_WARN,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome'],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: process.argv.includes('--single-run'),

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: 1
    });
};
