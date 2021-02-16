import { events } from '../core/events.js';

import { ScriptHandler } from '../resources/script.js';

import { getApplication } from './globals.js';

/**
 * @name script
 * @namespace
 * @description The script namespace holds the createLoadingScreen function that
 * is used to override the default PlayCanvas loading screen.
 */
var _legacy = false;

// flag to avoid creating multiple loading screens e.g. when
// loading screen scripts are reloaded
var _createdLoadingScreen = false;

var script = {
    // set during script load to be used for initializing script
    app: null,

    /**
     * @private
     * @function
     * @name script.create
     * @description Create a script resource object. A script file should contain a single call to {@link script.create} and the callback should return a script object which will be
     * instantiated when attached to Entities.
     * @param {string} name - The name of the script object.
     * @param {callbacks.CreateScript} callback - The callback function which is passed an {@link Application} object,
     * which is used to access Entities and Components, and should return the Type of the script resource
     * to be instanced for each Entity.
     * @example
     * pc.script.create(function (app) {
     *     var Scriptable = function (entity) {
     *         // store entity
     *         this.entity = entity;
     *
     *         // use app
     *         app.components.model.addComponent(entity, {
     *             // component properties
     *         });
     *     };
     *
     *     return Scriptable;
     * });
     */
    create: function (name, callback) {
        if (!_legacy)
            return;

        // get the ScriptType from the callback
        var ScriptType = callback(script.app);

        // store the script name
        ScriptType._pcScriptName = name;

        // Push this onto loading stack
        ScriptHandler._push(ScriptType);

        this.fire("created", name, callback);
    },

    /**
     * @private
     * @function
     * @name script.attribute
     * @description Creates a script attribute for the current script. The script attribute can be accessed
     * inside the script instance like so 'this.attributeName' or outside a script instance like so 'entity.script.attributeName'.
     * Script attributes can be edited from the Attribute Editor of the PlayCanvas Editor like normal Components.
     * @param {string} name - The name of the attribute.
     * @param {string} type - The type of the attribute. Can be: 'number', 'string', 'boolean', 'asset', 'entity', 'rgb', 'rgba', 'vector', 'enumeration', 'curve', 'colorcurve'.
     * @param {object} defaultValue - The default value of the attribute.
     * @param {object} options - Optional parameters for the attribute.
     * @param {number} options.min - The minimum value of the attribute.
     * @param {number} options.max - The maximum value of the attribute.
     * @param {number} options.step - The step that will be used when changing the attribute value in the PlayCanvas Editor.
     * @param {number} options.decimalPrecision - A number that specifies the number of decimal digits allowed for the value.
     * @param {object[]} options.enumerations - An array of name, value pairs from which the user can select one if the attribute type is an enumeration.
     * @param {string[]} options.curves - (For 'curve' attributes only) An array of strings that define the names of each curve in the curve editor.
     * @param {boolean} options.color - (For 'curve' attributes only) If true then the curve attribute will be a color curve.
     * @example
     * pc.script.attribute('speed', 'number', 5);
     * pc.script.attribute('message', 'string', "My message");
     * pc.script.attribute('enemyPosition', 'vector', [1, 0, 0]);
     * pc.script.attribute('spellType', 'enumeration', 0, {
     *     enumerations: [{
     *         name: "Fire",
     *         value: 0
     *     }, {
     *         name: "Ice",
     *         value: 1
     *     }]
     * });
     * pc.script.attribute('enemy', 'entity');
     * pc.script.attribute('enemySpeed', 'curve');
     * pc.script.attribute('enemyPosition', 'curve', null, {
     *     curves: ['x', 'y', 'z']
     * });
     * pc.script.attribute('color', 'colorcurve', null, {
     *     type: 'rgba'
     * });
     *
     * pc.script.create('scriptable', function (app) {
     *     var Scriptable = function (entity) {
     *         // store entity
     *         this.entity = entity;
     *     };
     *
     *     return Scriptable;
     * });
     */
    attribute: function (name, type, defaultValue, options) {
        // only works when parsing the script...
    },

    /**
     * @function
     * @name script.createLoadingScreen
     * @description Handles the creation of the loading screen of the application. A script can subscribe to
     * the events of a {@link Application} to show a loading screen, progress bar etc. In order for this to work
     * you need to set the project's loading screen script to the script that calls this method.
     * @param {callbacks.CreateScreen} callback - A function which can set up and tear down a customised loading screen.
     * @example
     * pc.script.createLoadingScreen(function (app) {
     *     var showSplashScreen = function () {};
     *     var hideSplashScreen = function () {};
     *     var showProgress = function (progress) {};
     *     app.on("preload:start", showSplashScreen);
     *     app.on("preload:progress", showProgress);
     *     app.on("start", hideSplashScreen);
     * });
     */
    createLoadingScreen: function (callback) {
        if (_createdLoadingScreen)
            return;

        _createdLoadingScreen = true;

        var app = getApplication();
        callback(app);
    }
};

Object.defineProperty(script, 'legacy', {
    get: function () {
        return _legacy;
    },
    set: function (value) {
        _legacy = value;
    }
});

events.attach(script);

export { script };
