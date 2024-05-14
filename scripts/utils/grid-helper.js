var GridHelperScript = pc.createScript('gridHelper');

const grid = {
    uniforms: /* glsl */`

        uniform vec4 gridColor;
        uniform float meshSize;
        uniform float gridSize;
        uniform float subGridDivisions;
        
        uniform vec4 primaryLineColor;
        uniform vec4 secondaryLineColor;
        uniform float primaryLineThickness;
        uniform float secondaryLineThickness;

        // varying vec2 vUv0;
        // varying vec3 vPosition;
    `,

    frag: /* glsl */`
        
        float filteredGrid(in vec2 p, in float lineThickness, in vec2 dpdx, in vec2 dpdy)
        {
            float N = lineThickness;
            vec2 w = max(abs(dpdx), abs(dpdy));
            vec2 a = p + 0.5*w;                        
            vec2 b = p - 0.5*w;           
            vec2 i = (floor(a)+min(fract(a)*N,1.0)-
                    floor(b)-min(fract(b)*N,1.0))/(N*w);
            return (1.0-i.x)*(1.0-i.y);
        }

        float grid(in float size, in float lineThickness)
        {
            float nCells = meshSize / size;
            float N = 1.0 / (lineThickness / size);

            vec2 uv = vUv0 * nCells;
            vec2 ddx_uv = dFdx( uv );
            vec2 ddy_uv = dFdy( uv );

            float grid = filteredGrid(uv, N, ddx_uv, ddy_uv);

            return 1.0 - grid;
        }

        vec4 makeGrid() {

            // float isGridLine = 0.0;
            vec4 primaryColor = primaryLineColor;
            vec4 secondaryColor = secondaryLineColor;

            // Primary grid line
            primaryColor.a *= grid(gridSize, primaryLineThickness );
            
            // Secondary grid line
            secondaryColor.a *= grid(gridSize / subGridDivisions, secondaryLineThickness);

            vec4 color = mix(secondaryColor, primaryColor, primaryColor.a);
            color.a = max(secondaryColor.a, primaryColor.a);

            return mix(gridColor, color, color.a);
        }

    `
};

export class GridHelper extends pc.Entity {
    constructor(app) {
        super('Grid-Helper', app);

        const material = new pc.LitMaterial();
        console.log
        material.setParameter("material_reflectivity", 1.0);
        material.shadingModel = pc.SPECULAR_BLINN;
        material.useSkybox = false;
        material.hasSpecular = false;
        material.hasSpecularityFactor = true;
        material.hasNormals = false;
        material.hasMetalness = true;
        material.occludeSpecular = pc.SPECOCC_AO;
        material.hasLighting = true;
        material.lightMapEnabled = true;

        const argumentsChunk = /* glsl */`
            uniform vec3 material_specularRgb;
            ${grid.uniforms}
            ${grid.frag}

            void evaluateFrontend() {
                litArgs_emission = vec3(0, 0, 0);
                litArgs_metalness = 0.5;
                litArgs_specularity = material_specularRgb;
                litArgs_specularityFactor = 1.0;

                vec4 color = makeGrid();

                litArgs_albedo = vec3(color.rgb);
                
                litArgs_ior = 0.1;
                litArgs_worldNormal = vec3(0,0,1);
                litArgs_ao = 0.0;
                litArgs_opacity = color.a;
            }
        `;

        const time = 0.0;
        material.setParameter("material_specularRgb", [(Math.sin(time) + 1.0) * 0.5, (Math.cos(time * 0.5) + 1.0) * 0.5, (Math.sin(time * 0.7) + 1.0) * 0.5]);
        // material.setParameter("material_normalMapIntensity", (Math.sin(time) + 1.0) * 0.5);


        material.shaderChunk = argumentsChunk;
        material.update();

        this.addComponent('render', {
            type: 'plane',
            receiveShadows: true,
            material
        });

        // const plane = this.render.meshInstances[0];
        material.setParameter('gridColor', new pc.Color().fromString('#667380').data);

        material.setParameter('primaryLineColor', new pc.Color(1, 1, 1, 0.9).data);
        material.setParameter('secondaryLineColor', new pc.Color(1, 1, 1, 0.4).data);

        material.setParameter('primaryLineThickness', 0.02);
        material.setParameter('secondaryLineThickness', 0.01);

        material.setParameter('gridSize', 2.5);
        material.setParameter('subGridDivisions', 10);

        this.material = material;

        this.size = 10;

    }

    set size(n) {
        this.setLocalScale(n, n, n);
        this.material.setParameter('meshSize', n * 10);
    }

    get size() {
        return this.getLocalScale().x;
    }
}