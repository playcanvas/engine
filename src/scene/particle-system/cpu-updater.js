import { math } from '../../math/math.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec3 } from '../../math/vec3.js';

import { EMITTERSHAPE_BOX, EMITTERSHAPE_SPHERE, PARTICLESORT_NONE } from '../../scene/constants.js';

let nonUniformScale;
let uniformScale = 1;
const particleTexChannels = 4; // there is a duplicate in particle-emitter
const rotMat = new Mat4();
const rotMatInv = new Mat4();
const randomPosTformed = new Vec3();
const randomPos = new Vec3();
const rndFactor3Vec = new Vec3();
const particlePosPrev = new Vec3();
const velocityVec = new Vec3();
const localVelocityVec = new Vec3();
const velocityVec2 = new Vec3();
const localVelocityVec2 = new Vec3();
const radialVelocityVec = new Vec3();
const particlePos = new Vec3();
const particleFinalPos = new Vec3();
const moveDirVec = new Vec3();
const tmpVec3 = new Vec3();

function frac(f) {
    return f - Math.floor(f);
}

function saturate(x) {
    return Math.max(Math.min(x, 1), 0);
}

function glMod(x, y) {
    return x - y * Math.floor(x / y);
}

function encodeFloatRGBA(v) {
    let encX = frac(v);
    let encY = frac(255.0 * v);
    let encZ = frac(65025.0 * v);
    let encW = frac(160581375.0 * v);

    encX -= encY / 255.0;
    encY -= encZ / 255.0;
    encZ -= encW / 255.0;
    encW -= encW / 255.0;

    return [encX, encY, encZ, encW];
}

function encodeFloatRG(v) {
    let encX = frac(v);
    let encY = frac(255.0 * v);

    encX -= encY / 255.0;
    encY -= encY / 255.0;

    return [encX, encY];
}

// Wraps CPU update computations from ParticleEmitter
class ParticleCPUUpdater {
    constructor(emitter) {
        this._emitter = emitter;
    }

