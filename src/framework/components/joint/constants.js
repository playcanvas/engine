/**
 * Joint rigidly locks all degrees of freedom, welding the two bodies together.
 *
 * @category Physics
 * @alpha
 */
export const JOINTTYPE_FIXED = 'fixed';

/**
 * Ball and socket joint. The bodies can rotate freely about the joint's anchor point. Optional
 * limits constrain the swing (cone) and twist angles.
 *
 * @category Physics
 * @alpha
 */
export const JOINTTYPE_BALL = 'ball';

/**
 * Hinge joint. The bodies can rotate about the joint's X axis, like a door hinge or a wheel
 * axle. Supports optional rotation limits and a motor.
 *
 * @category Physics
 * @alpha
 */
export const JOINTTYPE_HINGE = 'hinge';

/**
 * Slider (prismatic) joint. The bodies can translate along the joint's X axis, like a drawer
 * runner or a piston. Supports optional travel limits and a motor.
 *
 * @category Physics
 * @alpha
 */
export const JOINTTYPE_SLIDER = 'slider';

/**
 * Generic 6 degrees of freedom joint. Each linear and angular axis can be independently locked,
 * limited or free, with optional springs.
 *
 * @category Physics
 * @alpha
 */
export const JOINTTYPE_6DOF = '6dof';

/**
 * Specified degree of freedom has free movement.
 *
 * @category Physics
 * @alpha
 */
export const MOTION_FREE = 'free';

/**
 * Specified degree of freedom has limited movement.
 *
 * @category Physics
 * @alpha
 */
export const MOTION_LIMITED = 'limited';

/**
 * Specified degree of freedom is locked and allows no movement.
 *
 * @category Physics
 * @alpha
 */
export const MOTION_LOCKED = 'locked';
