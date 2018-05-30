const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const path      = require( 'path' );
const process   = require( 'process' );
const request   = require( 'sync-request' );
const stringify = require( 'json-stable-stringify' );

const cacheDir       = __dirname + '/cache';
const enmCacheDir    = cacheDir + '/enm';
const tctCacheDir    = cacheDir + '/tct';

const reportsDir     = __dirname + '/reports';

const stringifySpace = '    ';

var argv = require( 'minimist' )( process.argv.slice( 2 ), { string: '_' } ),
    cache = argv[ 'cache' ] || true,
    countRelatedTopicsOccurrences = argv[ 'count-related-topics-occurrences' ] || false,
    enmLocal = argv[ 'use-enm-local' ] ? normalizePath( argv[ 'use-enm-local' ] ) : false,
    tctLocal = argv[ 'use-tct-local' ] ? normalizePath( argv[ 'use-tct-local' ] ) : false,
    topicIds = argv._,
    epubsAllTctResponse = getEpubsAllResponseBody(),
    epubs = {};

epubsAllTctResponse.forEach( epub => {
    epubs[ epub.title ] = {
        author: epub.author,
        id: epub.id,
        isbn: epub.isbn,
        publisher: epub.publisher,
    };
} );

topicIds.forEach( topicId => {
    writeDiffReport( topicId );
} );

function writeDiffReport( topicId ) {
    var tct = getTctData( topicId ),
        enm = getEnmData( topicId, tct.topicName ),

        diffs = {};

    diffs.relatedTopicsInTctNotInEnm = _.difference( tct.relatedTopicNames, enm.relatedTopicNames );
    diffs.relatedTopicsInEnmNotTct = _.difference( enm.relatedTopicNames, tct.relatedTopicNames );

    diffs.epubsInTctNotInEnm = _.difference( tct.epubs, enm.epubs );
    diffs.epubsInEnmNotInTct = _.difference( enm.epubs, tct.epubs );

    diffs.authorPublisherInTctNotInEnm = _.difference( tct.authorPublishers, enm.authorPublishers );
    diffs.authorPublisherInEnmNotInTct = _.difference( enm.authorPublishers, tct.authorPublishers );

    if ( cache ) {
        if ( ! tctLocal ) {
            // Cache TCT response body
           fs.writeFileSync( `${ tctCacheDir }/${ topicId }.json`, tct.responseBody );
        }

        if ( ! enmLocal ) {
            // Cache ENM response body
            fs.writeFileSync( `${ enmCacheDir }/${ topicId }.html`, enmTopicPage );
        }
    }

    if ( diffs.relatedTopicsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-topics.json`,
                          stableStringify( diffs.relatedTopicsInTctNotInEnm ) );
    }

    if ( diffs.relatedTopicsInEnmNotTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-topics.json`,
                          stableStringify( diffs.relatedTopicsInEnmNotTct ) );
    }

    if ( diffs.epubsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-epubs.json`,
                          stableStringify( diffs.epubsInTctNotInEnm ) );
    }

    if ( diffs.epubsInEnmNotInTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-epubs.json`,
                          stableStringify( diffs.epubsInEnmNotInTct ) );
    }

    if ( diffs.authorPublisherInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-authorPublishers.json`,
                          stableStringify( diffs.authorPublisherInTctNotInEnm ) );
    }

    if ( diffs.authorPublisherInEnmNotInTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-authorPublishers.json`,
                          stableStringify( diffs.authorPublisherInEnmNotInTct ) );
    }
}

function getTctData( topicId ) {
    var tct = {};

    tct.responseBody = getTctResponseBody( topicId );

    tct.json = JSON.parse( tct.responseBody, '' );

    tct.topicName = tct.json.basket.display_name;

    tct.relatedTopicNames = tct.json.relations.map( relation => {
        return relation.basket.display_name
    } ).sort( caseInsensitiveSort );

    tct.epubs = _.sortedUniq( tct.json.basket.occurs.map( occurrence => {
        return occurrence.location.document.title;
    } ).sort( caseInsensitiveSort ) );

    tct.authorPublishers = tct.epubs.map( epubTitle => {
        var author    = epubs[ epubTitle ].author,
            publisher = epubs[ epubTitle ].publisher;

        return `${ author }; ${ publisher }`;
    } ).sort( caseInsensitiveSort );

    return tct;
}

function getEnmData( topicId, topicName ) {
    var enm = {};

    enm.responseBody = getEnmResponseBody( topicId );

    enm.dom = new JSDOM( enm.responseBody );

    enm.topicNames  = getSortedTopicNamesFromScript( enm.dom.window.document.querySelector( 'script' ).textContent ),

    enm.relatedTopicNames = enm.topicNames.filter( name => {
            return name !== topicName;
    } );

    enm.epubs = Array.from( enm.dom.window.document.querySelectorAll( 'h3.title') )
            .map( epubNode => {
                return epubNode.textContent.trim();
            } )
            .sort( caseInsensitiveSort );

    enm.authorPublishers = Array.from( enm.dom.window.document.querySelectorAll( 'div.meta') )
        .map( authorPublisherNode => {
            return authorPublisherNode.textContent.trim();
        } )
        .sort( caseInsensitiveSort );

    return enm;
}

function normalizePath( pathString ) {
    if ( ! path.isAbsolute( pathString ) ) {
        pathString = __dirname + '/' + pathString;
    }

    if ( pathString !== '/' ) {
        return pathString.replace( /\/+$/, '' );
    } else {
        return pathString;
    }
}

function getEpubsAllResponseBody() {
    if ( tctLocal ) {
        return require( `${ tctLocal }/EpubsAll.json` );
    } else {
        return require( __dirname + '/test/tct/EpubsAll.json' );
    }
}

function getTctResponseBody( topicId ) {
    if ( tctLocal ) {
        return fs.readFileSync( `${ tctLocal }/${ topicId }.json`, 'utf8' );
    } else {
        return request( 'GET', `https://nyuapi.infoloom.nyc/api/hit/basket/${ topicId }/?format=json` ).body;
    }
}

function getEnmResponseBody( topicId ) {
    if ( enmLocal ) {
        return fs.readFileSync( `${ enmLocal }/${ topicId }.html`, 'utf8' );
    } else {
        return request( 'GET', getEnmTopicPageUrl( topicId ) ).body;
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

function stableStringify( json ) {
    return stringify( json, { space: '    ' } );
}