    calcSpawnPosition(particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, i) {
        const emitter = this._emitter;

        const rX = Math.random();
        const rY = Math.random();
        const rZ = Math.random();
        const rW = Math.random();
        if (emitter.useCpu) {
            particleTex[i * particleTexChannels + 0 + emitter.numParticlesPot * 2 * particleTexChannels] = rX;
            particleTex[i * particleTexChannels + 1 + emitter.numParticlesPot * 2 * particleTexChannels] = rY;
            particleTex[i * particleTexChannels + 2 + emitter.numParticlesPot * 2 * particleTexChannels] = rZ;
            // particleTex[i * 4 + 3 + emitter.numParticlesPot * 2 * 4] = 1; // hide/show
        }

        randomPos.x = rX - 0.5;
        randomPos.y = rY - 0.5;
        randomPos.z = rZ - 0.5;

        if (emitter.emitterShape === EMITTERSHAPE_BOX) {
            const max = Math.max(Math.abs(randomPos.x), Math.max(Math.abs(randomPos.y), Math.abs(randomPos.z)));

            // let's find a contour surface level corresponding to max random component
            // and translate 2 other random components to that surface
            // edge = (1.0 - extentsInnerRatioUniform) * max + 0.5 * extentsInnerRatioUniform;
            const edgeX = max + (0.5 - max) * extentsInnerRatioUniform[0];
            const edgeY = max + (0.5 - max) * extentsInnerRatioUniform[1];
            const edgeZ = max + (0.5 - max) * extentsInnerRatioUniform[2];
            randomPos.x = edgeX * (max === Math.abs(randomPos.x) ? Math.sign(randomPos.x) : 2 * randomPos.x);
            randomPos.y = edgeY * (max === Math.abs(randomPos.y) ? Math.sign(randomPos.y) : 2 * randomPos.y);
            randomPos.z = edgeZ * (max === Math.abs(randomPos.z) ? Math.sign(randomPos.z) : 2 * randomPos.z);

            if (!emitter.localSpace)
                randomPosTformed.copy(emitterPos).add(spawnMatrix.transformPoint(randomPos));
            else
                randomPosTformed.copy(spawnMatrix.transformPoint(randomPos));
        } else {
            randomPos.normalize();
            const spawnBoundsSphereInnerRatio = (emitter.emitterRadius === 0) ? 0 : emitter.emitterRadiusInner / emitter.emitterRadius;
            const r = rW * (1.0 - spawnBoundsSphereInnerRatio) + spawnBoundsSphereInnerRatio;
            if (!emitter.localSpace)
                randomPosTformed.copy(emitterPos).add(randomPos.mulScalar(r * emitter.emitterRadius));
            else
                randomPosTformed.copy(randomPos.mulScalar(r * emitter.emitterRadius));
        }

        const particleRate = math.lerp(emitter.rate, emitter.rate2, rX);
        let startSpawnTime = -particleRate * i;
        if (emitter.pack8) {
            const packX = (randomPosTformed.x - emitter.worldBounds.center.x) / emitter.worldBoundsSize.x + 0.5;
            const packY = (randomPosTformed.y - emitter.worldBounds.center.y) / emitter.worldBoundsSize.y + 0.5;
            const packZ = (randomPosTformed.z - emitter.worldBounds.center.z) / emitter.worldBoundsSize.z + 0.5;

            let packA = math.lerp(emitter.startAngle * math.DEG_TO_RAD, emitter.startAngle2 * math.DEG_TO_RAD, rX);
            packA = (packA % (Math.PI * 2)) / (Math.PI * 2);

            const rg0 = encodeFloatRG(packX);
            particleTex[i * particleTexChannels] = rg0[0];
            particleTex[i * particleTexChannels + 1] = rg0[1];

            const ba0 = encodeFloatRG(packY);
            particleTex[i * particleTexChannels + 2] = ba0[0];
            particleTex[i * particleTexChannels + 3] = ba0[1];

            const rg1 = encodeFloatRG(packZ);
            particleTex[i * particleTexChannels + 0 + emitter.numParticlesPot * particleTexChannels] = rg1[0];
            particleTex[i * particleTexChannels + 1 + emitter.numParticlesPot * particleTexChannels] = rg1[1];

            const ba1 = encodeFloatRG(packA);
            particleTex[i * particleTexChannels + 2 + emitter.numParticlesPot * particleTexChannels] = ba1[0];
            particleTex[i * particleTexChannels + 3 + emitter.numParticlesPot * particleTexChannels] = ba1[1];

            const a2 = 1.0;
            particleTex[i * particleTexChannels + 3 + emitter.numParticlesPot * particleTexChannels * 2] = a2;

            const maxNegLife = Math.max(emitter.lifetime, (emitter.numParticles - 1.0) * (Math.max(emitter.rate, emitter.rate2)));
            const maxPosLife = emitter.lifetime + 1.0;
            startSpawnTime = (startSpawnTime + maxNegLife) / (maxNegLife + maxPosLife);
            const rgba3 = encodeFloatRGBA(startSpawnTime);
            particleTex[i * particleTexChannels + 0 + emitter.numParticlesPot * particleTexChannels * 3] = rgba3[0];
            particleTex[i * particleTexChannels + 1 + emitter.numParticlesPot * particleTexChannels * 3] = rgba3[1];
            particleTex[i * particleTexChannels + 2 + emitter.numParticlesPot * particleTexChannels * 3] = rgba3[2];
            particleTex[i * particleTexChannels + 3 + emitter.numParticlesPot * particleTexChannels * 3] = rgba3[3];

        } else {
            particleTex[i * particleTexChannels] =     randomPosTformed.x;
            particleTex[i * particleTexChannels + 1] = randomPosTformed.y;
            particleTex[i * particleTexChannels + 2] = randomPosTformed.z;
            particleTex[i * particleTexChannels + 3] = math.lerp(emitter.startAngle * math.DEG_TO_RAD, emitter.startAngle2 * math.DEG_TO_RAD, rX);

            particleTex[i * particleTexChannels + 3 + emitter.numParticlesPot * particleTexChannels] = startSpawnTime;
        }
    }

