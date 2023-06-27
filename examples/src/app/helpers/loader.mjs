import { Component } from 'react';
import * as pc from 'playcanvas';
/**
 * @typedef {object} ScriptLoaderProps
 * @property {string} name
 * @property {string} url
 */
/** @type {Component<ScriptLoaderProps>} */
const ScriptLoaderComponent = Component;
class ScriptLoader extends ScriptLoaderComponent {
    static ctor;
    /**
     * @param {ScriptLoaderProps} resource 
     * @param {pc.Application} [app] - Unused
     * @param {Function} onLoad 
     */
    static load(resource, app, onLoad) {
        fetch(resource.url)
            .then((response) => response.text())
            .then((data) => {
                window[resource.name] = (Function('module', 'exports', data).call(module, module, module.exports), module).exports;
                onLoad();
            });
    }
}
export {
    ScriptLoader
};
