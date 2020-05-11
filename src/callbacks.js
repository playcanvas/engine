'use strict';

/**
 * @name pc.callbacks
 * @namespace
 * @description Namespace for callback definitions.
 */

/**
 * @callback pc.callbacks.HandleEvent
 * @description Callback used by {@link pc.events} functions. Note the callback is limited to 8 arguments.
 * @param {*} [arg1] - First argument that is passed from caller.
 * @param {*} [arg2] - Second argument that is passed from caller.
 * @param {*} [arg3] - Third argument that is passed from caller.
 * @param {*} [arg4] - Fourth argument that is passed from caller.
 * @param {*} [arg5] - Fifth argument that is passed from caller.
 * @param {*} [arg6] - Sixth argument that is passed from caller.
 * @param {*} [arg7] - Seventh argument that is passed from caller.
 * @param {*} [arg8] - Eighth argument that is passed from caller.
 */

/**
 * @callback pc.callbacks.LoadAsset
 * @description Callback used by {@link pc.AssetRegistry#loadFromUrl} and called when an asset is loaded (or an error occurs).
 * @param {string|null} err - The error message is null if no errors were encountered.
 * @param {pc.Asset} [asset] - The loaded asset if no errors were encountered.
 */

/**
 * @callback pc.callbacks.FilterAsset
 * @description Callback used by {@link pc.AssetRegistry#filter} to filter assets.
 * @param {pc.Asset} asset - The current asset to filter.
 * @returns {boolean} Return `true` to include asset to result list.
 */

/**
 * @callback pc.callbacks.AssetReady
 * @description Callback used by {@link pc.Asset#ready} and called when an asset is ready.
 * @param {pc.Asset} asset - The ready asset.
 */

/**
 * @callback pc.callbacks.ConfigureApp
 * @description Callback used by {@link pc.Application#configure} when configuration file is loaded and parsed (or an error occurs).
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * @callback pc.callbacks.PreloadApp
 * @description Callback used by {@link pc.Application#preload} when all assets (marked as 'preload') are loaded.
 */

/**
 * @private
 * @deprecated
 * @callback pc.callbacks.LoadHierarchy
 * @description Callback used by {@link pc.Application#loadSceneHierarchy}.
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * @private
 * @deprecated
 * @callback pc.callbacks.LoadSettings
 * @description Callback used by {@link pc.Application#loadSceneSettings}.
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * @private
 * @deprecated
 * @callback pc.callbacks.LoadScene
 * @description Callback used by {@link pc.Application#loadScene}.
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * @callback pc.callbacks.LoadHierarchy
 * @description Callback used by {@link pc.SceneRegistry#loadSceneHierarchy}.
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * @callback pc.callbacks.LoadSettings
 * @description Callback used by {@link pc.SceneRegistry#loadSceneSettings}.
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * @private
 * @callback pc.callbacks.LoadScene
 * @description Callback used by {@link pc.SceneRegistry#loadScene}.
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {pc.Entity} [entity] - The loaded root entity if no errors were encountered.
 */


/**
 * @callback pc.callbacks.CalculateMatrix
 * @description Callback used by {@link pc.CameraComponent#calculateTransform} and {@link pc.CameraComponent#calculateProjection}.
 * @param {pc.Mat4} transformMatrix - Output of the function.
 * @param {number} view - Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT. Left and right are only used in stereo rendering.
 */

/**
 * @callback pc.callbacks.CalculateSortDistance
 * @description Callback used by {@link pc.Layer} to calculate the "sort distance" for a {@link pc.MeshInstance}, which determines its place in the render order.
 * @param {pc.MeshInstance} meshInstance - The mesh instance.
 * @param {pc.Vec3} cameraPosition - The position of the camera.
 * @param {pc.Vec3} cameraForward - The forward vector of the camera.
 */

/**
 * @callback pc.callbacks.VrCamera
 * @description Callback used by {@link pc.CameraComponent#enterVr} and {@link pc.CameraComponent#exitVr}.
 * @param {string|null} err - On success it is null on failure it is the error message.
 */

