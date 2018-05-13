const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const request   = require( 'sync-request' );

const reportsDir     = __dirname + '/reports';
const stringifySpace = '    ';

// JSDOM.fromFile( './tct-7672.html', {} )
//     .then( dom => {
//         getSortedTopicNamesFromTct( dom );
//     } );

var topicIds = process.argv.slice( 2 );

topicIds.forEach( topicId => {
    writeDiffReport( topicId );
} );

function writeDiffReport( topicId ) {
    var tctUrl               = `https://nyuapi.infoloom.nyc/api/hit/basket/${ topicId }/?format=json`,
        tctData              = JSON.parse( request( 'GET', tctUrl ).body, '' ),
        tctTopicName         = tctData.basket.display_name,
        tctRelatedTopicNames = tctData.relations.map( relation => {
            return relation.basket.display_name
        } ).sort( caseInsensitiveSort ),
        tctEpubs             = _.sortedUniq( tctData.basket.occurs.map( occurrence => {
            return occurrence.location.document.title;
        } ).sort( caseInsensitiveSort ) ),

        enmTopicPageUrl      = getEnmTopicPageUrl( topicId ),
        enmTopicPage         = request( 'GET', enmTopicPageUrl ).body,
        dom                  = new JSDOM( enmTopicPage ),
        enmTopicNames        = getSortedTopicNamesFromScript( dom.window.document.querySelector( 'script' ).textContent ),
        enmRelatedTopicNames = enmTopicNames.filter( name => {
            return name !== tctTopicName;
        } ),
        enmEpubs             = Array.from( dom.window.document.querySelectorAll( 'h3.title') )
            .map( epubNode => {
                return epubNode.textContent.trim();
            } )
            .sort( caseInsensitiveSort ),

        relatedTopicsInTctNotInEnm = _.difference( tctRelatedTopicNames, enmRelatedTopicNames ),
        relatedTopicsInEnmNotTct   = _.difference( enmRelatedTopicNames, tctRelatedTopicNames ),

        epubsInTctNotInEnm         = _.difference( tctEpubs, enmEpubs ),
        epubsInEnmNotInTct         = _.difference( enmEpubs, tctEpubs );


    if ( relatedTopicsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-topics.json`,
                          JSON.stringify( relatedTopicsInTctNotInEnm, null, stringifySpace ) );
    }

    if ( relatedTopicsInEnmNotTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-topics.json`,
                          JSON.stringify( relatedTopicsInEnmNotTct, null, stringifySpace ) );
    }

    if ( epubsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-epubs.json`,
                          JSON.stringify( epubsInTctNotInEnm ), null, stringifySpace );
    }

    if ( epubsInEnmNotInTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-epubs.json`,
                          JSON.stringify( epubsInEnmNotInTct ), null, stringifySpace );
    }
}

function caseInsensitiveSort( a, b ) {
    return a.toLowerCase().localeCompare( b.toLowerCase() );
}

function getEnmTopicPageUrl( id ) {
    var zeroPaddedString = id.padStart( 10, "0" );

    return 'http://dlib.nyu.edu/enm/enm-web/prototypes/topic-pages/' +
               zeroPaddedString.substring( 0, 2 ) + "/" +
               zeroPaddedString.substring( 2, 4 ) + "/" +
               zeroPaddedString.substring( 4, 6 ) + "/" +
               zeroPaddedString.substring( 6, 8 ) + "/" +
               zeroPaddedString + '.html';
}

function getSortedTopicNamesFromScript( script ) {
    var visualizationData = JSON.parse( script.replace( /^var visualizationData = /, '' ) );

    return visualizationData.nodes.map( ( node ) => {
        return node.name;
    } ).sort( caseInsensitiveSort );
}