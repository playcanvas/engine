/**
 *
 *  JACK :: JavaScript Mocking.
 *  Version: $Id$
 *
 */


function jack() {} // This needs to be here to make error reporting work correctly in IE.

(function (){ // START HIDING FROM GLOBAL SCOPE
    /** EXPORT JACK **/
    window.jack = new Jack();
    window.jack.matchers = new Matchers();
    window.jack.util = new Util();
    window.jack.FunctionSpecification = FunctionSpecification;
    window.jack.FunctionGrab = FunctionGrab;
    return;


    /**
     * Constructor for object that will be exposed as the global jack
     */
    function Jack() {
        var functionGrabs = {};
        var objectGrabs = {};
        var environment = new Environment();
        var reportMessages = [];
        var currentExpectation = null;
        var publicApi = createPublicApi();
        return publicApi;

        function createPublicApi() {
            var api = jackFunction;
            api.grab = grab;
            api.create = create;
            api.inspect = inspect;
            api.expect = expect;
            api.verify = verify;
            api.report = report;
            api.reportAll = reportAll;
            api.env = environment;
            return api;
        }
        function jackFunction(delegate) {
            before();
            firstPass(delegate);
            // secondPass(delegate);
            after();
        }
        function before() {
            functionGrabs = {};
            objectGrabs = {};
            environment.reset();
        }
        function firstPass(delegate) {
            delegate();
        }
        function secondPass(delegate) {
            var oldExpect = publicApi.expect;
            publicApi.expect = function(name) {
                var fakeEx = {};
                var grab = findGrab(name);
                if(grab._beenThroughSecondPass) {
                    var ex = grab.expect();
                    for(prop in ex) {
                        if(typeof ex[prop] == "function") {
                            fakeEx[prop] = function() { return fakeEx; }
                        }
                    }
                }
                grab._beenThroughSecondPass = true;
                return fakeEx;
            };
            var findMore = true;
            for(var i=0; findMore && i<10; i++) {
                try {
                    delegate();
                    findMore = false;
                } catch(exception) {
                    var line = -1;
                    if(exception.lineNumber != null) {
                        line = exception.lineNumber;
                    } else if(exception['opera#sourceloc'] != null) {
                        line = exception['opera#sourceloc'];
                    }
                    currentExpectation._lineNumber = line;
                }
            }
            publicApi.expect = oldExpect;
        }
        function after() {
            var reports = getTextReports();
            resetGrabs();
            if(reports.length > 0) {
                environment.report(reports[0]);
            }
        }
        function getTextReports() {
            var failedReports = [];
            for(var name in functionGrabs) {
                var reports = functionGrabs[name].reportAll(name);
                for(var i=0; i<reports.length; i++) {
                    if(reports[i].fail) {
                        failedReports.push(reports[i].message);
                    }
                }
            }
            for(var name in objectGrabs) {
                var reports = objectGrabs[name].report(name);
                for(var i=0; i<reports.length; i++) {
                    if(reports[i].fail) {
                        failedReports.push(reports[i].message);
                    }
                }
            }
            return failedReports;
        }
        function grab() {
            if("object" == typeof arguments[0] && "string" == typeof arguments[1]) {
                var parentObject = arguments[0];
                var name = arguments[1];
                var fullName = "[local]." + name;
                return grabFunction(fullName, parentObject[name], parentObject);
            } else {
                var grabbed = null;
                eval("grabbed = " + arguments[0]);
                if("function" == typeof grabbed) {
                    var functionGrab = grabFunction(arguments[0], grabbed);
                    eval("grabbed = " + arguments[0]);
                    grabObject(arguments[0], grabbed);
                    return functionGrab;
                } else if("object" == typeof grabbed) {
                    return grabObject(arguments[0], grabbed);
                }
                return null;
            }
        }
        function grabFunction(fullName, grabbed, parentObject) {
            if(parentObject == null) {
                parentObject = window;
            }
            var functionName = fullName;
            var nameParts = fullName.split(".");
            if(nameParts[0] == "[local]") {
                functionName = nameParts[1];
            } else if(nameParts.length > 1) {
                functionName = nameParts.pop();
                if(parentObject == window) {
                    var parentName = nameParts.join(".");
                    eval("parentObject = " + parentName);
                }
            }
            functionGrabs[fullName] = new FunctionGrab(functionName, grabbed, parentObject);
            return functionGrabs[fullName];
        }
        function grabObject(name, grabbed) {
            objectGrabs[name] = new ObjectGrab(name, grabbed);
            return objectGrabs[name];
        }
        function create(objectName, functionNames) {
            var mockObject = {};
            for(var i=0; i<functionNames.length; i++) {
                mockObject[functionNames[i]] = function() {};
                var fullName = objectName+"."+functionNames[i];
                grabFunction(fullName, mockObject[functionNames[i]], mockObject);
            }
            return mockObject;
        }
        function inspect(name) {
            return findGrab(name);
        }
        function expect(name) {
            if(findGrab(name) == null) {
                grab(name);
            }
            currentExpectation = findGrab(name).expect().once();
            return currentExpectation;
        }
        function verify(name) {
            if(findGrab(name) == null) {
                grab(name);
            }
            currentExpectation = findGrab(name).expect().once();
            return currentExpectation;
        }
        function report(name, expectation) {
            return findGrab(name).report(expectation, name);
        }
        function reportAll(name) {
            return findGrab(name).reportAll(name);
        }
        function findGrab(name) {
            var parts = name.split(".");
            if(parts.length == 1 && functionGrabs[name] != null) {
                return functionGrabs[name];
            } else if(parts.length == 1 && objectGrabs[name] != null) {
                return objectGrabs[name];
            } else {
                if(functionGrabs[name] != null) {
                    return functionGrabs[name];
                }
                if(objectGrabs[name] != null) {
                    return objectGrabs[name];
                }
                if(objectGrabs[parts[0]] != null) {
                    return objectGrabs[parts[0]].examine(parts[1]);
                }
                return undefined;
            }
        }
        function resetGrabs() {
            for(var g in functionGrabs) {
                functionGrabs[g].reset();
            }
            for(var g in objectGrabs) {
                objectGrabs[g].reset();
            }
        }
    } // END Jack()


    /**
     * @functionName      Name of grabbed function
     * @grabbedFunction   Reference to grabbed function
     * @parentObject      The object the function was grabbed from
     */
    function FunctionGrab(functionName, grabbedFunction, parentObject) {
        var invocations = [];
        var specifications = [];
        var emptyFunction = function(){};

        init();
        return {
            'times': function() { return invocations.length; },
            'reset': reset,
            'expect': expect,
            'specify': specify,
            'report': report,
            'reportAll': reportAll,
            'mock': mock,
            'stub': stub,
            'arguments': getArguments,
            'name': function() { return functionName }
        };

        function init() {
            var original = parentObject[functionName];
            var handler = function() {
                return handleInvocation.apply(this,arguments);
            }
            for(var prop in original) {
                handler[prop] = original[prop];
            }
            parentObject[functionName] = handler;
        }
        function handleInvocation() {
            var invocation = new FunctionSpecification();
            for(var i=0; i<arguments.length; i++) {
                invocation.whereArgument(i).is(arguments[i]);
            }
            invocations.push(invocation);
            var specification = findSpecificationFor(invocation);
            if(specification == null) {
                return grabbedFunction.apply(this, arguments);
            } else if(specification.hasMockImplementation()) {
                return specification.invoke.apply(this, arguments);
            } else {
                specification.invoke.apply(this, arguments);
                return grabbedFunction.apply(this, arguments);
            }
        }
        function matchInvocationsToSpecifications() {
            for(var i=0; i<invocations.length; i++) {
                var spec = findSpecificationFor(invocations[i]);
                if(spec != null) {

                }
            }
        }
        function findSpecificationFor(invocation) {
            for(var i=0; i<specifications.length; i++) {
                var specification = specifications[i];
                if(invocation.satisfies(specification)) {
                    return specification;
                }
            }
            return null;
        }
        function isArgumentContstraintsMatching(invocation, expectation) {
            var constr = expectation._argumentConstraints;
            var arg = invocation.arguments;
            if(constr == null) {
                return true;
            } else if(constr.length != arg.length) {
                return false;
            } else {
                for(var i=0; i<constr.length; i++) {
                    if(!constr[i]) { continue; }
                    for(var j=0; j<constr[i].length; j++) {
                        if(typeof constr[i][j] == "function" && !constr[i][j](arg[i])) {
                            return false;
                        }
                    }
                }
                return true;
            }
        }
        function reset() {
            parentObject[functionName] = grabbedFunction;
        }
        function specify() {
            var spec = new FunctionSpecification();
            spec._id = specifications.length;
            specifications.push(spec);
            return spec;
        }
        function verify() {

        }
        function expect() {
            return specify();
        }
        function mock(implementation) {
            return expect().mock(implementation);
        }
        function stub() {
            return expect();
        }
        function parseTimes(expression) {
            var result = 0;
            if("number" == typeof expression) {
                result = expression;
            } else if("string" == typeof expression) {
                var parts = expression.split(" ");
                result = parseInt(parts[0]);
            }
            return result;
        }
        function reportAll(fullName) {
            var reports = [];
            for(var i=0; i<specifications.length; i++) {
                reports.push(report(specifications[i], fullName));
            }
            return reports;
        }
        function report(specification, fullName) {
            if(specification == null) {
                if(specifications.length == 0) {
                    var spec = specify().never();
                    for(var i=0; i<invocations.length; i++) {
                        spec.invoke();
                    }
                }
                specification = specifications[0];
            }
            var report = {};
            report.expected = specification.invocations().expected;
            report.actual = specification.invocations().actual;
            report.success = specification.testTimes(report.actual);
            report.fail = !report.success;
            if(report.fail) {
                report.message = "Expectation failed: " + specification.describe(fullName);
            }
            return report;
        }
        function generateReportMessage(report, fullName, argumentsDisplay) {
            return report.messageParts.template
                    .replace("{name}",fullName)
                    .replace("{arguments}",argumentsDisplay)
                    .replace("{quantifier}",report.messageParts.quantifier)
                    .replace("{expected}",report.expected)
                    .replace("{actual}",report.actual);
        }
        function getArgumentsDisplay(expectation) {
            if(expectation == null) {
                return "";
            }
            var displayValues = [];
            var constraints = expectation._argumentConstraints;
            if(constraints == null) {
                return "";
            } else {
                for(var i=0; i<constraints.length; i++) {
                    if(constraints[i] != null) {
                        displayValues.push(constraints[i][0].display);
                    } else {
                        displayValues.push('[any]');
                    }
                }
                return displayValues.join(', ');
            }
        }
        function getArguments() {
            return invocations[0].getArgumentValues();
        }
    } // END FunctionGrab()


    /**
     *
     */
    function ObjectGrab(objectName, grabbedObject) {
        var grabs = {};

        init();
        return {
            'examine': getGrab,
            'report': report,
            'getGrab': getGrab,
            'getGrabs': function() {  return grabs },
            'reset': reset
        };

        function init() {
            for(key in grabbedObject) {
                var property =  grabbedObject[key];
                if("function" == typeof property) {
                    grabs[key] = new FunctionGrab(key, property, grabbedObject);
                }
            }
        }
        function report(name) {
            var allReports = [];
            for(var g in grabs) {
                var reports = grabs[g].reportAll(name+"."+grabs[g].name());
                for(var i=0; i<reports.length; i++) {
                    allReports.push(reports[i]);
                }
            }
            return allReports;
        }
        function getGrab(name) {
            return grabs[name];
        }
        function reset() {
            for(var g in grabs) {
                grabs[g].reset();
            }
        }
    }


    /**
     *
     */
    function Environment() {
        var reportingEnabled = true;
        init();
        return {
            'isJSSpec': isJSSpec,
            'isScriptaculous': isScriptaculous,
            'isQunit': isQunit,
            'isJsTestDriver': isJsTestDriver,
            'isYuiTest': isYuiTest,
            'report': report,
            'disableReporting': function() { reportingEnabled = false; },
            'enableReporting': function() { reportingEnabled = true; },
            'reset': function() {}
        }
        function init() {

        }
        function isJSSpec() {
            return window.JSSpec != null;
        }
        function isScriptaculous() {
            return window.Test != null && window.Test.Unit != null && window.Test.Unit.Runner != null;
        }
        function isQunit() {
            return window.QUnit != null;
        }
        function isJsTestDriver() {
            return window.jstestdriver != null;
        }
        function isYuiTest() {
            var y = window.YAHOO;
            return y != null && y.tool != null && y.tool.TestCase != null;
        }
        function report(message) {
            if(!reportingEnabled) { return; }
            if(isYuiTest()) {
                YAHOO.util.Assert.fail(message);
            } else if(isJsTestDriver()) {
                fail(message);
            } else if(isScriptaculous()) {
                throw new Error(message);
            } else if(isQunit()) {
                ok(false, message);
            } else if(isJSSpec()) {
                throw new Error(message);
            }
        }
    }

    /**
     *
     */
    function Util() {
        return {
            'displayValue': displayValue
        }

        function displayValue() {
            var value = arguments[0];
            var prefix = "";
            if(arguments.length > 1) {
                value = arguments[1];
                prefix = arguments[0];
            }
            if(value == undefined) {
                return displayValueNullOrUndefined(value);
            }
            var display = displayValueDefault(value);
            if('string' == typeof value) {
                display = displayValueString(value);
            } else if(value.constructor == Array) {
                display = displayValueArray(value);
            } else if(value.constructor == RegExp) {
                display = displayValueRegExp(value);
            } else if('object' == typeof value) {
                display = displayValueObject(value);
            }
            return prefix + display;
        }
        function displayValueDefault(value) {
            return value.toString();
        }
        function displayValueString(value) {
            return "'" + value + "'";
        }
        function displayValueArray(value) {
            var displayValues = [];
            for(var i=0; i<value.length; i++) {
                displayValues.push(displayValue(value[i]));
            }
            return "[" + displayValues.join(",") + "]";
        }
        function displayValueNullOrUndefined(value) {
            if(value === undefined) {
                return "undefined";
            } else if(value === null) {
                return "null";
            }
        }
        function displayValueRegExp(value) {
            return value.toString();
        }
        function displayValueObject(value) {
            var keyValues = [];
            for(var p in value) {
                keyValues.push(p + ':' + displayValue(value[p]));
            }
            return '{' + keyValues.join(',') + '}';
        }
    }

    /**
     *
     */
    function FunctionSpecification() {
        var constraints = null;
        var argumentValues = [];
        var mockImplementation = null;
        var timing = {actual: 0, expected: 1, modifier: 0};

        var api = createApi();
        return api;

        function createApi() {
            var api = {};
            mixinMatchers(api);
            mixinTiming(api);
            api.test = test;
            api.testTimes = testTimes;
            api.satisfies = satisfies;
            api.invoke = invoke;
            api.mock = mock;
            api.stub = stub;
            api.returnValue = returnValue;
            api.returnValues = returnValues;
            api.describe = describe;
            api.invocations = invocations;
            api.getArgumentValues = getArgumentValues;
            api.hasMockImplementation = hasMockImplementation;
            return api;
        }
        function mixinMatchers(api) {
            api.whereArgument = function(argIndex) {
                var collected = {};
                for(var name in jack.matchers) {
                    addMatcher(argIndex, name, collected)
                }
                return collected;
            }
            api.withArguments = function() {
                for(var i=0; i<arguments.length; i++) {
                    api.whereArgument(i).is(arguments[i]);
                }
                return api;
            }
            api.withNoArguments = function() { constraints = []; return api; }
            return api;

            function addMatcher(argIndex, name, collection) {
                collection[name] = function() {
                    addConstraint(argIndex, jack.matchers[name], arguments);
                    if(name == "is") {
                        addArgumentValue(argIndex, arguments[0]);
                    }
                    return api;
                }
            }
        }
        function mixinTiming(api) {
            api.exactly = function(times) {
                timing.expected = parseTimes(times);
                return api;
            }
            api.once = function() {
                timing.expected = 1;
                return api;
            }
            api.atLeast = function(times) {
                timing.expected = parseTimes(times);
                timing.modifier = 1;
                return api;
            }
            api.atMost = function(times) {
                timing.expected = parseTimes(times);
                timing.modifier = -1;
                return api;
            }
            api.never = function() {
                timing.expected = 0;
                return api;
            }

            function parseTimes(times) {
                return parseInt(times);
            }
        }
        function addArgumentValue(index, value) {
            argumentValues[index] = value;
        }
        function addConstraint(argIndex, matcher, matcherArguments) {
            createConstraintsArrayIfNull(argIndex);
            var constraint = function(value) {
                var allArguments = [value];
                for(var i=0; i<matcherArguments.length; i++) {
                    allArguments.push(matcherArguments[i]);
                }
                var test = matcher.apply(null, allArguments);
                return test.result;
            }
            constraints[argIndex].push(constraint);
            constraints[argIndex].describe = function() {
                var allArguments = [""];
                for(var i=0; i<matcherArguments.length; i++) {
                    allArguments.push(matcherArguments[i]);
                }
                return matcher.apply(null, allArguments).expected;
            }
        }
        function createConstraintsArrayIfNull(argIndex) {
            if(constraints == null) {
                constraints = [];
            }
            if(constraints[argIndex] == null) {
                constraints[argIndex] = [];
            }
        }
        function test() {
            var result = true;
            if(constraints != null) {
                if(constraints.length != arguments.length) {
                    result = false;
                } else {
                    for (var i = 0; i < constraints.length; i++) {
                        var oneArgumentsConstraints = constraints[i];
                        if (oneArgumentsConstraints != null) {
                            for (var j = 0; j < oneArgumentsConstraints.length; j++) {
                                var constraint = oneArgumentsConstraints[j];
                                if (constraint && !constraint(arguments[i])) {
                                    result = false;
                                }
                            }
                        }
                    }
                }
            }
            return result;
        }
        function testTimes(times) {
            if(timing.modifier == 0) {
                return times == timing.expected;
            } else if(timing.modifier == 1) {
                return times >= timing.expected;
            } else if(timing.modifier == -1) {
                return times <= timing.expected;
            }
        }
        function satisfies(other) {
            return other.test.apply(this, argumentValues);
        }
        function invoke() {
            timing.actual++;
            if(mockImplementation != null) {
                return mockImplementation.apply(this, arguments);
            }
        }
        function mock(implementation) {
            mockImplementation = implementation;
            return api;
        }
        function stub() {
            mockImplementation = function() {};
            return api;
        }
        function returnValue(value) {
            mockImplementation = function() {
                return value;
            }
        }
        function returnValues() {
            var values = [], orig = this;
            for (var i = 0, len = arguments.length; i < len; i++) { values.push(arguments[i]); }
            mockImplementation = function() {
                return values.shift();
            };
        }
        function hasMockImplementation() {
            return mockImplementation != null;
        }
        function invocations() {
            return {
                actual: timing.actual,
                expected: timing.expected
            };
        }
        function getArgumentValues() {
            return argumentValues;
        }
        function describe(name) {
            return name +"(" + describeConstraints() + ") " + describeTimes();
        }
        function describeConstraints() {
            if(constraints == null) {
                return "";
            }
            var descriptions = [];
            for(var i=0; i<constraints.length; i++) {
                if(constraints[i] != null) {
                    descriptions.push(constraints[i].describe());
                } else {
                    descriptions.push("[any]");
                }
            }
            return descriptions.join(", ");
        }
        function describeTimes() {
            var description = timing.expected;
            if(timing.expected == 1) {
                description += " time";
            } else {
                description += " times";
            }
            if(timing.modifier == 0) {
                description = "expected exactly " + description;
            } else if(timing.modifier > 0) {
                description = "expected at least " + description;
            } else if(timing.modifier < 0) {
                description = "expected at most " + description;
            }
            description += ", called " + timing.actual + " time";
            if(timing.actual != 1) {
                description += "s";
            }
            return description;
        }
    }


    /**
     *
     */
    function Matchers() {
        return {
            'is':
                function(a, b) {
                    return result(a==b, a, '', b);
                },
            'isNot':
                function(a, b) {
                    return result(a!=b, a, 'not:', b);
                },
            'isType':
                function(a, b) {
                    return result(b == typeof a, a, 'type:', b);
                },
            'matches':
                function(a, b) {
                    return result(b.test(a), a, 'matching:', b)
                },
            'hasProperty':
                function(a, b, c) {
                    var match = c ? a[b]==c : a[b]!=undefined;
                    var bDisplay = b;
                    if(c != null) {
                        bDisplay = {};
                        bDisplay[b] = c;
                    }
                    return result(match, a, 'property:', bDisplay)
                },
            'hasProperties':
                function(a, b) {
                    var match = true;
                    for(var p in b) {
                        if(a[p] != b[p]) {
                            match = false;
                        }
                    }
                    return result(match, a, 'properties:', b);
                },
            'isGreaterThan':
                function(a, b) {
                    return result(b < a, a, '>', b);
                },
            'isLessThan':
                function(a, b) {
                    return result(b > a, a, '<', b);
                },
            'isOneOf':
                function() {
                    var a = arguments[0];
                    var b = [];
                    for(var i=1; i<arguments.length; i++) {
                        b.push(arguments[i]);
                    }
                    var match = false;
                    for(var i=0; i<b.length; i++) {
                        if(b[i] == a) {
                            match = true;
                        }
                    }
                    return result(match, a, 'oneOf:', b);
                }
        }

        function result(match, actual, prefix, expected) {
            return {
                result: match,
                actual: jack.util.displayValue(actual),
                expected: jack.util.displayValue(prefix, expected)
            }
        }
    }

})(); // END HIDING FROM GLOBAL SCOPE











































