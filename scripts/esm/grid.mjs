import { Color, Grid as EngineGrid, Script, Vec2 } from 'playcanvas';

// warn once about the deprecated resolution
let resolutionWarned = false;

/**
 * @import { AppBase, Entity } from 'playcanvas'
 */

/**
 * Renders the engine's {@link EngineGrid | Grid} through a render component on its entity. The
 * entity's scale sizes the grid when it isn't {@link Grid#infinite}.
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
     * @deprecated Has no effect, as the levels follow the zoom.
     * @ignore
     */
    static RESOLUTION_LOW = 0;

    /**
     * @type {number}
     * @deprecated Has no effect, as the levels follow the zoom.
     * @ignore
     */
    static RESOLUTION_MEDIUM = 1;

    /**
     * @type {number}
     * @deprecated Has no effect, as the levels follow the zoom.
     * @ignore
     */
    static RESOLUTION_HIGH = 2;

    /**
     * The engine grid this script drives.
     *
     * @type {EngineGrid}
     * @private
     */
    _grid = new EngineGrid(this.app.graphicsDevice);

    /**
     * @param {{ app: AppBase, entity: Entity }} args - The script arguments.
     */
    constructor(args) {
        super(args);

        // release the grid even if the script never initializes
        this.on('destroy', () => {
            if (this.entity.render?.meshInstances === this._grid.meshInstances) {
                this.entity.removeComponent('render');
            }
            this._grid.destroy();
        });
    }

    initialize() {
        // check if the entity already has a render component
        if (this.entity.render) {
            console.error('The entity already has a render component.');
            return;
        }

        this.entity.addComponent('render', {
            meshInstances: this._grid.meshInstances,
            castShadows: false
        });

        this.on('enable', () => {
            this._grid.visible = true;
        });
        this.on('disable', () => {
            this._grid.visible = false;
        });
    }

    /**
     * @attribute
     * @title Plane
     * @description The plane in the entity's local space: 'xz', 'xy' or 'yz'.
     * @type {string}
     * @default xz
     */
    set plane(value) {
        this._grid.plane = value;
    }

    get plane() {
        return this._grid.plane;
    }

    /**
     * @attribute
     * @title Spacing
     * @description The cell size the levels are scaled from, in world units.
     * @type {number}
     * @default 10
     */
    set spacing(value) {
        this._grid.spacing = value;
    }

    get spacing() {
        return this._grid.spacing;
    }

    /**
     * @attribute
     * @title Subdivisions
     * @description How many cells of a level fit across one of the level above, or 1 for a
     * single fixed level.
     * @type {number}
     * @default 10
     */
    set subdivisions(value) {
        this._grid.subdivisions = value;
    }

    get subdivisions() {
        return this._grid.subdivisions;
    }

    /**
     * @attribute
     * @title Infinite
     * @description Whether the grid has no edge. When false, the entity's scale sizes it.
     * @type {boolean}
     * @default true
     */
    set infinite(value) {
        this._grid.infinite = value;
    }

    get infinite() {
        return this._grid.infinite;
    }

    /**
     * @attribute
     * @title Show Axes
     * @description Whether the lines through the origin use the axis colors.
     * @type {boolean}
     * @default true
     */
    set showAxes(value) {
        this._grid.showAxes = value;
    }

    get showAxes() {
        return this._grid.showAxes;
    }

    /**
     * @attribute
     * @title Axis Line Thickness
     * @description The axis line thickness in CSS pixels.
     * @type {number}
     * @default 2
     */
    set axisLineThickness(value) {
        this._grid.axisLineThickness = value;
    }

    get axisLineThickness() {
        return this._grid.axisLineThickness;
    }

    /**
     * @attribute
     * @title Major Line Thickness
     * @description The major line thickness in CSS pixels.
     * @type {number}
     * @default 1.5
     */
    set majorLineThickness(value) {
        this._grid.majorLineThickness = value;
    }

    get majorLineThickness() {
        return this._grid.majorLineThickness;
    }

    /**
     * @attribute
     * @title Minor Line Thickness
     * @description The minor line thickness in CSS pixels.
     * @type {number}
     * @default 1
     */
    set minorLineThickness(value) {
        this._grid.minorLineThickness = value;
    }

    get minorLineThickness() {
        return this._grid.minorLineThickness;
    }

    /**
     * @attribute
     * @title Fade Range
     * @description The distances from the camera where the grid starts and finishes fading out.
     * @type {Vec2}
     * @default [400, 1000]
     */
    set fadeRange(value) {
        if (value instanceof Vec2) {
            this._grid.fadeRange = value;
        }
    }

    get fadeRange() {
        return this._grid.fadeRange;
    }

    /**
     * @attribute
     * @title Contrast
     * @description Whether the lines are black over light parts of the scene and white over dark
     * ones. Needs the camera's scene color map.
     * @type {boolean}
     * @default false
     */
    set contrast(value) {
        this._grid.contrast = value;
    }

    get contrast() {
        return this._grid.contrast;
    }

    /**
     * @attribute
     * @title Axis Color X
     * @description The X axis line color.
     * @type {Color}
     * @default [1, 0.3, 0.3, 1]
     */
    set colorX(value) {
        if (value instanceof Color) {
            this._grid.setTheme({ axis: { x: value } });
        }
    }

    get colorX() {
        return this._grid.theme.axis.x;
    }

    /**
     * @attribute
     * @title Axis Color Y
     * @description The Y axis line color.
     * @type {Color}
     * @default [0.3, 1, 0.3, 1]
     */
    set colorY(value) {
        if (value instanceof Color) {
            this._grid.setTheme({ axis: { y: value } });
        }
    }

    get colorY() {
        return this._grid.theme.axis.y;
    }

    /**
     * @attribute
     * @title Axis Color Z
     * @description The Z axis line color.
     * @type {Color}
     * @default [0.3, 0.3, 1, 1]
     */
    set colorZ(value) {
        if (value instanceof Color) {
            this._grid.setTheme({ axis: { z: value } });
        }
    }

    get colorZ() {
        return this._grid.theme.axis.z;
    }

    /**
     * @attribute
     * @title Major Line Color
     * @description The major line color. The alpha sets the opacity.
     * @type {Color}
     * @default [0.8, 0.8, 0.8, 0.6]
     */
    set majorLineColor(value) {
        if (value instanceof Color) {
            this._grid.setTheme({ major: value });
        }
    }

    get majorLineColor() {
        return this._grid.theme.major;
    }

    /**
     * @attribute
     * @title Minor Line Color
     * @description The minor line color. The alpha sets the opacity.
     * @type {Color}
     * @default [0.6, 0.6, 0.6, 0.4]
     */
    set minorLineColor(value) {
        if (value instanceof Color) {
            this._grid.setTheme({ minor: value });
        }
    }

    get minorLineColor() {
        return this._grid.theme.minor;
    }

    /**
     * @attribute
     * @title Depth Offset
     * @description The fraction of the camera distance the grid's depth moves toward the camera
     * by, so a coplanar surface doesn't hide it.
     * @type {number}
     * @default 0.001
     */
    set depthOffset(value) {
        this._grid.depthOffset = value;
    }

    get depthOffset() {
        return this._grid.depthOffset;
    }

    /**
     * @attribute
     * @title Depth Test
     * @description Whether the grid is depth tested against the scene.
     * @type {boolean}
     * @default true
     */
    set depthTest(value) {
        this._grid.depthTest = value;
    }

    get depthTest() {
        return this._grid.depthTest;
    }

    /**
     * @attribute
     * @title Depth Write
     * @description Whether the lines write depth, hiding transparent meshes and gaussian splats
     * behind them.
     * @type {boolean}
     * @default false
     */
    set depthWrite(value) {
        this._grid.depthWrite = value;
    }

    get depthWrite() {
        return this._grid.depthWrite;
    }

    /**
     * @attribute
     * @title Depth Dither
     * @description Whether the written depth is dithered by line coverage, for gaussian splats.
     * @type {boolean}
     * @default false
     */
    set depthDither(value) {
        this._grid.depthDither = value;
    }

    get depthDither() {
        return this._grid.depthDither;
    }

    /**
     * @type {number}
     * @deprecated Has no effect, as the levels follow the zoom.
     * @ignore
     */
    set resolution(value) {
        if (!resolutionWarned) {
            resolutionWarned = true;
            console.warn('Grid#resolution is deprecated and has no effect, as the levels follow the zoom.');
        }
    }

    get resolution() {
        return Grid.RESOLUTION_HIGH;
    }
}

export { Grid };
