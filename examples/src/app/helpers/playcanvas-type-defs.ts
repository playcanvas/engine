const playcanvasTypeDefs = (() => {
    // @ts-ignore: use of require context
    // const files = require.context('!!raw-loader!../../../node_modules/playcanvas/build/', true, /\.d.ts$/);
    let result;
    // files.keys().forEach((key: string) => {
    //     result = files(key).default;
    // });
    // return null;
})();

export default playcanvasTypeDefs;
