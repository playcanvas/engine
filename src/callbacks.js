'use strict';

/**
 * @callback pc.EventCallback
 * @description Callback function used by {@link pc.events} functions. Note the callback is limited to 8 arguments.
 * @param {*} [arg1] First argument that is passed from caller
 * @param {*} [arg2] Second argument that is passed from caller
 * @param {*} [arg3] Third argument that is passed from caller
 * @param {*} [arg4] Fourth argument that is passed from caller
 * @param {*} [arg5] Fifth argument that is passed from caller
 * @param {*} [arg6] Sixth argument that is passed from caller
 * @param {*} [arg7] Seventh argument that is passed from caller
 * @param {*} [arg8] Eighth argument that is passed from caller
 */

/**
 * @callback pc.LoadAssetCallback
 * @description Callback function used by {@link pc.AssetRegistry#loadFromUrl} and called when an asset is loaded (or an error occurs).
 * @param {String|Null} err The error message is null if no errors were encountered.
 * @param {pc.Asset} [asset] The loaded asset if no errors were encountered.
 */

/**
 * @callback pc.FilterAssetCallback
 * @description Callback function used by {@link pc.AssetRegistry#filter} to filter assets.
 * @param {pc.Asset} asset The current asset to filter.
 * @returns {Boolean} Return `true` to include asset to result list.
 */

/**
 * @callback pc.AssetReadyCallback
 * @description Callback function used by {@link pc.Asset#ready} and called when an asset is ready.
 * @param {pc.Asset} asset The ready asset.
 */

/**
 * @callback pc.ConfigureCallback
 * @description Callback function used by {@link pc.Application#configure} when configuration file is loaded and parsed (or an error occurs).
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 */

/**
 * @callback pc.PreloadCallback
 * @description Callback function used by {@link pc.Application#preload} when all assets (marked as 'preload') are loaded.
 */

/**
 * @callback pc.LoadHierarchyCallback
 * @description Callback function used by {@link pc.Application#loadSceneHierarchy}.
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] The loaded root entity if no errors were encountered.
 */

/**
 * @callback pc.LoadSettingsCallback
 * @description Callback function used by {@link pc.Application#loadSceneSettings}.
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 */

/**
 * @private
 * @callback pc.LoadSceneCallback
 * @description Callback function used by {@link pc.Application#loadScene}.
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] The loaded root entity if no errors were encountered.
 */

/**
 * @callback pc.CalculateCallback
 * @description Callback function used by {@link pc.Application#calculateTransform} and {@link pc.Application#calculateProjection}.
 * @param {pc.Mat4} transformMatrix Output of the function.
 * @param {Number} view Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT. Left and right are only used in stereo rendering.
 */

/**
 * @callback pc.CameraVrCallback
 * @description Callback function used by {@link pc.CameraComponent#enterVr} and {@link pc.CameraComponent#exitVr}.
 * @param {String|Null} err On success it is null on failure it is the error message.
 */

/**
 * @private
 * @callback pc.CreateScriptCallback
 * @description Callback function used by {@link pc.script.create}.
 * @param {pc.Application} app The application.
 * @returns {Object} Return the Type of the script resource to be instanced for each Entity.
 */

/**
 * @callback pc.CreateScreenCallback
 * @description Callback function used by {@link pc.script.createLoadingScreen}.
 * @param {pc.Application} app The application.
 */

/**
 * @callback pc.LockMouseCallback
 * @description Callback function used by {@link pc.Mouse#enablePointerLock} and {@link pc.Application#disablePointerLock}.
 */

/**
 * @callback pc.HttpCallback
 * @description Callback function used by {@link pc.Http#get}, {@link pc.Http#post}, {@link pc.Http#put}, {@link pc.Http#del}, and {@link pc.Http#request}.
 * @param {Number|String|Error|Null} err The error code, message, or exception in the case where the request fails.
 * @param {*} [response] The response data if no errors were encountered. (format depends on response type: text, Object, ArrayBuffer, XML).
 */

/**
 * @callback pc.HandlerCallback
 * @description Callback function used by {@link pc.ResourceHandler#load} when a resource is loaded (or an error occurs).
 * @param {String|Null} err The error message in the case where the load fails.
 * @param {*} [response] The raw data that has been successfully loaded.
 */

/**
 * @callback pc.LoaderCallback
 * @description Callback function used by {@link pc.ResourceLoader#load} when a resource is loaded (or an error occurs).
 * @param {String|Null} err The error message in the case where the load fails.
 * @param {*} [resource] The resource that has been successfully loaded.
 */

/**
 * @callback pc.ParserCallback
 * @description Callback function used by {@link pc.ModelHandler#addParser} to decide on which parser to use.
 * @param {String} url The resource url.
 * @param {Object} data The raw model data.
 * @returns {Boolean} Return true if this parser should be used to parse the data into a {@link pc.Model}
 */

/**
 * @callback pc.FindNodeCallback
 * @description Callback function used by {@link pc.GraphNode#find} and {@link pc.GraphNode#findOne} to search through a graph node and all of its descendants.
 * @param {pc.GraphNode} node The current graph node.
 * @returns {Boolean} Returning `true` will result in that node being returned from {@link pc.GraphNode#find} or {@link pc.GraphNode#findOne}.
 */

/**
 * @callback pc.ForEachNodeCallback
 * @description Callback function used by {@link pc.GraphNode#forEach} to iterate through a graph node and all of its descendants.
 * @param {pc.GraphNode} node The current graph node.
 */

/**
 * @callback pc.UpdateShaderCallback
 * @description Callback function used by {@link pc.Application#onUpdateShader}.
 * @param {Object} options An object with shader generator settings (based on current material and scene properties), that you can change and then return.
 * Properties of the object passed into this function are documented in {@link pc.Application#onUpdateShader}.
 * @returns {Object} Returned settings will be used by the shader.
 */

/**
 * @callback pc.VrDisplayCallback
 * @description Callback function used by {@link pc.VrDisplay#requestPresent} and {@link pc.VrDisplay#exitPresent}.
 * @param {String|Null} err The error message if presenting fails, or null if the call succeeds.
 */

/**
 * @callback pc.VrFrameCallback
 * @description Callback function used by {@link pc.VrDisplay#requestAnimationFrame}.
 */
