import { CLOUDTYPE_FLAT, CLOUDTYPE_NONE, CLOUDTYPE_VOLUMETRIC, Color, DynamicSkyEffect, Vec3 } from 'playcanvas';
import { CameraFrameEffectScript } from './camera-frame-effect.mjs';

/**
 * @import { Entity } from 'playcanvas';
 */

/** @enum {string} */
const CloudType = {
    NONE: 'none',               // CLOUDTYPE_NONE
    FLAT: 'flat',               // CLOUDTYPE_FLAT
    VOLUMETRIC: 'volumetric'    // CLOUDTYPE_VOLUMETRIC
};

/** @enum {string} */
const LightingResolution = {
    R128: '128',
    R256: '256',
    R512: '512',
    R1024: '1024'
};

/** @enum {string} */
const AtlasSize = {
    S256: '256',
    S512: '512',
    S1024: '1024'
};

const cloudTypes = {
    [CloudType.NONE]: CLOUDTYPE_NONE,
    [CloudType.FLAT]: CLOUDTYPE_FLAT,
    [CloudType.VOLUMETRIC]: CLOUDTYPE_VOLUMETRIC
};

/**
 * Resolves a {@link CloudType} to the engine constant. Other values are passed through unchanged.
 *
 * @param {CloudType|string} value - The cloud type.
 * @returns {string} The engine cloud type.
 */
const resolveCloudType = value => cloudTypes[value] ?? value;

/**
 * Resolves a size given as a string, such as a {@link LightingResolution} or an {@link AtlasSize},
 * to a number of pixels. Numeric values are passed through unchanged.
 *
 * @param {string|number} value - The size.
 * @param {number} fallback - The size used when the value is not a number.
 * @returns {number} The size in pixels.
 */
const resolveSize = (value, fallback) => {
    return typeof value === 'number' ? value : (parseInt(value, 10) || fallback);
};

/**
 * The position of the sun, and the directional light kept in sync with it.
 *
 * @interface
 * @category Post-Processing
 */
class DynamicSkySun {
    /**
     * The azimuth of the sun, in degrees - its compass direction.
     *
     * @range [0, 360]
     * @precision 1
     * @step 1
     */
    azimuth = 0;

    /**
     * The elevation of the sun above the horizon, in degrees. Negative values place the sun below
     * the horizon, which gives the night sky.
     *
     * @range [-90, 90]
     * @precision 1
     * @step 1
     */
    elevation = 25;

    /**
     * The rotation of the whole sky around the vertical axis, in degrees, turning the sky, the sun
     * and the moon together.
     *
     * @range [0, 360]
     * @precision 1
     * @step 1
     */
    rotation = 0;

    /**
     * The entity of the directional light kept in sync with the sun: its direction, color and
     * intensity. By day it shines from the sun, and at night it fades to the moonlight.
     *
     * @type {Entity}
     */
    light = null;

    /**
     * The intensity of the light of the sun, which also sets the brightness of the sky.
     *
     * @range [0, 10]
     * @precision 2
     * @step 0.1
     */
    sunIntensity = 2;
}

/**
 * The day sky, an analytic atmosphere lit by the sun.
 *
 * @interface
 * @category Post-Processing
 */
class DynamicSkyDay {
    /**
     * The haziness of the atmosphere. Higher values give a milkier sky and a larger glow around
     * the sun.
     *
     * @range [1, 20]
     * @precision 2
     * @step 0.1
     */
    turbidity = 2;

    /**
     * The amount of the Rayleigh scattering, setting the blueness of the sky.
     *
     * @range [0, 4]
     * @precision 3
     * @step 0.01
     */
    rayleigh = 1.5;

    /**
     * The amount of the Mie scattering, setting the brightness of the glow around the sun.
     *
     * @range [0, 0.1]
     * @precision 4
     * @step 0.001
     */
    mieCoefficient = 0.005;

    /**
     * How tightly the glow hugs the sun.
     *
     * @range [0, 1]
     * @precision 3
     * @step 0.01
     */
    mieDirectionalG = 0.8;

    /**
     * The brightness of the sky, relative to the light of the sun. At 1, the sky lights the scene
     * as a clear sky does.
     *
     * @range [0, 4]
     * @precision 2
     * @step 0.05
     */
    luminance = 1;

    /**
     * The strength of the warm glow at the horizon while the sun is just below it.
     *
     * @range [0, 2]
     * @precision 2
     * @step 0.01
     */
    twilightGlow = 0.52;
}

/**
 * The night sky: the stars, the moon and the moonlight.
 *
 * @interface
 * @category Post-Processing
 */
class DynamicSkyNight {
    /**
     * The color of the night sky.
     */
    nightColor = new Color(0.114, 0.247, 0.408);

