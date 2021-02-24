/* jshint esversion: 6 */
const BEZIER_STEP_SIZE = 3;

const EPSILON = 1e-6;

const p = new pc.Vec2();
const p1 = new pc.Vec2();
const p2 = new pc.Vec2();

const vTemp1 = new pc.Vec2();
const vTemp2 = new pc.Vec2();
const vTemp3 = new pc.Vec2();
const vTemp4 = new pc.Vec2();
const vTemp5 = new pc.Vec2();
const vTemp6 = new pc.Vec2();

// Utility class for converting path commands into point data
class Polygon {
    constructor () {
        this.points = [];
        this.children = [];
        this.area = 0;
    }

    moveTo(x, y) {
        this.points.push(new pc.Vec2(x, y));
    }

    lineTo(x, y) {
        this.points.push(new pc.Vec2(x, y));
    }

    close() {
        let cur = this.points[this.points.length - 1];
        this.points.forEach(next => {
            this.area += 0.5 * cur.cross(next);
            cur = next;
        });
    }

    conicTo(px, py, p1x, p1y, maxSteps = 10) {
        p.set(px, py);
        p1.set(p1x, p1y);

        const p0 = this.points[this.points.length - 1];
        const dist = p0.distance(p1) + p1.distance(p);
        const steps = Math.max(2, Math.min(maxSteps, dist / BEZIER_STEP_SIZE));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            
            vTemp1.lerp(p0, p1, t);
            vTemp2.lerp(p1, p, t);
            vTemp3.lerp(vTemp1, vTemp2, t);

            this.points.push(vTemp3.clone());
        }
    }

    cubicTo(px, py, p1x, p1y, p2x, p2y, maxSteps = 10) {
        p.set(px, py);
        p1.set(p1x, p1y);
        p2.set(p2x, p2y);

        const p0 = this.points[this.points.length - 1];
        const dist = p0.distance(p1) + p1.distance(p2) + p2.distance(p);
        const steps = Math.max(2, Math.min(maxSteps, dist / BEZIER_STEP_SIZE));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;

            vTemp1.lerp(p0, p1, t);
            vTemp2.lerp(p1, p2, t);
            vTemp3.lerp(p2, p, t);

            vTemp4.lerp(vTemp1, vTemp2, t);
            vTemp5.lerp(vTemp2, vTemp3, t);

            vTemp6.lerp(vTemp4, vTemp5, t);

            this.points.push(vTemp6.clone());
        }
    }

    inside(p) {
        let count = 0, cur = this.points[this.points.length - 1];
        this.points.forEach(next => {
            const p0 = (cur.y < next.y ? cur : next);
            const p1 = (cur.y < next.y ? next : cur);
            if (p0.y < p.y + EPSILON && p1.y > p.y + EPSILON) {
                if ((p1.x - p0.x) * (p.y - p0.y) > (p.x - p0.x) * (p1.y - p0.y)) {
                    count += 1;
                }
            }
            cur = next;
        });
        return (count % 2) !== 0;
    }
}


var TextMesh = pc.createScript('textMesh');

