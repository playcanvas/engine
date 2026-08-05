export const SCRIPT_INITIALIZE = 'initialize';
export const SCRIPT_POST_INITIALIZE = 'postInitialize';
export const SCRIPT_UPDATE = 'update';
export const SCRIPT_POST_UPDATE = 'postUpdate';
export const SCRIPT_SWAP = 'swap';

/**
 * Script names that cannot be used, as they would clash with members of {@link ScriptComponent}
 * (a script is attached to its component as `component[scriptName]`) or {@link EventHandler}.
 *
 * @type {Set<string>}
 * @ignore
 */
export const reservedScriptNames = new Set([
    'system', 'entity', 'create', 'destroy', 'swap', 'move', 'data',
    'scripts', '_scripts', '_scriptsIndex', '_scriptsData',
    'enabled', '_oldState', 'onEnable', 'onDisable', 'onPostStateChange',
    '_onSetEnabled', '_checkState', '_onBeforeRemove',
    '_onInitializeAttributes', '_onInitialize', '_onPostInitialize',
    '_onUpdate', '_onPostUpdate',
    '_callbacks', '_callbackActive', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent',
    // 'worker' is reserved to prevent users from overwriting the native Worker constructor
    'worker'
]);
