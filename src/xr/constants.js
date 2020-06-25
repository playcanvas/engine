/**
 * @constant
 * @type string
 * @name pc.XRTYPE_INLINE
 * @description Inline - always available type of session. It has limited features availability and is rendered
 * into HTML element.
 */
export var XRTYPE_INLINE = 'inline';

/**
 * @constant
 * @type string
 * @name pc.XRTYPE_VR
 * @description Immersive VR - session that provides exclusive access to VR device with best available tracking
 * features.
 */
export var XRTYPE_VR = 'immersive-vr';

/**
 * @constant
 * @type string
 * @name pc.XRTYPE_AR
 * @description Immersive AR - session that provides exclusive access to VR/AR device that is intended to be blended
 * with real-world environment.
 */
export var XRTYPE_AR = 'immersive-ar';

/**
 * @constant
 * @type string
 * @name pc.XRSPACE_VIEWER
 * @description Viewer - always supported space with some basic tracking capabilities.
 */
export var XRSPACE_VIEWER = 'viewer';

/**
 * @constant
 * @type string
 * @name pc.XRSPACE_LOCAL
 * @description Local - represents a tracking space with a native origin near the viewer at the time of creation.
 * The exact position and orientation will be initialized based on the conventions of the underlying platform.
 * When using this reference space the user is not expected to move beyond their initial position much, if at all,
 * and tracking is optimized for that purpose. For devices with 6DoF tracking, local reference spaces should
 * emphasize keeping the origin stable relative to the user’s environment.
 */
export var XRSPACE_LOCAL = 'local';

/**
 * @constant
 * @type string
 * @name pc.XRSPACE_LOCALFLOOR
 * @description Local Floor - represents a tracking space with a native origin at the floor in a safe position for
 * the user to stand. The y axis equals 0 at floor level, with the x and z position and orientation initialized
 * based on the conventions of the underlying platform. Floor level value might be estimated by the underlying
 * platform. When using this reference space, the user is not expected to move beyond their initial position much,
 * if at all, and tracking is optimized for that purpose. For devices with 6DoF tracking, local-floor reference
 * spaces should emphasize keeping the origin stable relative to the user’s environment.
 */
export var XRSPACE_LOCALFLOOR = 'local-floor';

/**
 * @constant
 * @type string
 * @name pc.XRSPACE_BOUNDEDFLOOR
 * @description Bounded Floor - represents a tracking space with its native origin at the floor, where the user
 * is expected to move within a pre-established boundary. Tracking in a bounded-floor reference space is optimized
 * for keeping the native origin and bounds geometry stable relative to the user’s environment.
 */
export var XRSPACE_BOUNDEDFLOOR = 'bounded-floor';

/**
 * @constant
 * @type string
 * @name pc.XRSPACE_UNBOUNDED
 * @description Unbounded - represents a tracking space where the user is expected to move freely around their
 * environment, potentially even long distances from their starting point. Tracking in an unbounded reference space
 * is optimized for stability around the user’s current position, and as such the native origin may drift over time.
 */
export var XRSPACE_UNBOUNDED = 'unbounded';

/**
 * @constant
 * @type string
 * @name pc.XRTARGETRAY_GAZE
 * @description Gaze - indicates the target ray will originate at the viewer and follow the direction it is facing. (This is commonly referred to as a "gaze input" device in the context of head-mounted displays.)
 */
export var XRTARGETRAY_GAZE = 'gaze';

/**
 * @constant
 * @type string
 * @name pc.XRTARGETRAY_SCREEN
 * @description Screen - indicates that the input source was an interaction with the canvas element associated with an inline session’s output context, such as a mouse click or touch event.
 */
export var XRTARGETRAY_SCREEN = 'screen';

/**
 * @constant
 * @type string
 * @name pc.XRTARGETRAY_POINTER
 * @description Tracked Pointer - indicates that the target ray originates from either a handheld device or other hand-tracking mechanism and represents that the user is using their hands or the held device for pointing.
 */
export var XRTARGETRAY_POINTER = 'tracked-pointer';

/**
 * @constant
 * @type string
 * @name pc.XRHAND_NONE
 * @description None - input source is not meant to be held in hands.
 */
export var XRHAND_NONE = 'none';

/**
 * @constant
 * @type string
 * @name pc.XRHAND_LEFT
 * @description Left - indicates that input source is meant to be held in left hand.
 */
export var XRHAND_LEFT = 'left';

/**
 * @constant
 * @type string
 * @name pc.XRHAND_RIGHT
 * @description Right - indicates that input source is meant to be held in right hand.
 */
export var XRHAND_RIGHT = 'right';

/**
 * @constant
 * @type string
 * @name pc.XRTRACKABLE_POINT
 * @description Point - indicates that the hit test results will be computed based on the feature points detected by the underlying Augmented Reality system.
 */
export var XRTRACKABLE_POINT = 'point';

/**
 * @constant
 * @type string
 * @name pc.XRTRACKABLE_PLANE
 * @description Plane - indicates that the hit test results will be computed based on the planes detected by the underlying Augmented Reality system.
 */
export var XRTRACKABLE_PLANE = 'plane';

/**
 * @constant
 * @type string
 * @name pc.XRTRACKABLE_MESH
 * @description Mesh - indicates that the hit test results will be computed based on the meshes detected by the underlying Augmented Reality system.
 */
export var XRTRACKABLE_MESH = 'mesh';