TextMesh.attributes.add('font', {
    type: 'asset',
    assetType: 'binary',
    title: 'Font',
    description: 'TTF file used as the basis for this 3D text'
});
TextMesh.attributes.add('text', {
    type: 'string',
    title: 'Text',
    description: 'The text string to render as a 3D mesh'
});
TextMesh.attributes.add('alignment', {
    type: 'number',
    enum: [
        { 'Left': 0 },
        { 'Center': 1 },
        { 'Right': 2 }
    ],
    title: 'Alignment',
    description: 'Controls whether the text is centered or left or right justified'
});
TextMesh.attributes.add('characterSize', {
    type: 'number',
    default: 1,
    title: 'Character Size',
    description: 'The world space (maximum) height of each character'
});
TextMesh.attributes.add('characterSpacing', {
    type: 'number',
    min: 0,
    default: 0,
    title: 'Character Spacing',
    description: 'Additional spacing between each character'
});
TextMesh.attributes.add('kerning', {
    type: 'number',
    min: 0,
    max: 1,
    default: 1,
    title: 'Kerning',
    description: 'Scales character pair kerning value so 0 is no kerning and 1 is full kerning'
});
TextMesh.attributes.add('depth', {
    type: 'number',
    default: 1,
    title: 'Depth',
    description: 'Depth of the extrusion applied to the text'
});
TextMesh.attributes.add('maxCurveSteps', {
    type: 'number',
    default: 10,
    title: 'Max Curve Steps',
    description: 'Maximum number of divisions applied to bezier based path in a font outline'
});
TextMesh.attributes.add('renderStyle', {
    type: 'number',
    enum: [
        { 'Solid': 0 },
        { 'Wireframe': 1 }
    ],
    title: 'Render Style',
    description: 'Controls whether the text is rendered as solid or wireframe'
});
TextMesh.attributes.add('material', {
    type: 'asset',
    assetType: 'material',
    title: 'Material',
    description: 'The material to apply to the 3D text mesh'
});

TextMesh.prototype.initialize = function() {
    this.characters = [];
    this.fontData = null;

    if (this.font) {
        this.fontData = opentype.parse(this.font.resource);
        this.createText();
    }

    // Handle any and all attribute changes
    this.on('attr', function(name, value, prev) {
        if (value !== prev) {
            if (name === 'font') {
                if (this.font) {
                    this.fontData = opentype.parse(this.font.resource);
                } else {
                    this.fontData = null;
                    this.destroyCharacters();
                }
            }
            if (this.fontData) {
                this.createText();
            }
        }
    });
};

