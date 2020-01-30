'use strict';

/**
 * @name pc.callbacks
 * @namespace
 * @description Namespace for callback definitions.
 */

/**
 * @callback pc.callbacks.HandleEvent
 * @description Callback used by {@link pc.events} functions. Note the callback is limited to 8 arguments.
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
 * @callback pc.callbacks.LoadAsset
 * @description Callback used by {@link pc.AssetRegistry#loadFromUrl} and called when an asset is loaded (or an error occurs).
 * @param {String|Null} err The error message is null if no errors were encountered.
 * @param {pc.Asset} [asset] The loaded asset if no errors were encountered.
 */

/**
 * @callback pc.callbacks.FilterAsset
 * @description Callback used by {@link pc.AssetRegistry#filter} to filter assets.
 * @param {pc.Asset} asset The current asset to filter.
 * @returns {Boolean} Return `true` to include asset to result list.
 */

/**
 * @callback pc.callbacks.AssetReady
 * @description Callback used by {@link pc.Asset#ready} and called when an asset is ready.
 * @param {pc.Asset} asset The ready asset.
 */

/**
 * @callback pc.callbacks.ConfigureApp
 * @description Callback used by {@link pc.Application#configure} when configuration file is loaded and parsed (or an error occurs).
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 */

/**
 * @callback pc.callbacks.PreloadApp
 * @description Callback used by {@link pc.Application#preload} when all assets (marked as 'preload') are loaded.
 */

/**
 * @callback pc.callbacks.LoadHierarchy
 * @description Callback used by {@link pc.Application#loadSceneHierarchy}.
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] The loaded root entity if no errors were encountered.
 */

/**
 * @callback pc.callbacks.LoadSettings
 * @description Callback used by {@link pc.Application#loadSceneSettings}.
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 */

/**
 * @private
 * @callback pc.callbacks.LoadScene
 * @description Callback used by {@link pc.Application#loadScene}.
 * @param {String|Null} err The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] The loaded root entity if no errors were encountered.
 */

/**
 * @callback pc.callbacks.CalculateMatrix
 * @description Callback used by {@link pc.CameraComponent#calculateTransform} and {@link pc.CameraComponent#calculateProjection}.
 * @param {pc.Mat4} transformMatrix Output of the function.
 * @param {Number} view Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT. Left and right are only used in stereo rendering.
 */

/**
 * @private
 * @callback pc.callbacks.CreateScript
 * @description Callback used by {@link pc.script.create}.
 * @param {pc.Application} app The application.
 * @returns {Object} Return the Type of the script resource to be instanced for each Entity.
 */

/**
 * @callback pc.callbacks.CreateScreen
 * @description Callback used by {@link pc.script.createLoadingScreen}.
 * @param {pc.Application} app The application.
 */

/**
 * @callback pc.callbacks.LockMouse
 * @description Callback used by {@link pc.Mouse#enablePointerLock} and {@link pc.Application#disablePointerLock}.
 */

/**
 * @callback pc.callbacks.HttpResponse
 * @description Callback used by {@link pc.Http#get}, {@link pc.Http#post}, {@link pc.Http#put}, {@link pc.Http#del}, and {@link pc.Http#request}.
 * @param {Number|String|Error|Null} err The error code, message, or exception in the case where the request fails.
 * @param {*} [response] The response data if no errors were encountered. (format depends on response type: text, Object, ArrayBuffer, XML).
 */

/**
 * @callback pc.callbacks.ResourceHandler
 * @description Callback used by {@link pc.ResourceHandler#load} when a resource is loaded (or an error occurs).
 * @param {String|Null} err The error message in the case where the load fails.
 * @param {*} [response] The raw data that has been successfully loaded.
 */

/**
 * @callback pc.callbacks.ResourceLoader
 * @description Callback used by {@link pc.ResourceLoader#load} when a resource is loaded (or an error occurs).
 * @param {String|Null} err The error message in the case where the load fails.
 * @param {*} [resource] The resource that has been successfully loaded.
 */

/**
 * @callback pc.callbacks.AddParser
 * @description Callback used by {@link pc.ModelHandler#addParser} to decide on which parser to use.
 * @param {String} url The resource url.
 * @param {Object} data The raw model data.
 * @returns {Boolean} Return true if this parser should be used to parse the data into a {@link pc.Model}
 */

/**
 * @callback pc.callbacks.FindNode
 * @description Callback used by {@link pc.GraphNode#find} and {@link pc.GraphNode#findOne} to search through a graph node and all of its descendants.
 * @param {pc.GraphNode} node The current graph node.
 * @returns {Boolean} Returning `true` will result in that node being returned from {@link pc.GraphNode#find} or {@link pc.GraphNode#findOne}.
 */

/**
 * @callback pc.callbacks.ForEach
 * @description Callback used by {@link pc.GraphNode#forEach} to iterate through a graph node and all of its descendants.
 * @param {pc.GraphNode} node The current graph node.
 */

/**
 * @callback pc.callbacks.UpdateShader
 * @description Callback used by {@link pc.StandardMaterial#onUpdateShader}.
 * @param {Object} options An object with shader generator settings (based on current material and scene properties), that you can change and then return.
 * Properties of the object passed into this function are documented in {@link pc.StandardMaterial#onUpdateShader}.
 * @returns {Object} Returned settings will be used by the shader.
 */

/**
 * @callback pc.callbacks.XrError
 * @description Callback used by {@link pc.XrManager#endXr} and {@link pc.XrManager#startXr}.
 * @param {Error|Null} err The Error object or null if operation was successfull.
 */
