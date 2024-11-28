import { Script } from 'playcanvas';

export default class XrControllers extends Script {
    /**
     * The base URL for fetching the WebXR input profiles.
     *
     * @attribute
     * @type {string}
     */
    basePath = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets/dist/profiles';

    controllers = new Map();

    initialize() {
        this.app.xr.input.on('add', async (inputSource) => {
            if (!inputSource.profiles?.length) {
                console.warn('No profiles available for input source');
                return;
            }

            // Try each profile in order until one works
            for (const profileId of inputSource.profiles) {
                const profileUrl = `${this.basePath}/${profileId}/profile.json`;

                try {
                    // Fetch the profile
                    const response = await fetch(profileUrl);
                    if (!response.ok) {
                        continue;
                    }
                    
                    const profile = await response.json();
                    const layoutPath = profile.layouts[inputSource.handedness]?.assetPath || '';
                    const assetPath = `${this.basePath}/${profile.profileId}/${inputSource.handedness}${layoutPath.replace(/^\/?(left|right)/, '')}`;

                    // Try to load the model
                    try {
                        const asset = await new Promise((resolve, reject) => {
                            this.app.assets.loadFromUrl(assetPath, 'container', (err, asset) => {
                                if (err) reject(err);
                                else resolve(asset);
                            });
                        });

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
                        return;

                    } catch (error) {
                        console.warn(`Failed to load model for profile ${profileId}, trying next...`);
                        continue;
                    }

                } catch (error) {
                    console.warn(`Failed to fetch profile ${profileId}, trying next...`);
                    continue;
                }
            }

            // If we get here, none of the profiles worked
            console.warn('No compatible profiles found');
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
        if (this.app.xr.active) {
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
