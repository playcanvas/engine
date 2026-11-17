import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

const fittings = [
    { v: 'none', t: 'None' },
    { v: 'stretch', t: 'Stretch' },
    { v: 'shrink', t: 'Shrink' },
    { v: 'both', t: 'Both' }
];

/**
 * @param {{ observer: Observer }} props - Control panel properties.
 * @returns {ReactElement} The controls.
 */
export function Controls({ observer }) {
    /**
     * @param {string} name - The setting.
     * @param {string} title - The label.
     * @returns {ReactElement} A toggle.
     */
    const toggle = (name, title) => (
        <LabelGroup text={title}>
            <BooleanInput
                type='toggle'
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${name}` }}
            />
        </LabelGroup>
    );

    /**
     * @param {string} name - The setting.
     * @param {string} title - The label.
     * @param {{ v: string, t: string }[]} options - The choices.
     * @returns {ReactElement} A select input.
     */
    const select = (name, title, options) => (
        <LabelGroup text={title}>
            <SelectInput
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${name}` }}
                options={options}
            />
        </LabelGroup>
    );

    return (
        <>
            <Panel headerText='Element states'>{toggle('animate', 'Animate')}</Panel>
            <Panel headerText='01 / Sprite'>
                {select('sprite', 'Render mode', [
                    { v: 'simple', t: 'Simple' },
                    { v: 'sliced', t: 'Sliced' },
                    { v: 'tiled', t: 'Tiled' }
                ])}
            </Panel>
            <Panel headerText='02 / Scroll view'>
                {select('scrollMode', 'Scroll mode', [
                    { v: 'clamp', t: 'Clamp' },
                    { v: 'bounce', t: 'Bounce' },
                    { v: 'infinite', t: 'Infinite' }
                ])}
                {select('scrollbars', 'Scrollbars', [
                    { v: 'always', t: 'Always' },
                    { v: 'required', t: 'When required' }
                ])}
                {select('content', 'Content', [
                    { v: 'large', t: 'Larger than view' },
                    { v: 'narrow', t: 'Narrower than view' },
                    { v: 'small', t: 'Smaller than view' }
                ])}
            </Panel>
            <Panel headerText='03 / Layout group'>
                {select('widthFitting', 'Width fitting', fittings)}
                {select('heightFitting', 'Height fitting', fittings)}
                {toggle('wrap', 'Wrap')}
            </Panel>
            <Panel headerText='05 / Masks'>{toggle('masks', 'Masks')}</Panel>
        </>
    );
}