    // This should only change emitter state via in-params like data, vbToSort, etc.
    update(data, vbToSort, particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, delta, isOnStop) {
        let a, b, c;
        const emitter = this._emitter;

        if (emitter.meshInstance.node) {
            const fullMat = emitter.meshInstance.node.worldTransform;
            for (let j = 0; j < 12; j++) {
                rotMat.data[j] = fullMat.data[j];
            }
            rotMatInv.copy(rotMat);
            rotMatInv.invert();
            nonUniformScale = emitter.meshInstance.node.localScale;
            uniformScale = Math.max(Math.max(nonUniformScale.x, nonUniformScale.y), nonUniformScale.z);
        }

        // Particle updater emulation
        emitterPos = (emitter.meshInstance.node === null || emitter.localSpace) ? Vec3.ZERO : emitter.meshInstance.node.getPosition();
        const posCam = emitter.camera ? emitter.camera._node.getPosition() : Vec3.ZERO;

        const vertSize = !emitter.useMesh ? 15 : 17;
        let cf, cc;
        let rotSpeed, rotSpeed2, scale2, alpha, alpha2, radialSpeed, radialSpeed2;
        const precision1 = emitter.precision - 1;

        for (let i = 0; i < emitter.numParticles; i++) {
            const id = Math.floor(emitter.vbCPU[i * emitter.numParticleVerts * (emitter.useMesh ? 6 : 4) + 3]);

            const rndFactor = particleTex[id * particleTexChannels + 0 + emitter.numParticlesPot * 2 * particleTexChannels];
            rndFactor3Vec.x = rndFactor;
            rndFactor3Vec.y = particleTex[id * particleTexChannels + 1 + emitter.numParticlesPot * 2 * particleTexChannels];
            rndFactor3Vec.z = particleTex[id * particleTexChannels + 2 + emitter.numParticlesPot * 2 * particleTexChannels];

            const particleRate = emitter.rate + (emitter.rate2 - emitter.rate) * rndFactor;// pc.math.lerp(emitter.rate, emitter.rate2, rndFactor);

            const particleLifetime = emitter.lifetime;

            let life = particleTex[id * particleTexChannels + 3 + emitter.numParticlesPot * particleTexChannels] + delta;
            const nlife = saturate(life / particleLifetime);

            let scale = 0;
            let alphaDiv = 0;
            const angle = 0;

            const respawn = (life - delta) <= 0.0 || life >= particleLifetime;
            if (respawn) {
                this.calcSpawnPosition(particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, id);
            }

            let particleEnabled = life > 0.0 && life < particleLifetime;
            if (particleEnabled) {
                c = nlife * precision1;
                cf = Math.floor(c);
                cc = Math.ceil(c);
                c %= 1;

                // let rotSpeed =           tex1D(emitter.qRotSpeed, nlife);
                a = emitter.qRotSpeed[cf];
                b = emitter.qRotSpeed[cc];
                rotSpeed = a + (b - a) * c;

                // let rotSpeed2 =          tex1D(emitter.qRotSpeed2, nlife);
                a = emitter.qRotSpeed2[cf];
                b = emitter.qRotSpeed2[cc];
                rotSpeed2 = a + (b - a) * c;

                // scale =                  tex1D(emitter.qScale, nlife);
                a = emitter.qScale[cf];
                b = emitter.qScale[cc];
                scale = a + (b - a) * c;

                // let scale2 =             tex1D(emitter.qScale2, nlife);
                a = emitter.qScale2[cf];
                b = emitter.qScale2[cc];
                scale2 = a + (b - a) * c;

                // let alpha =              tex1D(emitter.qAlpha, nlife);
                a = emitter.qAlpha[cf];
                b = emitter.qAlpha[cc];
                alpha = a + (b - a) * c;

                // let alpha2 =             tex1D(emitter.qAlpha2, nlife);
                a = emitter.qAlpha2[cf];
                b = emitter.qAlpha2[cc];
                alpha2 = a + (b - a) * c;

                // let radialSpeed =        tex1D(emitter.qRadialSpeed, nlife);
                a = emitter.qRadialSpeed[cf];
                b = emitter.qRadialSpeed[cc];
                radialSpeed = a + (b - a) * c;
                // let radialSpeed2 =       tex1D(emitter.qRadialSpeed2, nlife);
                a = emitter.qRadialSpeed2[cf];
                b = emitter.qRadialSpeed2[cc];
                radialSpeed2 = a + (b - a) * c;
                radialSpeed += (radialSpeed2 - radialSpeed) * ((rndFactor * 100.0) % 1.0);

                particlePosPrev.x = particleTex[id * particleTexChannels];
                particlePosPrev.y = particleTex[id * particleTexChannels + 1];
                particlePosPrev.z = particleTex[id * particleTexChannels + 2];

                if (!emitter.localSpace)
                    radialVelocityVec.copy(particlePosPrev).sub(emitterPos);
                else
                    radialVelocityVec.copy(particlePosPrev);
                radialVelocityVec.normalize().mulScalar(radialSpeed);

                cf *= 3;
                cc *= 3;

                // localVelocityVec.data =  tex1D(emitter.qLocalVelocity, nlife, 3, localVelocityVec.data);
                a = emitter.qLocalVelocity[cf];
                b = emitter.qLocalVelocity[cc];
                localVelocityVec.x = a + (b - a) * c;
                a = emitter.qLocalVelocity[cf + 1];
                b = emitter.qLocalVelocity[cc + 1];
                localVelocityVec.y = a + (b - a) * c;
                a = emitter.qLocalVelocity[cf + 2];
                b = emitter.qLocalVelocity[cc + 2];
                localVelocityVec.z = a + (b - a) * c;

                // localVelocityVec2.data = tex1D(emitter.qLocalVelocity2, nlife, 3, localVelocityVec2.data);
                a = emitter.qLocalVelocity2[cf];
                b = emitter.qLocalVelocity2[cc];
                localVelocityVec2.x = a + (b - a) * c;
                a = emitter.qLocalVelocity2[cf + 1];
                b = emitter.qLocalVelocity2[cc + 1];
                localVelocityVec2.y = a + (b - a) * c;
                a = emitter.qLocalVelocity2[cf + 2];
                b = emitter.qLocalVelocity2[cc + 2];
                localVelocityVec2.z = a + (b - a) * c;

                // velocityVec.data =       tex1D(emitter.qVelocity, nlife, 3, velocityVec.data);
                a = emitter.qVelocity[cf];
                b = emitter.qVelocity[cc];
                velocityVec.x = a + (b - a) * c;
                a = emitter.qVelocity[cf + 1];
                b = emitter.qVelocity[cc + 1];
                velocityVec.y = a + (b - a) * c;
                a = emitter.qVelocity[cf + 2];
                b = emitter.qVelocity[cc + 2];
                velocityVec.z = a + (b - a) * c;

                // velocityVec2.data =      tex1D(emitter.qVelocity2, nlife, 3, velocityVec2.data);
                a = emitter.qVelocity2[cf];
                b = emitter.qVelocity2[cc];
                velocityVec2.x = a + (b - a) * c;
                a = emitter.qVelocity2[cf + 1];
                b = emitter.qVelocity2[cc + 1];
                velocityVec2.y = a + (b - a) * c;
                a = emitter.qVelocity2[cf + 2];
                b = emitter.qVelocity2[cc + 2];
                velocityVec2.z = a + (b - a) * c;

                localVelocityVec.x += (localVelocityVec2.x - localVelocityVec.x) * rndFactor3Vec.x;
                localVelocityVec.y += (localVelocityVec2.y - localVelocityVec.y) * rndFactor3Vec.y;
                localVelocityVec.z += (localVelocityVec2.z - localVelocityVec.z) * rndFactor3Vec.z;

                if (emitter.initialVelocity > 0) {
                    if (emitter.emitterShape === EMITTERSHAPE_SPHERE) {
                        randomPos.copy(rndFactor3Vec).mulScalar(2).sub(Vec3.ONE).normalize();
                        localVelocityVec.add(randomPos.mulScalar(emitter.initialVelocity));
                    } else {
                        localVelocityVec.add(Vec3.FORWARD.mulScalar(emitter.initialVelocity));
                    }
                }

                velocityVec.x += (velocityVec2.x - velocityVec.x) * rndFactor3Vec.x;
                velocityVec.y += (velocityVec2.y - velocityVec.y) * rndFactor3Vec.y;
                velocityVec.z += (velocityVec2.z - velocityVec.z) * rndFactor3Vec.z;

                rotSpeed += (rotSpeed2 - rotSpeed) * rndFactor3Vec.y;
                scale = (scale + (scale2 - scale) * ((rndFactor * 10000.0) % 1.0)) * uniformScale;
                alphaDiv = (alpha2 - alpha) * ((rndFactor * 1000.0) % 1.0);

                if (emitter.meshInstance.node) {
                    if (!emitter.localSpace) {
                        rotMat.transformPoint(localVelocityVec, localVelocityVec);
                    } else {
                        localVelocityVec.x /= nonUniformScale.x;
                        localVelocityVec.y /= nonUniformScale.y;
                        localVelocityVec.z /= nonUniformScale.z;
                    }

                }
                if (!emitter.localSpace) {
                    localVelocityVec.add(velocityVec.mul(nonUniformScale));
                    localVelocityVec.add(radialVelocityVec.mul(nonUniformScale));
                } else {
                    rotMatInv.transformPoint(velocityVec, velocityVec);
                    localVelocityVec.add(velocityVec).add(radialVelocityVec);
                }

                moveDirVec.copy(localVelocityVec);

                particlePos.copy(particlePosPrev).add(localVelocityVec.mulScalar(delta));
                particleFinalPos.copy(particlePos);

                particleTex[id * particleTexChannels] =      particleFinalPos.x;
                particleTex[id * particleTexChannels + 1] =  particleFinalPos.y;
                particleTex[id * particleTexChannels + 2] =  particleFinalPos.z;
                particleTex[id * particleTexChannels + 3] += rotSpeed * delta;

                if (emitter.wrap && emitter.wrapBounds) {
                    if (!emitter.localSpace)
                        particleFinalPos.sub(emitterPos);
                    particleFinalPos.x = glMod(particleFinalPos.x, emitter.wrapBounds.x) - emitter.wrapBounds.x * 0.5;
                    particleFinalPos.y = glMod(particleFinalPos.y, emitter.wrapBounds.y) - emitter.wrapBounds.y * 0.5;
                    particleFinalPos.z = glMod(particleFinalPos.z, emitter.wrapBounds.z) - emitter.wrapBounds.z * 0.5;
                    if (!emitter.localSpace)
                        particleFinalPos.add(emitterPos);
                }

                if (emitter.sort > 0) {
                    if (emitter.sort === 1) {
                        tmpVec3.copy(particleFinalPos).sub(posCam);
                        emitter.particleDistance[id] = -(tmpVec3.x * tmpVec3.x + tmpVec3.y * tmpVec3.y + tmpVec3.z * tmpVec3.z);
                    } else if (emitter.sort === 2) {
                        emitter.particleDistance[id] = life;
                    } else if (emitter.sort === 3) {
                        emitter.particleDistance[id] = -life;
                    }
                }
            }

            if (isOnStop) {
                if (life < 0) {
                    particleTex[id * particleTexChannels + 3 + emitter.numParticlesPot * 2 * particleTexChannels] = -1;
                }
            } else {
                if (life >= particleLifetime) {
                    // respawn particle by moving it's life back to zero.
                    // OR below zero, if there are still unspawned particles to be emitted before this one.
                    // such thing happens when you have an enormous amount of particles with short lifetime.
                    life -= Math.max(particleLifetime, (emitter.numParticles - 1) * particleRate);

                    // dead particles in a single-shot system continue their paths, but marked as invisible.
                    // it is necessary for keeping correct separation between particles, based on emission rate.
                    // dying again in a looped system they will become visible on next respawn.
                    particleTex[id * particleTexChannels + 3 + emitter.numParticlesPot * 2 * particleTexChannels] = emitter.loop ? 1 : -1;
                }
                if (life < 0 && emitter.loop) {
                    particleTex[id * particleTexChannels + 3 + emitter.numParticlesPot * 2 * particleTexChannels] = 1;
                }
            }
            if (particleTex[id * particleTexChannels + 3 + emitter.numParticlesPot * 2 * particleTexChannels] < 0)
                particleEnabled = false;
            particleTex[id * particleTexChannels + 3 + emitter.numParticlesPot * particleTexChannels] = life;

            for (let v = 0; v < emitter.numParticleVerts; v++) {
                const vbOffset = (i * emitter.numParticleVerts + v) * (emitter.useMesh ? 6 : 4);
                let quadX = emitter.vbCPU[vbOffset];
                let quadY = emitter.vbCPU[vbOffset + 1];
                let quadZ = emitter.vbCPU[vbOffset + 2];
                if (!particleEnabled) {
                    quadX = quadY = quadZ = 0;
                }

                const w = i * emitter.numParticleVerts * vertSize + v * vertSize;
                data[w] = particleFinalPos.x;
                data[w + 1] = particleFinalPos.y;
                data[w + 2] = particleFinalPos.z;
                data[w + 3] = nlife;
                data[w + 4] = emitter.alignToMotion ? angle : particleTex[id * particleTexChannels + 3];
                data[w + 5] = scale;
                data[w + 6] = alphaDiv;
                data[w + 7] = moveDirVec.x;
                data[w + 8] = quadX;
                data[w + 9] = quadY;
                data[w + 10] = quadZ;
                data[w + 11] = moveDirVec.y;
                data[w + 12] = id;
                data[w + 13] = moveDirVec.z;
                data[w + 14] = emitter.vbCPU[vbOffset + 3];
                if (emitter.useMesh) {
                    data[w + 15] = emitter.vbCPU[vbOffset + 4];
                    data[w + 16] = emitter.vbCPU[vbOffset + 5];
                }
            }
        }

        // Particle sorting
        if (emitter.sort > PARTICLESORT_NONE && emitter.camera) {
            const vbStride = emitter.useMesh ? 6 : 4;
            const particleDistance = emitter.particleDistance;
            for (let i = 0; i < emitter.numParticles; i++) {
                vbToSort[i][0] = i;
                vbToSort[i][1] = particleDistance[Math.floor(emitter.vbCPU[i * emitter.numParticleVerts * vbStride + 3])]; // particle id
            }

            emitter.vbOld.set(emitter.vbCPU);

            vbToSort.sort(function (p1, p2) {
                return p1[1] - p2[1];
            });

            for (let i = 0; i < emitter.numParticles; i++) {
                const src = vbToSort[i][0] * emitter.numParticleVerts * vbStride;
                const dest = i * emitter.numParticleVerts * vbStride;
                for (let j = 0; j < emitter.numParticleVerts * vbStride; j++) {
                    emitter.vbCPU[dest + j] = emitter.vbOld[src + j];
                }
            }
        }
    }
}

export { ParticleCPUUpdater };
