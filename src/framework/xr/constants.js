/**
 * Inline - always available type of session. It has limited features availability and is rendered
 * into HTML element.
 *
 * @type {string}
 * @category XR
 */
export const XRTYPE_INLINE = 'inline';

/**
 * Immersive VR - session that provides exclusive access to VR device with best available tracking
 * features.
 *
 * @type {string}
 * @category XR
 */
export const XRTYPE_VR = 'immersive-vr';

/**
 * Immersive AR - session that provides exclusive access to VR/AR device that is intended to be
 * blended with real-world environment.
 *
 * @type {string}
 * @category XR
 */
export const XRTYPE_AR = 'immersive-ar';

/**
 * Viewer - always supported space with some basic tracking capabilities.
 *
 * @type {string}
 * @category XR
 */
export const XRSPACE_VIEWER = 'viewer';

/**
 * Local - represents a tracking space with a native origin near the viewer at the time of
 * creation. The exact position and orientation will be initialized based on the conventions of the
 * underlying platform. When using this reference space the user is not expected to move beyond
 * their initial position much, if at all, and tracking is optimized for that purpose. For devices
 * with 6DoF tracking, local reference spaces should emphasize keeping the origin stable relative
 * to the user's environment.
 *
 * @type {string}
 * @category XR
 */
export const XRSPACE_LOCAL = 'local';

/**
 * Local Floor - represents a tracking space with a native origin at the floor in a safe position
 * for the user to stand. The y axis equals 0 at floor level, with the x and z position and
 * orientation initialized based on the conventions of the underlying platform. Floor level value
 * might be estimated by the underlying platform. When using this reference space, the user is not
 * expected to move beyond their initial position much, if at all, and tracking is optimized for
 * that purpose. For devices with 6DoF tracking, local-floor reference spaces should emphasize
 * keeping the origin stable relative to the user's environment.
 *
 * @type {string}
 * @category XR
 */
export const XRSPACE_LOCALFLOOR = 'local-floor';

/**
 * Bounded Floor - represents a tracking space with its native origin at the floor, where the user
 * is expected to move within a pre-established boundary. Tracking in a bounded-floor reference
 * space is optimized for keeping the native origin and bounds geometry stable relative to the
 * user's environment.
 *
 * @type {string}
 * @category XR
 */
export const XRSPACE_BOUNDEDFLOOR = 'bounded-floor';

/**
 * Unbounded - represents a tracking space where the user is expected to move freely around their
 * environment, potentially even long distances from their starting point. Tracking in an unbounded
 * reference space is optimized for stability around the user's current position, and as such the
 * native origin may drift over time.
 *
 * @type {string}
 * @category XR
 */
export const XRSPACE_UNBOUNDED = 'unbounded';

/**
 * Gaze - indicates the target ray will originate at the viewer and follow the direction it is
 * facing. This is commonly referred to as a "gaze input" device in the context of head-mounted
 * displays.
 *
 * @type {string}
 * @category XR
 */
export const XRTARGETRAY_GAZE = 'gaze';

/**
 * Screen - indicates that the input source was an interaction with the canvas element associated
 * with an inline session's output context, such as a mouse click or touch event.
 *
 * @type {string}
 * @category XR
 */
export const XRTARGETRAY_SCREEN = 'screen';

/**
 * Tracked Pointer - indicates that the target ray originates from either a handheld device or
 * other hand-tracking mechanism and represents that the user is using their hands or the held
 * device for pointing.
 *
 * @type {string}
 * @category XR
 */
export const XRTARGETRAY_POINTER = 'tracked-pointer';

/**
 * None - view associated with a monoscopic screen, such as mobile phone screens.
 *
 * @type {string}
 * @category XR
 */
export const XREYE_NONE = 'none';

/**
 * Left - view associated with left eye.
 *
 * @type {string}
 * @category XR
 */
export const XREYE_LEFT = 'left';

/**
 * Right - view associated with right eye.
 *
 * @type {string}
 * @category XR
 */
export const XREYE_RIGHT = 'right';

/**
 * None - input source is not meant to be held in hands.
 *
 * @type {string}
 * @category XR
 */
export const XRHAND_NONE = 'none';

/**
 * Left - indicates that input source is meant to be held in left hand.
 *
 * @type {string}
 * @category XR
 */
export const XRHAND_LEFT = 'left';

/**
 * Right - indicates that input source is meant to be held in right hand.
 *
 * @type {string}
 * @category XR
 */
export const XRHAND_RIGHT = 'right';

/**
 * Point - indicates that the hit test results will be computed based on the feature points
 * detected by the underlying Augmented Reality system.
 *
 * @type {string}
 * @category XR
 */
export const XRTRACKABLE_POINT = 'point';

/**
 * Plane - indicates that the hit test results will be computed based on the planes detected by the
 * underlying Augmented Reality system.
 *
 * @type {string}
 * @category XR
 */
export const XRTRACKABLE_PLANE = 'plane';

/**
 * Mesh - indicates that the hit test results will be computed based on the meshes detected by the
 * underlying Augmented Reality system.
 *
 * @type {string}
 * @category XR
 */
export const XRTRACKABLE_MESH = 'mesh';

/**
 * CPU - indicates that depth sensing preferred usage is CPU. This usage path is guaranteed to be
 * supported.
 *
 * @type {string}
 * @category XR
 */
export const XRDEPTHSENSINGUSAGE_CPU = 'cpu-optimized';

/**
 * GPU - indicates that depth sensing preferred usage is GPU.
 *
 * @type {string}
 * @category XR
 */
export const XRDEPTHSENSINGUSAGE_GPU = 'gpu-optimized';

/**
 * Luminance Alpha - indicates that depth sensing preferred raw data format is Luminance Alpha.
 * This format is guaranteed to be supported.
 *
 * @type {string}
 * @category XR
 */
export const XRDEPTHSENSINGFORMAT_L8A8 = 'luminance-alpha';

/**
 * Float 32 - indicates that depth sensing preferred raw data format is Float 32.
 *
 * @type {string}
 * @category XR
 */
export const XRDEPTHSENSINGFORMAT_F32 = 'float32';
