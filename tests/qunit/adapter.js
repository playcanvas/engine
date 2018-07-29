// Adapted from https://github.com/karma-runner/karma-qunit/blob/master/src/adapter.js, in
// order to allow us to use our legacy version of QUnit (we're on v1.11.0pre, which isn't
// available on NPM).
//
// TODO: We should update to a more recent version of QUnit, or we migrate to Mocha or
//       something similar.

// MIT licensed: https://github.com/karma-runner/karma-qunit/blob/master/LICENSE
(function (window) {
    'use strict';

    function createQUnitConfig(karma, defaultConfig) { // eslint-disable-line no-unused-vars
        var config = defaultConfig || {};

        if (!karma.config || !karma.config.qunit) {
            return config;
        }

        for (var key in karma.config.qunit) {
            config[key] = karma.config.qunit[key];
        }

        return config;
    }

    function createQUnitStartFn(tc, runnerPassedIn) { // eslint-disable-line no-unused-vars
        return function () {
            var FIXTURE_ID = 'qunit-fixture';
            var runner = runnerPassedIn || window.QUnit;
            var totalNumberOfTest = 0;
            var timer = null;
            var testResult = {};
            var supportsTestTracking = false;
            var config = (tc.config && tc.config.qunit) || {};
            var qunitOldTimeout = 13;

            if (config.showUI) {
                var ui = document.createElement('div');
                ui.id = 'qunit';
                document.body.appendChild(ui);
            }

            if (runner.begin) {
                runner.begin(function(args) {
                    if (args && typeof args.totalTests === 'number') {
                        tc.info({ total: args.totalTests });
                        supportsTestTracking = true;
                    }

                    if (typeof document !== 'undefined' && document.getElementById && document.createElement && document.body) {
                        // Create a qunit-fixture element to match behaviour of regular qunit runner.
                        // The fixture is only created once when the runner begins.
                        // Resetting is handled by qunit
                        var fixture = document.getElementById(FIXTURE_ID);
                        if (!fixture) {
                            fixture = document.createElement('div');
                            fixture.id = FIXTURE_ID;
                            // style to match qunit runner's CSS
                            fixture.style.position = 'absolute';
                            fixture.style.left = '-10000px';
                            fixture.style.top = '-10000px';
                            fixture.style.width = '1000px';
                            fixture.style.height = '1000px';
                            document.body.appendChild(fixture);
                            if (typeof runner.config.fixture === 'undefined') {
                                runner.config.fixture = '';
                            }
                        }
                    }
                });
            }

            runner.done(function () {
                if (!supportsTestTracking) {
                    tc.info({ total: totalNumberOfTest });
                }

                tc.complete({
                    coverage: window.__coverage__
                });
            });

            runner.testStart(function (test) {
                totalNumberOfTest += 1;
                timer = new Date().getTime();
                testResult = { success: true, errors: [] };
            });

            runner.log(function (details) {
                if (!details.result) {
                    var msg = '';

                    if (details.message) {
                        msg += details.message + '\n';
                    }

                    if (typeof details.expected !== 'undefined') {
                        msg += 'Expected: ' + runner.dump.parse(details.expected) + '\nActual: ' + runner.dump.parse(details.actual) + '\n';
                    }

                    if (details.source) {
                        msg += details.source + '\n';
                    }

                    testResult.success = false;
                    testResult.errors.push(msg);
                }
            });

            runner.testDone(function (test) {
                var result = {
                    description: test.name,
                    suite: (test.module && [test.module]) || [],
                    success: testResult.success,
                    skipped: test.skipped,
                    log: testResult.errors || [],
                    time: new Date().getTime() - timer
                };

                if (result.description.indexOf('global failure') !== -1) {
                    return;
                }

                tc.result(result);
            });

            runner.load();

            // honor autostart config, useful for tests loaded asynchronously
            if (config.autostart !== false) {
                setTimeout(function () {
                    runner.start();
                }, qunitOldTimeout);
            }
        };
    }

    var config = createQUnitConfig(window.__karma__, {
        autostart: false
    });

    for (var key in config) {
        window.QUnit.config[key] = config[key];
    }

    if (window.removeEventListener) {
        window.removeEventListener('load', window.QUnit.load, false);
    } else if (window.detachEvent) {
        window.detachEvent('onload', window.QUnit.load);
    }

    window.__karma__.start = createQUnitStartFn(window.__karma__);
})(typeof window !== 'undefined' ? window : global);
