/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx }) {
    const { BindingTwoWay, LabelGroup, SliderInput } = ReactPCUI;
    class JsxControls extends React.Component {
        render() {
            const binding = new BindingTwoWay();
            const link = {
                observer,
                path: 'blend'
            };
            return jsx(LabelGroup, { text: 'blend' }, jsx(SliderInput, { binding, link }));
        }
    }
    return jsx(JsxControls);
}
