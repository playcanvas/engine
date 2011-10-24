/**
 * @namespace Contains directories for accessing content
 * @name pc.content
 */
pc.content = function () {
    return {
        /**
         * The url of the game code relative to the page.
         * @name pc.content.source
         */
        source: "",
        /**
         * The url of the assets relative to the page
         * @name pc.content.assets
         */
        assets: null,
        
        /**
         * Entity Data exported from the game database is store in the data attribute
         */
        data: {},
        
        /**
         * If data is access via a repository then the username of the owner is required
         */
        username: null,

        /**
         * If data is access via a repository then the project name is required
         */
        project: null

        /*
        gameRoot: "http://localhost/gamedb/",
        gameBranch: "gamedb/",
        //gameURI: pc.path.join(pc.content.gameRoot, pc.content.gameBranch);
        gameURI: "http://localhost/webgamedk/tools/src/kedit/kedit/models/fixtures/",
        
        assetRoot: "http://localhost/webgamedk/tests/data/",
        assetBranch: "",
        assetURI: pc.path.join(content.assetRoot, content.assetBranch)
        */
    };
} ();