TextMesh.prototype.parseCommands = function (commands) {
    // Convert all outlines for the character to polygons
    var polygons = [];
    commands.forEach(({type, x, y, x1, y1, x2, y2}) => {
        switch (type) {
            case 'M':
                polygons.push(new Polygon());
                polygons[polygons.length - 1].moveTo(x, y);
                break;
            case 'L':
                polygons[polygons.length - 1].moveTo(x, y);
                break;
            case 'C':
                polygons[polygons.length - 1].cubicTo(x, y, x1, y1, x2, y2, this.maxCurveSteps);
                break;
            case 'Q':
                polygons[polygons.length - 1].conicTo(x, y, x1, y1, this.maxCurveSteps);
                break;
            case 'Z':
                polygons[polygons.length - 1].close();
                break;
        }
    });

    // Sort polygons by descending area
    polygons.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

    // Classify polygons to find holes and their 'parents'
    const root = [];
    for (let i = 0; i < polygons.length; ++i) {
        let parent = null;
        for (let j = i - 1; j >= 0; --j) {
            // A polygon is a hole if it is inside its parent and has different winding
            if (polygons[j].inside(polygons[i].points[0]) && polygons[i].area * polygons[j].area < 0) {
                parent = polygons[j];
                break;
            }
        }
        if (parent) {
            parent.children.push(polygons[i]);
        } else {
            root.push(polygons[i]);
        }
    }

    const totalPoints = polygons.reduce((sum, p) => sum + p.points.length, 0);
    const vertexData = new Float32Array(totalPoints * 2);
    let vertexCount = 0;
    const indices = [];

    function process(poly) {
        // Construct input for earcut
        const coords = [];
        const holes = [];
        poly.points.forEach(({x, y}) => coords.push(x, y));
        poly.children.forEach(child => {
            // Children's children are new, separate shapes
            child.children.forEach(process);

            holes.push(coords.length / 2);
            child.points.forEach(({x, y}) => coords.push(x, y));
        });

        // Add vertex data
        vertexData.set(coords, vertexCount * 2);

        // Add index data
        earcut(coords, holes).forEach(i => indices.push(i + vertexCount));
        vertexCount += coords.length / 2;
    }

    root.forEach(process);

    const scalar = this.characterSize / this.fontData.unitsPerEm;
    
    // Generate front vertices
    let vertices = [];
    for (let p = 0; p < vertexData.length; p += 2) {
        vertices.push(vertexData[p] * scalar, vertexData[p + 1] * scalar, this.depth);
    }

    // Generate back vertices
    for (let p = 0; p < vertexData.length; p += 2) {
        vertices.push(vertexData[p] * scalar, vertexData[p + 1] * scalar, 0);
    }

    // Generate back indices
    const numIndices = indices.length;
    for (let i = 0; i < numIndices; i += 3) {
        indices.push(indices[i + 2] + vertexCount, indices[i + 1] + vertexCount, indices[i] + vertexCount);
    }

    // Generate sides
    polygons.forEach(poly => {
        for (let i = 0; i < poly.points.length - 1; i++) {
            let base = vertices.length / 3;
            let p1 = poly.points[i];
            let p2 = poly.points[i + 1];
            vertices.push(p1.x * scalar, p1.y * scalar, this.depth, p2.x * scalar, p2.y * scalar, this.depth,
                          p1.x * scalar, p1.y * scalar, 0, p2.x * scalar, p2.y * scalar, 0);
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
    });
    
    let normals = pc.calculateNormals(vertices, indices);
    
    return { vertices, normals, indices };
};

TextMesh.prototype.calculateWidth = function () {
    const font = this.fontData;
    const scalar = this.characterSize / font.unitsPerEm;

    let width = 0;
    for (var i = 0; i < this.text.length; i++) {
        let char = this.text.charAt(i);
        width += font.charToGlyph(char).advanceWidth * scalar;

        if (i < this.text.length - 1) {
            width += this.characterSpacing;

            var glyph = font.charToGlyph(char);
            var nextGlyph = font.charToGlyph(this.text.charAt(i + 1));
            width += font.getKerningValue(glyph, nextGlyph) * this.kerning * scalar;
        }
    }
    return width;
};

TextMesh.prototype.destroyCharacters = function () {
    // Destroy all existing characters
    this.characters.forEach(function (character) {
        character.destroy();
    });
    this.characters.length = 0;
};

TextMesh.prototype.createText = function () {
    this.destroyCharacters();

    const font = this.fontData;
    const scalar = this.characterSize / font.unitsPerEm;

    var w = this.calculateWidth();
    var cursor = 0;
    switch (this.alignment) {
        case 0:
            break;
        case 1:
            cursor = -w * 0.5;
            break;
        case 2:
            cursor = -w;
            break;
    }

    var material = this.material ? this.material.resource : new pc.StandardMaterial();

    for (var i = 0; i < this.text.length; i++) {
        var character = this.text.charAt(i);

        var glyph = font.charToGlyph(character);

        var glyphData = this.parseCommands(glyph.path.commands);
        if (glyphData.vertices.length > 0) {
            var graphicsDevice = this.app.graphicsDevice;

            // Create a new mesh from the glyph data
            var mesh = new pc.Mesh(graphicsDevice);
            mesh.setPositions(glyphData.vertices);
            mesh.setNormals(glyphData.normals);
            mesh.setIndices(glyphData.indices);
            mesh.update(pc.PRIMITIVE_TRIANGLES);

            var meshInstance = new pc.MeshInstance(mesh, material);

            // Add a child entity for this character
            var entity = new pc.Entity(character);
            entity.addComponent('render', {
                meshInstances: [ meshInstance ],
                renderStyle: this.renderStyle
            });
            this.entity.addChild(entity);

            entity.setLocalPosition(cursor, 0, 0);
            
            this.characters.push(entity);
        }

        if (i < this.text.length - 1) {
            var nextGlyph = font.charToGlyph(this.text.charAt(i + 1));
            cursor += font.getKerningValue(glyph, nextGlyph) * this.kerning * scalar;
        }

        cursor += glyph.advanceWidth * scalar + this.characterSpacing;
    }
};
