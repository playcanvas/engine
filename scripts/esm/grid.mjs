import { Color, Grid as EngineGrid, Script, Vec2 } from 'playcanvas';

// whether the deprecated resolution has been warned about
let resolutionWarned = false;

/**
 * @import { AppBase, Entity } from 'playcanvas'
 */

/** @enum {string} */
const GridPlane = {
    XZ: 'xz',
    XY: 'xy',
    YZ: 'yz'
};

/**
 * Renders an anti-aliased reference grid with the engine's {@link EngineGrid | Grid}. Lines
 * through the origin are drawn in {@link Grid#colorX}, {@link Grid#colorY} and
 * {@link Grid#colorZ}. The levels of lines follow the zoom, as in Blender, and the grid follows
 * each camera that renders it and fades out with distance, unless {@link Grid#infinite} is cleared
 * to make it as large as the entity's scale.
 *
 * The script creates a render component on its entity. The grid lies at the entity's position and
 * rotation. Its scale sizes a grid that isn't infinite, but never its cells, so use
 * {@link Grid#spacing} for those.
 *
 * @example
 * gridEntity.addComponent('script');
 * gridEntity.script.create(Grid, {
 *     properties: {
 *         spacing: 1
 *     }
 * });
 * @category Rendering
 */
class Grid extends Script {
    static scriptName = 'grid';

    /**
     * @type {number}
     * @deprecated The levels of lines now follow the zoom; set {@link Grid#subdivisions} instead.
     * @ignore
     */
    static RESOLUTION_LOW = 0;

    /**
     * @type {number}
     * @deprecated The levels of lines now follow the zoom; set {@link Grid#subdivisions} instead.
     * @ignore
     */
    static RESOLUTION_MEDIUM = 1;

    /**
     * @type {number}
     * @deprecated The levels of lines now follow the zoom; set {@link Grid#subdivisions} instead.
     * @ignore
     */
    static RESOLUTION_HIGH = 2;

    /**
     * The engine grid this script drives.
     *
     * @type {EngineGrid}
     */
    grid = new EngineGrid(this.app.graphicsDevice);

    /**
     * @param {{ app: AppBase, entity: Entity }} args - The script arguments.
     */
    constructor(args) {
        super(args);

        // the grid exists from construction, so it is released even if the script never initializes
        this.on('destroy', () => {
            if (this.entity.render?.meshInstances === this.grid.meshInstances) {
                this.entity.removeComponent('render');
            }
            this.grid.destroy();
        });
    }

    initialize() {
        // check if the entity already has a render component
        if (this.entity.render) {
            console.error('The entity already has a render component.');
            return;
        }

        this.entity.addComponent('render', {
            meshInstances: this.grid.meshInstances,
            castShadows: false
        });

        this.on('enable', () => {
            this.grid.visible = true;
        });
        this.on('disable', () => {
            this.grid.visible = false;
        });
    }

    /**
     * @attribute
     * @title Plane
     * @description The plane the grid lies on, in the entity's local space.
     * @type {GridPlane}
     * @default 'xz'
     */
    set plane(value) {
        this.grid.plane = value;
    }

    get plane() {
        return this.grid.plane;
    }

    /**
     * @attribute
     * @title Spacing
     * @description The cell size in world units the levels of lines are scaled from.
     * @type {number}
     * @default 10
     */
    set spacing(value) {
        this.grid.spacing = value;
    }

    get spacing() {
        return this.grid.spacing;
    }

    /**
     * @attribute
     * @title Subdivisions
     * @description How many cells of each level span a cell of the level above, or 1 for a single
     * fixed level of cells of the spacing.
     * @type {number}
     * @default 10
     */
    set subdivisions(value) {
        this.grid.subdivisions = value;
    }

    get subdivisions() {
        return this.grid.subdivisions;
    }

    /**
     * @attribute
     * @title Infinite
     * @description Whether the grid has no edge, following the camera. When false, the grid is
     * as large as the entity's scale along the two axes of its plane, centered on the entity.
     * @type {boolean}
     * @default true
     */
    set infinite(value) {
        this.grid.infinite = value;
    }

    get infinite() {
        return this.grid.infinite;
    }

    /**
     * @attribute
     * @title Show Axes
     * @description Whether the lines through the origin are drawn in the colors of their axes.
     * @type {boolean}
     * @default true
     */
    set showAxes(value) {
        this.grid.showAxes = value;
    }

    get showAxes() {
        return this.grid.showAxes;
    }

    /**
     * @attribute
     * @title Axis Line Thickness
     * @description The thickness of the lines through the origin in CSS pixels.
     * @type {number}
     * @default 2
     */
    set axisLineThickness(value) {
        this.grid.axisLineThickness = value;
    }

    get axisLineThickness() {
        return this.grid.axisLineThickness;
    }

    /**
     * @attribute
     * @title Major Line Thickness
     * @description The thickness of the major lines in CSS pixels.
     * @type {number}
     * @default 1.5
     */
    set majorLineThickness(value) {
        this.grid.majorLineThickness = value;
    }

    get majorLineThickness() {
        return this.grid.majorLineThickness;
    }

