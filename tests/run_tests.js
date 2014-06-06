var system = require('system');
var fs = require('fs');
var page = require('webpage').create();
var file = fs.open('output.xml', 'w');
file.write('<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n');

console.log('start');
var url = system.args[1];
var urls = [
    url + '/tests/audio/test_audio.html',
    url + '/tests/core/test_core.html',
    url + '/tests/events/test_events.html',
    url + '/tests/framework/test_framework.html',
    url + '/tests/input/test_input.html',
    url + '/tests/math/test_math.html'
];

/**
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3001, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = false,
    interval = setInterval(function() {
        if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
            // If not time-out yet and condition not yet fulfilled
            condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
        } else {
            if(!condition) {
                // If condition still not fulfilled (timeout but condition is 'false')
                console.log("'waitFor()' timeout");
                phantom.exit(1);
            } else {
                // Condition fulfilled (timeout and/or condition is 'true')
                console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                clearInterval(interval); //< Stop this interval
            }
        }
    }, 100); //< repeat check every 250ms
};

if (system.args.length !== 2) {
    console.log('Usage: run-qunit.js URL');
    phantom.exit(1);
}


// Route "console.log()" calls from within the Page context to the main Phantom context (i.e. current "this")
page.onConsoleMessage = function(msg) {
    console.log(msg);
};

function run (urls) {
    var url = urls.pop();

    console.log('Begin Testing: ' + url)
    page.open(url, function(status){
        if (status !== "success") {
            console.log("Unable to access network");
            phantom.exit(1);
        } else {
            waitFor(function(){
                return page.evaluate(function(){
                    var el = document.getElementById('qunit-testresult');
                    if (el && el.innerText.match('completed')) {
                        return true;
                    }
                    return false;
                });
            }, function () {
                var output = page.evaluate(function () {
                    var results = document.getElementById('junit-xml');
                    if (results) {
                        return results.textContent;    
                    } else {
                        return null;
                    }
                    
                });

                if (output) {
                    var i, lines = output.split('\n');
                    for (i = 0; i < lines.length; i++) {
                        if (lines[i].indexOf('?xml') < 0 &&
                            lines[i].indexOf('testsuites') < 0) {
                            file.writeLine(lines[i]);    
                        }                        
                    }
                } else {
                    console.log ('Error: No test results found for: ' + url);
                }

                if (urls.length) {
                    run(urls);
                } else {
                    file.write('</testsuites>');
                    file.close();
                    phantom.exit();                    
                }
            });
        }
    });
};

run(urls);