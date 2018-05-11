const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const request   = require( 'sync-request' );

const options = {
    resources  : 'usable',
    runScripts : 'dangerously',
};

// JSDOM.fromFile( './tct-7672.html', {} )
//     .then( dom => {
//         getSortedTopicNamesFromTct( dom );
//     } );

var response             = request( 'GET', 'https://nyuapi.infoloom.nyc/api/hit/basket/62/?format=json' ),
    tctData              = JSON.parse( response.body, '' ),
    tctTopicName         = tctData.basket.display_name,
    tctRelatedTopicNames = tctData.relations.map( relation => {
        return relation.basket.display_name
    } ).sort();

diffNames();

function diffNames() {
    JSDOM.fromURL( "http://dlib.nyu.edu/enm/enm-web/prototypes/topic-pages/00/00/00/00/0000000062.html", options )
        .then( dom => {
            var enmTopicNames        = getSortedTopicNamesFromScript( dom.window.document.querySelector( 'script' ).textContent ),
                enmRelatedTopicNames = enmTopicNames.filter( name => {
                    return name !== tctTopicName;
                } );
            inTctButNotEnm           = _.difference( tctRelatedTopicNames, enmRelatedTopicNames );
            inEnmButNotTct           = _.difference( enmRelatedTopicNames, tctRelatedTopicNames );

            console.log( inTctButNotEnm );
            console.log( inEnmButNotTct );
        } )
        .catch( error => {
            console.error( 'ERROR: ' + error )
        } );
}

function getSortedTopicNamesFromScript( script ) {
    var visualizationData = JSON.parse( script.replace( /^var visualizationData = /, '' ) );

    return visualizationData.nodes.map( ( node ) => {
        return node.name;
    } ).sort();
}