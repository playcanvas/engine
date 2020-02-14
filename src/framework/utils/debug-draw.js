Object.assign(pc, function () {

    // DebugLine object represents an array of point segments together with their colors, and some additional properties
    function DebugLine(points, colors, endTime, id, options) {
        this.points = points;
        this.colors = colors;
        this.endTime = endTime;
        this.id = id;
        this.isAlive = true;

        // default options if not supplied
        this.options = options || {};
        if (typeof this.options.layer === 'undefined')
            this.options.layer = pc.app.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE);
        if (typeof this.options.depthTest === 'undefined')
            this.options.depthTest = true;
    }

    var _currentTime = 0;
    var _deltaTime = 0.1;   // the default for editor as it's not updated there
    var lines = [];

    var render = function () {
        _currentTime += _deltaTime;
        var needDeleteLines = false;

        // render lines
        var i;
        for (i = 0; i < lines.length; i++) {
            if (lines[i].isAlive) {
                pc.app._addLines(lines[i].points, lines[i].colors, lines[i].options);

                // time expired
                if (lines[i].endTime < _currentTime) {
                    lines[i].isAlive = false;
                    needDeleteLines = true;
                }
            } else
                needDeleteLines = true;
        }

        // delete no longer needed lines in place
        if (needDeleteLines) {
            var end = 0;
            for (i = 0; i < lines.length; i++)
                if (lines[i].isAlive)
                    lines[end++] = lines[i];

            lines.length = end;
        }
    };

    /**
     * @class
     * @name pc.DebugDraw
     * @classdesc Access to debug drawing functionality.
     * @description Instance of the class is created by the {@link pc.Application}
     * and is accessible via {@link pc.Application#debugDraw}.
     */
    var DebugDraw = function DebugDraw() {
        console.log("InitDebugDraw");

        // delta time in viewer (this is not called in editor)
        pc.app.on('update', function (deltaTime) {
            _deltaTime = deltaTime;
        });

        // render debug primitives in prerender
        pc.app.on('prerender', function () {
            render();
        });
    };

    Object.assign(DebugDraw.prototype, {
        /**
         * @function
         * @name pc.DebugDraw#addLine
         * @description Renders a single color line. Line start and end coordinates are
         * specified in world-space.
         * @param {pc.Vec3} start - The start world-space coordinate of the line.
         * @param {pc.Vec3} end - The end world-space coordinate of the line.
         * @param {pc.Color} color - The color of the line.
         * @param {number} [duration] - The amount of time the line will be rendered for, specified in seconds. If not specified,
         * or 0 is specified, the line is visible for a single frame.
         * @param {object} [options] - Options to set rendering properties.
         * @param {pc.Layer} [options.layer] - The layer to render the line into. Defaults
         * to {@link pc.LAYERID_IMMEDIATE}.
         * @param {boolean} [options.depthTest] - If true, pixels generated are only visible if they pass the depth test. Defaults to true.
         * @param {string} [id] - String identification, which can be used to remove this primitive using {@link pc.DebugDraw#removeIds}.
         * @example
         * // Render a 1-unit long white line for a single frame
         * var start = new pc.Vec3(0, 0, 0);
         * var end = new pc.Vec3(1, 0, 0);
         * var color = new pc.Color(1, 1, 1);
         * app.debugDraw.addLine(start, end, color);
         * @example
         * // Render a 1-unit long red line for 5 seconds without depth testing
         * var start = new pc.Vec3(0, 0, 0);
         * var end = new pc.Vec3(1, 0, 0);
         * app.debugDraw.addLine(start, end, pc.Color.RED, 5, { depthTest: false });
         */
        addLine: function (start, end, color, duration, options, id) {
            duration = duration || 0;
            start = start.clone();
            end = end.clone();
            color = color.clone();
            lines.push(new DebugLine([start, end], [color, color], _currentTime + duration, id, options));
        },

        /**
         * @function
         * @name pc.DebugDraw#addLines
         * @description Renders an array of lines. Positional coordinates are
         * specified in world-space.
         * @param {pc.Vec3[]} points - The array of points to draw the line between. This represents an array of start and end positions
         * for each line segment.
         * @param {pc.Color[]} colors - An array of colors to color the lines. This must be the same size as the position array.
         * @param {number} [duration] - The amount of time the line will be rendered for, specified in seconds. If not specified,
         * or 0 is specified, the line is visible for a single frame.
         * @param {object} [options] - Options to set rendering properties.
         * @param {pc.Layer} [options.layer] - The layer to render the line into. Defaults
         * to {@link pc.LAYERID_IMMEDIATE}.
         * @param {boolean} [options.depthTest] - If true, pixels generated are only visible if they pass the depth test. Defaults to true.
         * @param {string} [id] - String identification, which can be used to remove this primitive using {@link pc.DebugDraw#removeIds}.
         * @example
         * // Render two segment line in V shape for 10 seconds
         * var points = [new pc.Vec3(0, 0, 0), new pc.Vec3(1, 0, 0), new pc.Vec3(1, 0, 0), new pc.Vec3(1, 1, 1)];
         * var colors = [new pc.Color(1, 0, 0), new pc.Color(1, 1, 0), new pc.Color(0, 1, 1), new pc.Color(0, 0, 1)];
         * app.debugDraw.addLines(points, colors, 10);
         */
        addLines: function (points, colors, duration, options, id) {
            duration = duration || 0;
            var clonedPoints = [];
            var clonedColors = [];
            var i;
            for (i = 0; i < points.length; i++) {
                clonedPoints.push(points[i].clone());
                clonedColors.push(colors[i].clone());
            }

            lines.push(new DebugLine(clonedPoints, clonedColors, _currentTime + duration, id, options));
        },

        /**
         * @function
         * @name pc.DebugDraw#addBox
         * @description Renders axis aligned box using lines.
         * @param {pc.Vec3} min - Minimum corner of the box. Specified in world space.
         * @param {pc.Vec3} max - Maximum corner of the box. Specified in world space.
         * @param {pc.Color} color - The color of the box.
         * @param {number} [duration] - The amount of time the box will be rendered for, specified in seconds. If not specified,
         * or 0 is specified, the box is visible for a single frame.
         * @param {object} [options] - Options to set rendering properties.
         * @param {pc.Layer} [options.layer] - The layer to render the line into. Defaults
         * to {@link pc.LAYERID_IMMEDIATE}.
         * @param {boolean} [options.depthTest] - If true, pixels generated are only visible if they pass the depth test. Defaults to true.
         * @param {string} [id] - String identification, which can be used to remove this primitive using {@link pc.DebugDraw#removeIds}.
         * @example
         * // Render single box for single frame
         * var min = new pc.Vec3(0, 0, 0);
         * var max = new pc.Vec3(1, 1, 1);
         * app.debugDraw.addBox(min, max, pc.Color.WHITE);
         */
        addBox: function (min, max, color, duration, options, id) {
            duration = duration || 0;

            var points = [
                new pc.Vec3(min.x, min.y, min.z), new pc.Vec3(max.x, min.y, min.z),
                new pc.Vec3(min.x, min.y, max.z), new pc.Vec3(max.x, min.y, max.z),
                new pc.Vec3(min.x, max.y, min.z), new pc.Vec3(max.x, max.y, min.z),
                new pc.Vec3(min.x, max.y, max.z), new pc.Vec3(max.x, max.y, max.z),
                new pc.Vec3(min.x, min.y, min.z), new pc.Vec3(min.x, max.y, min.z),
                new pc.Vec3(min.x, min.y, max.z), new pc.Vec3(min.x, max.y, max.z),
                new pc.Vec3(max.x, min.y, min.z), new pc.Vec3(max.x, max.y, min.z),
                new pc.Vec3(max.x, min.y, max.z), new pc.Vec3(max.x, max.y, max.z),
                new pc.Vec3(min.x, min.y, min.z), new pc.Vec3(min.x, min.y, max.z),
                new pc.Vec3(min.x, max.y, min.z), new pc.Vec3(min.x, max.y, max.z),
                new pc.Vec3(max.x, min.y, min.z), new pc.Vec3(max.x, min.y, max.z),
                new pc.Vec3(max.x, max.y, min.z), new pc.Vec3(max.x, max.y, max.z)
            ];

            var colors = [
                color, color, color, color, color, color, color, color,
                color, color, color, color, color, color, color, color,
                color, color, color, color, color, color, color, color
            ];

            lines.push(new DebugLine(points, colors, _currentTime + duration, id, options));
        },

        /**
         * @function
         * @name pc.DebugDraw#addSphere
         * @description Renders sphere using lines as 3 axis aligned circles.
         * @param {pc.Vec3} center - Center position of the sphere. Specified in world space.
         * @param {number} radius - Radius of the sphere.
         * @param {number} numSegments - Number of line segments for each circle.
         * @param {pc.Color} color - The color of the box.
         * @param {number} [duration] - The amount of time the box will be rendered for, specified in seconds. If not specified,
         * or 0 is specified, the box is visible for a single frame.
         * @param {object} [options] - Options to set rendering properties.
         * @param {pc.Layer} [options.layer] - The layer to render the line into. Defaults
         * to {@link pc.LAYERID_IMMEDIATE}.
         * @param {boolean} [options.depthTest] - If true, pixels generated are only visible if they pass the depth test. Defaults to true.
         * @param {string} [id] - String identification, which can be used to remove this primitive using {@link pc.DebugDraw#removeIds}.
         * @example
         * // Render single sphere with radius of 5, using 20 line segments, for single frame
         * var center = new pc.Vec3(0, 0, 0);
         * app.debugDraw.addSphere(center, 5, 20, pc.Color.CYAN);
         */
        addSphere: function (center, radius, numSegments, color, duration, options, id) {
            duration = duration || 0;

            var points = [];
            var colors = [];

            var step = 2 * Math.PI / numSegments;
            var angle = 0, i;
            for (i = 0; i < numSegments; i++) {
                var sin0 = Math.sin(angle);
                var cos0 = Math.cos(angle);
                angle += step;
                var sin1 = Math.sin(angle);
                var cos1 = Math.cos(angle);

                points.push(
                    new pc.Vec3(center.x + radius * sin0, center.y, center.z + radius * cos0), new pc.Vec3(center.x + radius * sin1, center.y, center.z + radius * cos1),
                    new pc.Vec3(center.x + radius * sin0, center.y + radius * cos0, center.z), new pc.Vec3(center.x + radius * sin1, center.y + radius * cos1, center.z),
                    new pc.Vec3(center.x, center.y + radius * sin0, center.z + radius * cos0), new pc.Vec3(center.x, center.y + radius * sin1, center.z + radius * cos1)
                );

                colors.push(color, color, color, color, color, color);
            }
            lines.push(new DebugLine(points, colors, _currentTime + duration, id, options));
        },

        /**
         * @function
         * @name pc.DebugDraw#removeIds
         * @description Removes debug rendering primitives with matching id from rendering.
         * @param {string} [id] - String identification, which can be used to remove primitives.
         * @example
         * // Render sphere and box for 1000 seconds, both with the same id
         * app.debugDraw.addSphere(pc.Vec3.ZERO, 1, 10, pc.Color.WHITE, 1000, undefined, "enemy");
         * app.debugDraw.addBox(pc.Vec3.ZERO, pc.Vec3.ONE, pc.Color.WHITE, 1000, undefined, "enemy");
         *
         * // At some time later remove these from rendering, before their duration expires.
         * app.debugDraw.removeIds("enemy");
         */
        removeIds: function (id) {
            var i;
            for (i = 0; i < lines.length; i++)
                if (lines[i].id == id)
                    lines[i].isAlive = false;
        }
    });

    return {
        DebugDraw: DebugDraw
    };
}());