/**
 * @private
 * @callback pc.callbacks.CreateScript
 * @description Callback used by {@link pc.script.create}.
 * @param {pc.Application} app - The application.
 * @returns {object} Return the Type of the script resource to be instanced for each Entity.
 */

/**
 * @callback pc.callbacks.CreateScreen
 * @description Callback used by {@link pc.script.createLoadingScreen}.
 * @param {pc.Application} app - The application.
 */

/**
 * @callback pc.callbacks.LockMouse
 * @description Callback used by {@link pc.Mouse#enablePointerLock} and {@link pc.Application#disablePointerLock}.
 */

/**
 * @callback pc.callbacks.HttpResponse
 * @description Callback used by {@link pc.Http#get}, {@link pc.Http#post}, {@link pc.Http#put}, {@link pc.Http#del}, and {@link pc.Http#request}.
 * @param {number|string|Error|null} err - The error code, message, or exception in the case where the request fails.
 * @param {*} [response] - The response data if no errors were encountered. (format depends on response type: text, Object, ArrayBuffer, XML).
 */

/**
 * @callback pc.callbacks.ResourceHandler
 * @description Callback used by {@link pc.ResourceHandler#load} when a resource is loaded (or an error occurs).
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {*} [response] - The raw data that has been successfully loaded.
 */

/**
 * @callback pc.callbacks.ResourceLoader
 * @description Callback used by {@link pc.ResourceLoader#load} when a resource is loaded (or an error occurs).
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {*} [resource] - The resource that has been successfully loaded.
 */

/**
 * @callback pc.callbacks.AddParser
 * @description Callback used by {@link pc.ModelHandler#addParser} to decide on which parser to use.
 * @param {string} url - The resource url.
 * @param {object} data - The raw model data.
 * @returns {boolean} Return true if this parser should be used to parse the data into a {@link pc.Model}.
 */

/**
 * @callback pc.callbacks.FindNode
 * @description Callback used by {@link pc.GraphNode#find} and {@link pc.GraphNode#findOne} to search through a graph node and all of its descendants.
 * @param {pc.GraphNode} node - The current graph node.
 * @returns {boolean} Returning `true` will result in that node being returned from {@link pc.GraphNode#find} or {@link pc.GraphNode#findOne}.
 */

/**
 * @callback pc.callbacks.ForEach
 * @description Callback used by {@link pc.GraphNode#forEach} to iterate through a graph node and all of its descendants.
 * @param {pc.GraphNode} node - The current graph node.
 */

/**
 * @callback pc.callbacks.UpdateShader
 * @description Callback used by {@link pc.StandardMaterial#onUpdateShader}.
 * @param {object} options - An object with shader generator settings (based on current material and scene properties), that you can change and then return.
 * Properties of the object passed into this function are documented in {@link pc.StandardMaterial#onUpdateShader}.
 * @returns {object} Returned settings will be used by the shader.
 */

/**
 * @callback pc.callbacks.VrDisplay
 * @description Callback used by {@link pc.VrDisplay#requestPresent} and {@link pc.VrDisplay#exitPresent}.
 * @param {string|null} err - The error message if presenting fails, or null if the call succeeds.
 */

/**
 * @callback pc.callbacks.VrFrame
 * @description Callback used by {@link pc.VrDisplay#requestAnimationFrame}.
 */

/**
 * @callback pc.callbacks.XrError
 * @description Callback used by {@link pc.XrManager#endXr} and {@link pc.XrManager#startXr}.
 * @param {Error|null} err - The Error object or null if operation was successfull.
 */

/**
 * @callback pc.callbacks.XrHitTestStart
 * @description Callback used by {@link pc.XrHitTest#start} and {@link pc.XrHitTest#startForInputSource}.
 * @param {Error|null} err - The Error object if failed to create hit test source or null.
 * @param {pc.XrHitTestSource|null} hitTestSource - object that provides access to hit results against real world geometry.
 */