    /**
     * The brightness of the night sky.
     *
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    nightBrightness = 0.052;

    /**
     * The brightness of the stars. A value of 0 disables them.
     *
     * @range [0, 1]
     * @precision 3
     * @step 0.005
     */
    starBrightness = 0.05;

    /**
     * The density of the stars - the fraction of the cells of the sky holding a star.
     *
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    starDensity = 0.8;

    /**
     * The scale of the size of the stars.
     *
     * @range [0, 2]
     * @precision 2
     * @step 0.01
     */
    starSize = 0.5;

    /**
     * The intensity of the light at night - the moonlight, a dim cool light from the direction
     * of the moon.
     *
     * @range [0, 5]
     * @precision 2
     * @step 0.05
     */
    moonIntensity = 1;

    /**
     * The color of the moonlight, and of the moon disc.
     */
    moonColor = new Color(0.792, 0.918, 1.0);

    /**
     * The direction toward the moon, turned by the rotation of the sky. It does not need to be
     * normalized.
     */
    moonDirection = new Vec3(-1.53, 0.85, 0.35);

    /**
     * The angular radius of the moon disc, in degrees.
     *
     * @range [0, 5]
     * @precision 2
     * @step 0.05
     */
    moonSize = 0.6;

    /**
     * The brightness of the moon disc in the night sky.
     *
     * @range [0, 10]
     * @precision 2
     * @step 0.1
     */
    moonGlow = 3;
}

/**
 * The clouds of the sky.
 *
 * @interface
 * @category Post-Processing
 */
class DynamicSkyClouds {
    /**
     * The type of the clouds: none, a flat layer of noise, which is cheap and also works in XR,
     * or volumetric clouds, ray marched through a layer of 3D noise.
     *
     * @type {CloudType}
     */
    type = CloudType.NONE;

    /**
     * The fraction of the sky covered by clouds, from a clear sky to overcast.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    coverage = 0.45;

    /**
     * The softness of the clouds, from dense clouds with crisp edges to translucent, wispy ones.
     *
     * @visibleif {type !== 'none'}
     * @range [0.01, 1]
     * @precision 2
     * @step 0.01
     */
    softness = 0.7;

    /**
     * The opacity of the clouds.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    opacity = 1;

    /**
     * The brightness of the sunlight falling on the clouds.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 4]
     * @precision 2
     * @step 0.01
     */
    brightness = 0.6;

    /**
     * The brightness of the moonlight on the clouds at night.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 1]
     * @precision 3
     * @step 0.005
     */
    nightBrightness = 0.05;

    /**
     * The distance in meters over which the cloud pattern repeats. Larger values give larger
     * clouds.
     *
     * @visibleif {type !== 'none'}
     * @range [500, 50000]
     * @precision 0
     * @step 100
     */
    size = 8000;

    /**
     * The altitude of the cloud layer, in meters.
     *
     * @visibleif {type !== 'none'}
     * @range [100, 20000]
     * @precision 0
     * @step 100
     */
    height = 2000;

    /**
     * The thickness of the layer of the volumetric clouds, in meters.
     *
     * @visibleif {type === 'volumetric'}
     * @range [100, 10000]
     * @precision 0
     * @step 100
     */
    thickness = 2500;

    /**
     * The fraction of the sunlight the clouds block at the full coverage, dimming the light.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    sunDimming = 0.6;

    /**
     * The speed the clouds drift with, in meters per second.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 100]
     * @precision 1
     * @step 1
     */
    windSpeed = 10;

    /**
     * The direction the clouds drift toward, in degrees around the vertical axis.
     *
     * @visibleif {type !== 'none'}
     * @range [0, 360]
     * @precision 1
     * @step 1
     */
    windDirection = 45;

    /**
     * The quality of the volumetric clouds. The cost grows about linearly, doubling from 0.5
     * to 1.
     *
     * @visibleif {type === 'volumetric'}
     * @range [0, 1]
     * @precision 2
     * @step 0.05
     */
    quality = 0.5;

    /**
     * The resolution the volumetric clouds render at, relative to the resolution of the scene.
     *
     * @visibleif {type === 'volumetric'}
     * @range [0.25, 1]
     * @precision 2
     * @step 0.05
     */
    resolution = 0.5;
}

/**
 * The lighting of the scene generated from the sky.
 *
 * @interface
 * @category Post-Processing
 */
class DynamicSkyLighting {
    /**
     * Whether the effect generates the lighting of the scene from its sky, the environment atlas
     * of the scene. Only one effect should do so, the one of the main camera.
     */
    enabled = true;

    /**
     * The resolution of the sky the lighting is generated from, the size of the faces of a
     * cubemap.
     *
     * @visibleif {enabled}
     * @type {LightingResolution}
     */
    resolution = LightingResolution.R256;

