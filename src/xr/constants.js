/**
 * @constant
 * @type string
 * @name XRTYPE_INLINE
 * @description Inline - always available type of session. It has limited features availability and is rendered
 * into HTML element.
 */
export const XRTYPE_INLINE = 'inline';

/**
 * @constant
 * @type string
 * @name XRTYPE_VR
 * @description Immersive VR - session that provides exclusive access to VR device with best available tracking
 * features.
 */
export const XRTYPE_VR = 'immersive-vr';

/**
 * @constant
 * @type string
 * @name XRTYPE_AR
 * @description Immersive AR - session that provides exclusive access to VR/AR device that is intended to be blended
 * with real-world environment.
 */
export const XRTYPE_AR = 'immersive-ar';

/**
 * @constant
 * @type string
 * @name XRSPACE_VIEWER
 * @description Viewer - always supported space with some basic tracking capabilities.
 */
export const XRSPACE_VIEWER = 'viewer';

/**
 * @constant
 * @type string
 * @name XRSPACE_LOCAL
 * @description Local - represents a tracking space with a native origin near the viewer at the time of creation.
 * The exact position and orientation will be initialized based on the conventions of the underlying platform.
 * When using this reference space the user is not expected to move beyond their initial position much, if at all,
 * and tracking is optimized for that purpose. For devices with 6DoF tracking, local reference spaces should
 * emphasize keeping the origin stable relative to the user’s environment.
 */
export const XRSPACE_LOCAL = 'local';

/**
 * @constant
 * @type string
 * @name XRSPACE_LOCALFLOOR
 * @description Local Floor - represents a tracking space with a native origin at the floor in a safe position for
 * the user to stand. The y axis equals 0 at floor level, with the x and z position and orientation initialized
 * based on the conventions of the underlying platform. Floor level value might be estimated by the underlying
 * platform. When using this reference space, the user is not expected to move beyond their initial position much,
 * if at all, and tracking is optimized for that purpose. For devices with 6DoF tracking, local-floor reference
 * spaces should emphasize keeping the origin stable relative to the user’s environment.
 */
export const XRSPACE_LOCALFLOOR = 'local-floor';

/**
 * @constant
 * @type string
 * @name XRSPACE_BOUNDEDFLOOR
 * @description Bounded Floor - represents a tracking space with its native origin at the floor, where the user
 * is expected to move within a pre-established boundary. Tracking in a bounded-floor reference space is optimized
 * for keeping the native origin and bounds geometry stable relative to the user’s environment.
 */
export const XRSPACE_BOUNDEDFLOOR = 'bounded-floor';

/**
 * @constant
 * @type string
 * @name XRSPACE_UNBOUNDED
 * @description Unbounded - represents a tracking space where the user is expected to move freely around their
 * environment, potentially even long distances from their starting point. Tracking in an unbounded reference space
 * is optimized for stability around the user’s current position, and as such the native origin may drift over time.
 */
export const XRSPACE_UNBOUNDED = 'unbounded';

/**
 * @constant
 * @type string
 * @name XRTARGETRAY_GAZE
 * @description Gaze - indicates the target ray will originate at the viewer and follow the direction it is facing. This is commonly referred to as a "gaze input" device in the context of head-mounted displays.
 */
export const XRTARGETRAY_GAZE = 'gaze';

/**
 * @constant
 * @type string
 * @name XRTARGETRAY_SCREEN
 * @description Screen - indicates that the input source was an interaction with the canvas element associated with an inline session’s output context, such as a mouse click or touch event.
 */
export const XRTARGETRAY_SCREEN = 'screen';

/**
 * @constant
 * @type string
 * @name XRTARGETRAY_POINTER
 * @description Tracked Pointer - indicates that the target ray originates from either a handheld device or other hand-tracking mechanism and represents that the user is using their hands or the held device for pointing.
 */
export const XRTARGETRAY_POINTER = 'tracked-pointer';

/**
 * @constant
 * @type string
 * @name XRHAND_NONE
 * @description None - input source is not meant to be held in hands.
 */
export const XRHAND_NONE = 'none';

/**
 * @constant
 * @type string
 * @name XRHAND_LEFT
 * @description Left - indicates that input source is meant to be held in left hand.
 */
export const XRHAND_LEFT = 'left';

/**
 * @constant
 * @type string
 * @name XRHAND_RIGHT
 * @description Right - indicates that input source is meant to be held in right hand.
 */
export const XRHAND_RIGHT = 'right';

/**
 * @constant
 * @type string
 * @name XRTRACKABLE_POINT
 * @description Point - indicates that the hit test results will be computed based on the feature points detected by the underlying Augmented Reality system.
 */
export const XRTRACKABLE_POINT = 'point';

/**
 * @constant
 * @type string
 * @name XRTRACKABLE_PLANE
 * @description Plane - indicates that the hit test results will be computed based on the planes detected by the underlying Augmented Reality system.
 */
export const XRTRACKABLE_PLANE = 'plane';

/**
 * @constant
 * @type string
 * @name XRTRACKABLE_MESH
 * @description Mesh - indicates that the hit test results will be computed based on the meshes detected by the underlying Augmented Reality system.
 */
export const XRTRACKABLE_MESH = 'mesh';

/**
 * @constant
 * @type string
 * @name XRDEPTHSENSINGUSAGE_CPU
 * @description CPU - indicates that depth sensing preferred usage is CPU. This usage path is guaranteed to be supported.
 */
export const XRDEPTHSENSINGUSAGE_CPU = 'cpu-optimized';

/**
 * @constant
 * @type string
 * @name XRDEPTHSENSINGUSAGE_GPU
 * @description GPU - indicates that depth sensing preferred usage is GPU.
 */
export const XRDEPTHSENSINGUSAGE_GPU = 'gpu-optimized';

/**
 * @constant
 * @type string
 * @name XRDEPTHSENSINGFORMAT_L8A8
 * @description Luminance Alpha - indicates that depth sensing preferred raw data format is Luminance Alpha. This format is guaranteed to be supported.
 */
export const XRDEPTHSENSINGFORMAT_L8A8 = 'luminance-alpha';

/**
 * @constant
 * @type string
 * @name XRDEPTHSENSINGFORMAT_F32
 * @description Float 32 - indicates that depth sensing preferred raw data format is Float 32.
 */
export const XRDEPTHSENSINGFORMAT_F32 = 'float32';
