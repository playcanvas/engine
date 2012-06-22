pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AppData
     * @class AppData contains global data about the application that is loaded from Entity or Exported data
     * For Exported applications it comes from pc.content.data['application'], for development applications it comes from the designer Component in the initial Pack
     * @constructor Create a new pc.fw.AppData instance either from the export data or from Component data 
     * @param {Object} source either pc.content.data['application'] or the designer Component in as a source
     */
    var AppData = function (source) {
        this.fillWindow = source['fill_window'];
        this.width = source['width'];
        this.height = source['height']
        this.keepAspect = source['keep_aspect'];
    };
    
    return {
        AppData: AppData
    };
}());
