const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const path      = require( 'path' );
const process   = require( 'process' );
const request   = require( 'sync-request' );

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
    var tctResponseBody      = getTctResponseBody( topicId ),
        tctData              = JSON.parse( tctResponseBody, '' ),
        tctTopicName         = tctData.basket.display_name,
        tctRelatedTopicNames = tctData.relations.map( relation => {
            return relation.basket.display_name
        } ).sort( caseInsensitiveSort ),
        tctEpubs             = _.sortedUniq( tctData.basket.occurs.map( occurrence => {
            return occurrence.location.document.title;
        } ).sort( caseInsensitiveSort ) ),
        tctAuthorPublishers  = tctEpubs.map( epubTitle => {
            var author    = epubs[ epubTitle ].author,
                publisher = epubs[ epubTitle ].publisher;

            return `${ author }; ${ publisher }`;
        } ).sort( caseInsensitiveSort ),

        enmTopicPage         = getEnmResponseBody( topicId ),
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
        enmAuthorPublishers  = Array.from( dom.window.document.querySelectorAll( 'div.meta') )
            .map( authorPublisherNode => {
                return authorPublisherNode.textContent.trim();
            } )
            .sort( caseInsensitiveSort ),

        relatedTopicsInTctNotInEnm = _.difference( tctRelatedTopicNames, enmRelatedTopicNames ),
        relatedTopicsInEnmNotTct   = _.difference( enmRelatedTopicNames, tctRelatedTopicNames ),

        epubsInTctNotInEnm         = _.difference( tctEpubs, enmEpubs ),
        epubsInEnmNotInTct         = _.difference( enmEpubs, tctEpubs ),

        authorPublisherInTctNotInEnm = _.difference( tctAuthorPublishers, enmAuthorPublishers ),
        authorPublisherInEnmNotInTct = _.difference( enmAuthorPublishers, tctAuthorPublishers );

    if ( cache ) {
        if ( ! tctLocal ) {
            // Cache TCT response body
           fs.writeFileSync( `${ tctCacheDir }/${ topicId }.json`, tctResponseBody );
        }

        if ( ! enmLocal ) {
            // Cache ENM response body
            fs.writeFileSync( `${ enmCacheDir }/${ topicId }.html`, enmTopicPage );
        }
    }

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

    if ( authorPublisherInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-authorPublishers.json`,
                          JSON.stringify( authorPublisherInTctNotInEnm ), null, stringifySpace );
    }

    if ( authorPublisherInEnmNotInTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-authorPublishers.json`,
                          JSON.stringify( authorPublisherInEnmNotInTct ), null, stringifySpace );
    }
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