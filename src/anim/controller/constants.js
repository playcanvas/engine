/**
 * @constant
 * @type {string}
 * @name pc.ANIM_INTERRUPTION_NONE
 * @description Used to set the anim state graph transition interruption source to no state.
 */
export const ANIM_INTERRUPTION_NONE = 'NONE';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_INTERRUPTION_PREV
  * @description Used to set the anim state graph transition interruption source as the previous state only.
  */
export const ANIM_INTERRUPTION_PREV = 'PREV_STATE';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_INTERRUPTION_NEXT
  * @description Used to set the anim state graph transition interruption source as the next state only.
  */
export const ANIM_INTERRUPTION_NEXT = 'NEXT_STATE';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_INTERRUPTION_PREV_NEXT
  * @description Used to set the anim state graph transition interruption sources as the previous state followed by the next state.
  */
export const ANIM_INTERRUPTION_PREV_NEXT = 'PREV_STATE_NEXT_STATE';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_INTERRUPTION_NEXT_PREV
  * @description Used to set the anim state graph transition interruption sources as the next state followed by the previous state.
  */
export const ANIM_INTERRUPTION_NEXT_PREV = 'NEXT_STATE_PREV_STATE';

 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_GREATER_THAN
  * @description Used to set an anim state graph transition condition predicate as '>'.
  */
export const ANIM_GREATER_THAN = 'GREATER_THAN';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_LESS_THAN
  * @description Used to set an anim state graph transition condition predicate as '<'.
  */
export const ANIM_LESS_THAN = 'LESS_THAN';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_GREATER_THAN_EQUAL_TO
  * @description Used to set an anim state graph transition condition predicate as '>='.
  */
export const ANIM_GREATER_THAN_EQUAL_TO = 'GREATER_THAN_EQUAL_TO';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_LESS_THAN_EQUAL_TO
  * @description Used to set an anim state graph transition condition predicate as '<='.
  */
export const ANIM_LESS_THAN_EQUAL_TO = 'LESS_THAN_EQUAL_TO';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_EQUAL_TO
  * @description Used to set an anim state graph transition condition predicate as '==='.
  */
export const ANIM_EQUAL_TO = 'EQUAL_TO';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_NOT_EQUAL_TO
  * @description Used to set an anim state graph transition condition predicate as '!=='.
  */
export const ANIM_NOT_EQUAL_TO = 'NOT_EQUAL_TO';

 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_PARAMETER_INTEGER
  * @description Used to set an anim state graph parameter as type integer.
  */
export const ANIM_PARAMETER_INTEGER = 'INTEGER';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_PARAMETER_FLOAT
  * @description Used to set an anim state graph parameter as type float.
  */
export const ANIM_PARAMETER_FLOAT = 'FLOAT';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_PARAMETER_BOOLEAN
  * @description Used to set an anim state graph parameter as type boolean.
  */
export const ANIM_PARAMETER_BOOLEAN = 'BOOLEAN';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_PARAMETER_TRIGGER
  * @description Used to set an anim state graph parameter as type trigger.
  */
export const ANIM_PARAMETER_TRIGGER = 'TRIGGER';

 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_BLEND_1D
  */
export const ANIM_BLEND_1D = '1D';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_BLEND_2D_DIRECTIONAL
  */
export const ANIM_BLEND_2D_DIRECTIONAL = '2D_DIRECTIONAL';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_BLEND_2D_CARTESIAN
  */
export const ANIM_BLEND_2D_CARTESIAN = '2D_CARTESIAN';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_BLEND_DIRECT
  */
export const ANIM_BLEND_DIRECT = 'DIRECT';

 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_STATE_START
  * @description The starting state in an anim state graph layer.
  */
export const ANIM_STATE_START = 'START';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_STATE_END
  * @description The ending state in an anim state graph layer.
  */
export const ANIM_STATE_END = 'END';
 /**
  * @constant
  * @type {string}
  * @name pc.ANIM_STATE_ANY
  * @description Used to indicate any state in an anim state graph layer.
  */
export const ANIM_STATE_ANY = 'ANY';

export const ANIM_CONTROL_STATES = [ANIM_STATE_START, ANIM_STATE_END, ANIM_STATE_ANY];
