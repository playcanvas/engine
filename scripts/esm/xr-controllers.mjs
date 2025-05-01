import { Script } from 'playcanvas';

class XrControllers extends Script {
    static scriptName = 'xrControllers';

    /**
     * The base URL for fetching the WebXR input profiles.
     *
     * @attribute
     * @type {string}
     */
    basePath = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets/dist/profiles';

    controllers = new Map();

    initialize() {
        if (!this.app.xr) {
            console.error('XrControllers script requires XR to be enabled on the application');
            return;
        }

        this.app.xr.input.on('add', async (inputSource) => {
            if (!inputSource.profiles?.length) {
                console.warn('No profiles available for input source');
                return;
            }

            // Process all profiles concurrently
            const profilePromises = inputSource.profiles.map(async (profileId) => {
                const profileUrl = `${this.basePath}/${profileId}/profile.json`;

                try {
                    const response = await fetch(profileUrl);
                    if (!response.ok) {
                        return null;
                    }

                    const profile = await response.json();
                    const layoutPath = profile.layouts[inputSource.handedness]?.assetPath || '';
                    const assetPath = `${this.basePath}/${profile.profileId}/${inputSource.handedness}${layoutPath.replace(/^\/?(left|right)/, '')}`;

                    // Load the model
                    const asset = await new Promise((resolve, reject) => {
                        this.app.assets.loadFromUrl(assetPath, 'container', (err, asset) => {
                            if (err) reject(err);
                            else resolve(asset);
                        });
                    });

                    return { profileId, asset };
                } catch (error) {
                    console.warn(`Failed to process profile ${profileId}`);
                    return null;
                }
            });

            // Wait for all profile attempts to complete
            const results = await Promise.all(profilePromises);
            const successfulResult = results.find(result => result !== null);

            if (successfulResult) {
                const { asset } = successfulResult;
                const container = asset.resource;
                const entity = container.instantiateRenderEntity();
                this.app.root.addChild(entity);

                const jointMap = new Map();
                if (inputSource.hand) {
                    for (const joint of inputSource.hand.joints) {
                        const jointEntity = entity.findByName(joint.id);
                        if (jointEntity) {
                            jointMap.set(joint, jointEntity);
                        }
                    }
                }

                this.controllers.set(inputSource, { entity, jointMap });
            } else {
                console.warn('No compatible profiles found');
            }
        });

        this.app.xr.input.on('remove', (inputSource) => {
            const controller = this.controllers.get(inputSource);
            if (controller) {
                controller.entity.destroy();
                this.controllers.delete(inputSource);
            }
        });
    }

    update(dt) {
        if (this.app.xr?.active) {
            for (const [inputSource, { entity, jointMap }] of this.controllers) {
                if (inputSource.hand) {
                    for (const [joint, jointEntity] of jointMap) {
                        jointEntity.setPosition(joint.getPosition());
                        jointEntity.setRotation(joint.getRotation());
                    }
                } else {
                    entity.setPosition(inputSource.getPosition());
                    entity.setRotation(inputSource.getRotation());
                }
            }
        }
    }
}

export { XrControllers };
