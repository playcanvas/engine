import {
    BindingTwoWay,
    LabelGroup,
    BooleanInput,
    Panel,
    SliderInput,
    Label
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {string} hex - A '#rrggbb' color.
 * @returns {number} Its relative luminance, 0..1.
 */
const luminance = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
};

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    // legend for Colorize LODs, one swatch per LOD level
    const [lodColors, setLodColors] = useState(observer.get('data.lodColors') ?? []);
    useEffect(() => {
        // observer.on returns an EventHandle to unbind with - the observer has no 'off' method
        const event = observer.on('data.lodColors:set', () => {
            setLodColors(observer.get('data.lodColors') ?? []);
        });
        return () => event?.unbind();
    }, [observer]);

    return (
        <>
            <Panel headerText='Settings'>
                <LabelGroup text='Instances'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'instances' }}
                        min={1}
                        max={100}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
                <LabelGroup text='Colorize LODs'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'colorizeLods' }}
                        value={observer.get('colorizeLods') || false}
                    />
                </LabelGroup>
                {/* three rows, one column per triple of levels, so the hue turns along each row */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateRows: 'repeat(3, 18px)',
                        gridAutoFlow: 'column',
                        gridAutoColumns: 28,
                        gap: 2,
                        padding: '4px 6px'
                    }}
                >
                    {lodColors.map((color, lod) => (
                        <div
                            key={lod}
                            style={{
                                background: color,
                                color: luminance(color) < 0.4 ? '#fff' : '#000',
                                fontSize: 10,
                                lineHeight: '18px',
                                textAlign: 'center'
                            }}
                        >
                            {lod}
                        </div>
                    ))}
                </div>
                <LabelGroup text='LOD Multiplier'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodMultiplier' }}
                        min={1.2}
                        max={3}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Sky Rotation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'skyRotation' }}
                        min={0}
                        max={360}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Total Splats'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.splatsTotal' }}
                        value={observer.get('data.stats.splatsTotal')}
                    />
                </LabelGroup>
                <LabelGroup text='Active Splats'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.gsplats' }}
                        value={observer.get('data.stats.gsplats')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
