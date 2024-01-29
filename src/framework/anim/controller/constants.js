/**
 * Used to set the anim state graph transition interruption source to no state.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_INTERRUPTION_NONE = 'NONE';

/**
 * Used to set the anim state graph transition interruption source as the previous state only.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_INTERRUPTION_PREV = 'PREV_STATE';

/**
 * Used to set the anim state graph transition interruption source as the next state only.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_INTERRUPTION_NEXT = 'NEXT_STATE';

/**
 * Used to set the anim state graph transition interruption sources as the previous state followed
 * by the next state.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_INTERRUPTION_PREV_NEXT = 'PREV_STATE_NEXT_STATE';

/**
 * Used to set the anim state graph transition interruption sources as the next state followed by
 * the previous state.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_INTERRUPTION_NEXT_PREV = 'NEXT_STATE_PREV_STATE';

/**
 * Used to set an anim state graph transition condition predicate as '>'.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_GREATER_THAN = 'GREATER_THAN';

/**
 * Used to set an anim state graph transition condition predicate as '<'.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_LESS_THAN = 'LESS_THAN';

/**
 * Used to set an anim state graph transition condition predicate as '>='.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_GREATER_THAN_EQUAL_TO = 'GREATER_THAN_EQUAL_TO';

/**
 * Used to set an anim state graph transition condition predicate as '<='.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_LESS_THAN_EQUAL_TO = 'LESS_THAN_EQUAL_TO';

/**
 * Used to set an anim state graph transition condition predicate as '==='.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_EQUAL_TO = 'EQUAL_TO';

/**
 * Used to set an anim state graph transition condition predicate as '!=='.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_NOT_EQUAL_TO = 'NOT_EQUAL_TO';

 /**
  * Used to set an anim state graph parameter as type integer.
  *
  * @type {string}
  * @category Animation
  */
export const ANIM_PARAMETER_INTEGER = 'INTEGER';

/**
 * Used to set an anim state graph parameter as type float.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_PARAMETER_FLOAT = 'FLOAT';

/**
 * Used to set an anim state graph parameter as type boolean.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_PARAMETER_BOOLEAN = 'BOOLEAN';

/**
 * Used to set an anim state graph parameter as type trigger.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_PARAMETER_TRIGGER = 'TRIGGER';

/**
 * @type {string}
 * @category Animation
 */
export const ANIM_BLEND_1D = '1D';

/**
 * @type {string}
 * @category Animation
 */
export const ANIM_BLEND_2D_DIRECTIONAL = '2D_DIRECTIONAL';

/**
 * @type {string}
 * @category Animation
 */
export const ANIM_BLEND_2D_CARTESIAN = '2D_CARTESIAN';

/**
 * @type {string}
 * @category Animation
 */
export const ANIM_BLEND_DIRECT = 'DIRECT';

/**
 * The starting state in an anim state graph layer.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_STATE_START = 'START';

/**
 * The ending state in an anim state graph layer.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_STATE_END = 'END';

/**
 * Used to indicate any state in an anim state graph layer.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_STATE_ANY = 'ANY';

export const ANIM_CONTROL_STATES = [ANIM_STATE_START, ANIM_STATE_END, ANIM_STATE_ANY];

/**
 * Used to indicate that a layers animations should overwrite all previous layers.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_LAYER_OVERWRITE = 'OVERWRITE';

/**
 * Used to indicate that a layers animations should blend additively with previous layers.
 *
 * @type {string}
 * @category Animation
 */
export const ANIM_LAYER_ADDITIVE = 'ADDITIVE';