    /**
     * The size of the environment atlas. Higher values give sharper reflections on glossy
     * surfaces.
     *
     * @visibleif {enabled}
     * @type {AtlasSize}
     */
    atlasSize = AtlasSize.S512;

    /**
     * The angle the sun moves by, in degrees, before the lighting is generated again.
     *
     * @visibleif {enabled}
     * @range [0, 10]
     * @precision 2
     * @step 0.1
     */
    threshold = 0.5;

    /**
     * The distance the clouds drift by, as a fraction of their size, before the lighting is
     * generated again. A value of 0 disables it.
     *
     * @visibleif {enabled}
     * @range [0, 1]
     * @precision 3
     * @step 0.005
     */
    cloudThreshold = 0;

    /**
     * Whether the lighting blends from its previous update to its latest one, so it follows a
     * gradually changing sky smoothly.
     *
     * @visibleif {enabled}
     */
    interpolation = false;
}

/**
 * Adds the {@link DynamicSkyEffect} to the camera frame of the camera entity it is attached to,
 * next to the `cameraFrame` script. The effect renders the sky of the camera: a day sky of an
 * analytic atmosphere lit by the sun, a night sky of stars and the moon, and optionally clouds
 * drifting with the wind. The position of the sun sets the time of day, and the effect keeps the
 * directional light of the {@link DynamicSkySun#light} entity in sync with it. It also generates
 * the lighting of the scene from its sky.
 *
 * The attributes mirror the properties of the effect. To animate the time of day, change
 * `sun.elevation` from another script.
 *
 * @category Post-Processing
 */
class DynamicSkyEffectScript extends CameraFrameEffectScript {
    static scriptName = 'dynamicSkyEffect';

    /**
     * @attribute
     * @type {DynamicSkySun}
     */
    sun = new DynamicSkySun();

    /**
     * @attribute
     * @type {DynamicSkyDay}
     */
    day = new DynamicSkyDay();

    /**
     * @attribute
     * @type {DynamicSkyNight}
     */
    night = new DynamicSkyNight();

    /**
     * @attribute
     * @type {DynamicSkyClouds}
     */
    clouds = new DynamicSkyClouds();

    /**
     * @attribute
     * @type {DynamicSkyLighting}
     */
    lighting = new DynamicSkyLighting();

    createEffect(device) {
        return new DynamicSkyEffect(device);
    }

    updateEffect(effect) {
        const { sun, day, night, clouds, lighting } = this;

        effect.azimuth = sun.azimuth;
        effect.elevation = sun.elevation;
        effect.rotation = sun.rotation;
        effect.light = sun.light?.light ?? null;
        effect.sunIntensity = sun.sunIntensity;

        effect.turbidity = day.turbidity;
        effect.rayleigh = day.rayleigh;
        effect.mieCoefficient = day.mieCoefficient;
        effect.mieDirectionalG = day.mieDirectionalG;
        effect.luminance = day.luminance;
        effect.twilightGlow = day.twilightGlow;

        effect.nightColor.copy(night.nightColor);
        effect.nightBrightness = night.nightBrightness;
        effect.starBrightness = night.starBrightness;
        effect.starDensity = night.starDensity;
        effect.starSize = night.starSize;
        effect.moonIntensity = night.moonIntensity;
        effect.moonColor.copy(night.moonColor);
        effect.moonDirection.copy(night.moonDirection);
        effect.moonSize = night.moonSize;
        effect.moonGlow = night.moonGlow;

        effect.cloudType = resolveCloudType(clouds.type);
        effect.cloudCoverage = clouds.coverage;
        effect.cloudSoftness = clouds.softness;
        effect.cloudOpacity = clouds.opacity;
        effect.cloudBrightness = clouds.brightness;
        effect.cloudNightBrightness = clouds.nightBrightness;
        effect.cloudSize = clouds.size;
        effect.cloudHeight = clouds.height;
        effect.cloudThickness = clouds.thickness;
        effect.cloudSunDimming = clouds.sunDimming;
        effect.windSpeed = clouds.windSpeed;
        effect.windDirection = clouds.windDirection;
        effect.cloudQuality = clouds.quality;
        effect.cloudResolution = clouds.resolution;

        effect.lighting = lighting.enabled;
        effect.lightingResolution = resolveSize(lighting.resolution, 256);
        effect.atlasSize = resolveSize(lighting.atlasSize, 512);
        effect.lightingThreshold = lighting.threshold;
        effect.lightingCloudThreshold = lighting.cloudThreshold;
        effect.lightingInterpolation = lighting.interpolation;
    }
}

export {
    DynamicSkyEffectScript,
    DynamicSkySun, DynamicSkyDay, DynamicSkyNight, DynamicSkyClouds, DynamicSkyLighting,
    CloudType, LightingResolution, AtlasSize
};
