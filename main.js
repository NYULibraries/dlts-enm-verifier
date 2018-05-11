const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const options = {
    resources : 'usable',
    runScripts: 'dangerously',
};

JSDOM.fromURL( "http://dlib.nyu.edu/enm/enm-web/prototypes/topic-pages/00/00/00/76/0000007672.html", options )
    .then( dom => {
        var enmTopicNames = getSortedTopicNamesFromScript( dom.window.document.querySelector( 'script' ).textContent );
    } )
    .catch( error => {
        console.error( 'ERROR: ' + error )
    } );

function getSortedTopicNamesFromEnm() {
    JSDOM.fromURL( "http://dlib.nyu.edu/enm/enm-web/prototypes/topic-pages/00/00/00/76/0000007672.html", options )
        .then( dom => {
            var enmTopicNames = getSortedTopicNamesFromScript( dom.window.document.querySelector( 'script' ).textContent );
        } )
        .catch( error => {
            console.error( 'ERROR: ' + error )
        } );
}

function getSortedTopicNamesFromScript( script ) {
    var visualizationData = JSON.parse( script.replace( /^var visualizationData = /, '' ) );
    var topicNames = visualizationData.nodes.map( ( node ) => { return node.name; } ).sort();
}