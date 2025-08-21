/**
 * The gizmo space defines the coordinate system in which the gizmo operates. This can be one of the
 * following:
 *
 * - 'local': The local coordinate space
 * - 'world': The world coordinate space
 *
 * @typedef {'local' | 'world'} GizmoSpace
 */

/**
 * The gizmo axis defines the direction in which the gizmo operates. This can be one of the
 * following:
 *
 * - 'x': The X axis
 * - 'y': The Y axis
 * - 'z': The Z axis
 * - 'yz': The YZ plane
 * - 'xz': The XZ plane
 * - 'xy': The XY plane
 * - 'xyz': The XYZ space
 * - 'f': The axis facing the camera
 *
 * @typedef {'x' | 'y' | 'z' | 'yz' | 'xz' | 'xy' | 'xyz' | 'f'} GizmoAxis
 */

/**
 * The gizmo drag mode defines how the gizmo is rendered while being dragged. This can be one of the
 * following:
 *
 * - 'show': always show the shapes
 * - 'hide': hide the shapes when dragging
 * - 'selected': show only the axis shapes for the affected axes
 *
 * @typedef {'show' | 'hide' | 'selected'} GizmoDragMode
 */

/**
 * Local coordinate space.
 *
 * @category Gizmo
 * @deprecated Use the literal 'local' instead - {@link GizmoSpace}
 */
export const GIZMOSPACE_LOCAL = 'local';

/**
 * World coordinate space.
 *
 * @category Gizmo
 * @deprecated Use the literal 'world' instead - {@link GizmoSpace}
 */
export const GIZMOSPACE_WORLD = 'world';

/**
 * Gizmo axis for the line X.
 *
 * @category Gizmo
 * @deprecated Use the literal 'x' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_X = 'x';

/**
 * Gizmo axis for the line Y.
 *
 * @category Gizmo
 * @deprecated Use the literal 'y' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_Y = 'y';

/**
 * Gizmo axis for the line Z.
 *
 * @category Gizmo
 * @deprecated Use the literal 'z' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_Z = 'z';

/**
 * Gizmo axis for the plane YZ.
 *
 * @category Gizmo
 * @deprecated Use the literal 'yz' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_YZ = 'yz';

/**
 * Gizmo axis for the plane XZ.
 *
 * @category Gizmo
 * @deprecated Use the literal 'xz' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_XZ = 'xz';

/**
 * Gizmo axis for the plane XY.
 *
 * @category Gizmo
 * @deprecated Use the literal 'xy' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_XY = 'xy';

/**
 * Gizmo axis for all directions XYZ.
 *
 * @category Gizmo
 * @deprecated Use the literal 'xyz' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_XYZ = 'xyz';

/**
 * Gizmo axis for facing the camera (facing the camera).
 *
 * @category Gizmo
 * @deprecated Use the literal 'f' instead - {@link GizmoAxis}.
 */
export const GIZMOAXIS_FACE = 'f';