    /**
     * @attribute
     * @title Minor Line Thickness
     * @description The thickness of the minor lines in CSS pixels.
     * @type {number}
     * @default 1
     */
    set minorLineThickness(value) {
        this.grid.minorLineThickness = value;
    }

    get minorLineThickness() {
        return this.grid.minorLineThickness;
    }

    /**
     * @attribute
     * @title Fade Range
     * @description The distances from the camera where the grid starts to fade out and where it
     * has faded out completely, the far one held inside 90% of the camera's far clip. A larger gap
     * fades the grid more softly.
     * @type {Vec2}
     * @default [400, 1000]
     */
    set fadeRange(value) {
        if (value instanceof Vec2) {
            this.grid.fadeRange = value;
        }
    }

    get fadeRange() {
        return this.grid.fadeRange;
    }

    /**
     * @attribute
     * @title Contrast
     * @description Whether the lines are black over a light part of the scene and white over a
     * dark one, instead of their colors, so they read against anything. The camera must capture
     * the scene color (CameraComponent#requestSceneColorMap).
     * @type {boolean}
     * @default false
     */
    set contrast(value) {
        this.grid.contrast = value;
    }

    get contrast() {
        return this.grid.contrast;
    }

    /**
     * @attribute
     * @title Axis Color X
     * @description The color of the line through the origin along the X axis.
     * @type {Color}
     * @default [1, 0.3, 0.3, 1]
     */
    set colorX(value) {
        if (value instanceof Color) {
            this.grid.setTheme({ axis: { x: value } });
        }
    }

    get colorX() {
        return this.grid.theme.axis.x;
    }

    /**
     * @attribute
     * @title Axis Color Y
     * @description The color of the line through the origin along the Y axis, on the XY and YZ
     * planes.
     * @type {Color}
     * @default [0.3, 1, 0.3, 1]
     */
    set colorY(value) {
        if (value instanceof Color) {
            this.grid.setTheme({ axis: { y: value } });
        }
    }

    get colorY() {
        return this.grid.theme.axis.y;
    }

    /**
     * @attribute
     * @title Axis Color Z
     * @description The color of the line through the origin along the Z axis.
     * @type {Color}
     * @default [0.3, 0.3, 1, 1]
     */
    set colorZ(value) {
        if (value instanceof Color) {
            this.grid.setTheme({ axis: { z: value } });
        }
    }

    get colorZ() {
        return this.grid.theme.axis.z;
    }

    /**
     * @attribute
     * @title Major Line Color
     * @description The color of the major lines. The alpha scales their opacity.
     * @type {Color}
     * @default [0.8, 0.8, 0.8, 0.6]
     */
    set majorLineColor(value) {
        if (value instanceof Color) {
            this.grid.setTheme({ major: value });
        }
    }

    get majorLineColor() {
        return this.grid.theme.major;
    }

    /**
     * @attribute
     * @title Minor Line Color
     * @description The color of the minor lines. The alpha scales their opacity.
     * @type {Color}
     * @default [0.6, 0.6, 0.6, 0.4]
     */
    set minorLineColor(value) {
        if (value instanceof Color) {
            this.grid.setTheme({ minor: value });
        }
    }

    get minorLineColor() {
        return this.grid.theme.minor;
    }

    /**
     * @attribute
     * @title Depth Offset
     * @description The fraction of the distance to the camera the depth of the grid moves toward it
     * by, so a surface on the grid's plane, such as a floor, doesn't hide it.
     * @type {number}
     * @default 0.001
     */
    set depthOffset(value) {
        this.grid.depthOffset = value;
    }

    get depthOffset() {
        return this.grid.depthOffset;
    }

    /**
     * @attribute
     * @title Depth Test
     * @description Whether the scene hides the grid where it is in front of it.
     * @type {boolean}
     * @default true
     */
    set depthTest(value) {
        this.grid.depthTest = value;
    }

    get depthTest() {
        return this.grid.depthTest;
    }

    /**
     * @attribute
     * @title Depth Write
     * @description Whether the grid writes the depth of its visible lines, so it
     * hides the transparent meshes and gaussian splats behind it, which draw after it.
     * @type {boolean}
     * @default false
     */
    set depthWrite(value) {
        this.grid.depthWrite = value;
    }

    get depthWrite() {
        return this.grid.depthWrite;
    }

    /**
     * @attribute
     * @title Depth Dither
     * @description Whether the depth the grid writes is dithered by how much of each pixel its
     * lines cover, so faint lines hide a share of the gaussian splats behind them.
     * @type {boolean}
     * @default false
     */
    set depthDither(value) {
        this.grid.depthDither = value;
    }

    get depthDither() {
        return this.grid.depthDither;
    }

    /**
     * @type {number}
     * @deprecated The levels of lines now follow the zoom; set {@link Grid#subdivisions} instead.
     * @ignore
     */
    set resolution(value) {
        if (!resolutionWarned) {
            resolutionWarned = true;
            console.warn('Grid#resolution is deprecated and has no effect: the levels of lines now follow the zoom. Set Grid#subdivisions instead.');
        }
    }

    get resolution() {
        return Grid.RESOLUTION_HIGH;
    }
}

export { Grid, GridPlane };
