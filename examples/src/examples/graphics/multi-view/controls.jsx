import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

import {
    SHADERPASS_ALBEDO,
    SHADERPASS_AO,
    SHADERPASS_EMISSION,
    SHADERPASS_FORWARD,
    SHADERPASS_GLOSS,
    SHADERPASS_LIGHTING,
    SHADERPASS_METALNESS,
    SHADERPASS_OPACITY,
    SHADERPASS_SPECULARITY,
    SHADERPASS_UV0,
    SHADERPASS_WORLDNORMAL
} from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [shaderPass, setShaderPass] = useState(
        observer.get('settings.shaderPassName') ?? SHADERPASS_FORWARD
    );

    useEffect(() => {
        const event = observer.on('settings.shaderPassName:set', () => {
            setShaderPass(observer.get('settings.shaderPassName'));
        });
        return () => event?.unbind();
    }, [observer]);

    const debugActive = shaderPass !== SHADERPASS_FORWARD;

    return (
        <>
            <Panel headerText='Top Camera Frame' enabled={!debugActive}>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.cameraFrame' }}
                    />
                </LabelGroup>
                <LabelGroup text='Bloom'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.bloomIntensity' }}
                        min={0}
                        max={0.1}
                        precision={3}
                        step={0.001}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Debug Shader Rendering'>
                <LabelGroup text='Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shaderPassName' }}
                        type='string'
                        options={[
                            { v: SHADERPASS_FORWARD, t: 'None' },
                            { v: SHADERPASS_ALBEDO, t: 'Albedo' },
                            { v: SHADERPASS_OPACITY, t: 'Opacity' },
                            { v: SHADERPASS_WORLDNORMAL, t: 'World Normal' },
                            { v: SHADERPASS_SPECULARITY, t: 'Specularity' },
                            { v: SHADERPASS_GLOSS, t: 'Gloss' },
                            { v: SHADERPASS_METALNESS, t: 'Metalness' },
                            { v: SHADERPASS_AO, t: 'AO' },
                            { v: SHADERPASS_EMISSION, t: 'Emission' },
                            { v: SHADERPASS_LIGHTING, t: 'Lighting' },
                            { v: SHADERPASS_UV0, t: 'UV0' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
