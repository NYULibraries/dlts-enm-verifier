const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const path      = require( 'path' );
const process   = require( 'process' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const commandName = 'topicpages';

var program,
    directories,
    topicIds,
    epubsAllTctResponse,
    epubs = {},
    enmCache, tctCache,
    reportsDir;


function init( programArg, directoriesArg ) {
    program     = programArg;
    directories = directoriesArg;

    enmCache   = `${ directories.cache.enm }/${ commandName }`;
    tctCache   = `${ directories.cache.tct }/${ commandName }`;
    reportsDir = `${ directories.reports }/${ commandName }`;

    util.clearDirectory( enmCache );
    util.clearDirectory( tctCache );
    util.clearDirectory( reportsDir );

    program
        .command( `${ commandName } [topicIds...]` )
        .option( '--count-related-topics-occurrences', 'Verify occurrence counts' )
        .action( verify );
}

function verify( topicIdsArgs ) {
    countRelatedTopicsOccurrences = this.countRelatedTopicsOccurrences;

    topicIds = topicIdsArgs;

    epubsAllTctResponse = util.getEpubsAllResponseBody( program, directories );

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
        compareTctAndEnm( topicId );
    } );
}

function compareTctAndEnm( topicId ) {
    var tct = getTctData( topicId ),
        enm = getEnmData( topicId, tct.topicName ),

        diffs = generateDiffs( tct, enm );

    writeDiffReports( topicId, diffs );
}

function getTctData( topicId ) {
    var tct = {};

    tct.responseBody = getTctResponseBody( topicId );

    tct.json = JSON.parse( tct.responseBody, '' );

    tct.topicName = tct.json.basket.display_name;
    tct.topicOccurrenceCounts = {};
    tct.topicOccurrenceCounts[ tct.topicName ] = tct.json.basket.occurs.length;

    if ( tct.json.relations ) {
        tct.relatedTopicNames = [];

        tct.json.relations.forEach( relation => {
            var relatedTopicName = relation.basket.display_name;
            tct.relatedTopicNames.push( relatedTopicName );

            if ( countRelatedTopicsOccurrences ) {
                tct.topicOccurrenceCounts[ relatedTopicName ] =
                    getTctOccurrenceCounts( relation.basket.id );
            }
        } );

        tct.relatedTopicNames = tct.relatedTopicNames.sort( util.caseInsensitiveSort );
    }

    tct.epubs = _.sortedUniq( tct.json.basket.occurs.map( occurrence => {
        return occurrence.location.document.title;
    } ).sort( util.caseInsensitiveSort ) );

    tct.authorPublishers = tct.epubs.map( epubTitle => {
        var author    = epubs[ epubTitle ].author,
            publisher = epubs[ epubTitle ].publisher;

        return `${ author }; ${ publisher }`;
    } ).sort( util.caseInsensitiveSort );

    return tct;
}

function getEnmData( topicId, topicName ) {
    var enm = {},
        visualizationData;

    enm.responseBody = getEnmResponseBody( topicId );

    enm.dom = new JSDOM( enm.responseBody );

    visualizationData = getVisualizationDataFromScript(
        enm.dom.window.document.querySelector( 'script' ).textContent
    );

    enm.topicNames = visualizationData.nodes.map( ( node ) => {
        return node.name;
    } ).sort( util.caseInsensitiveSort );

    enm.relatedTopicNames = enm.topicNames.filter( name => {
        return name !== topicName;
    } );

    // It's cheap to get all topic occurrence counts, so do it whether user
    // requested it or not.
    enm.topicOccurrenceCounts = {};
    visualizationData.nodes.forEach( node => {
        enm.topicOccurrenceCounts[ node.name ] = node.ocount;
    } );

    enm.epubs = Array.from( enm.dom.window.document.querySelectorAll( 'h3.title') )
        .map( epubNode => {
            return epubNode.textContent.trim();
        } )
        .sort( util.caseInsensitiveSort );

    enm.authorPublishers = Array.from( enm.dom.window.document.querySelectorAll( 'div.meta') )
        .map( authorPublisherNode => {
            return authorPublisherNode.textContent.trim();
        } )
        .sort( util.caseInsensitiveSort );

    return enm;
}

function getTctResponseBody( topicId ) {
    var responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/${ topicId }.json`, 'utf8' );
    } else {
        responseBody = request( 'GET', `https://${ program.tctHost }/api/hit/basket/${ topicId }/?format=json` ).body;

        // Cache TCT response body
        fs.writeFileSync( `${ tctCache }/${ topicId }.json`, responseBody );
    }

    return responseBody;
}

function getEnmResponseBody( topicId ) {
    var responseBody;

    if ( program.enmLocal ) {
        responseBody = fs.readFileSync( `${ program.enmLocal }/${ topicId }.html`, 'utf8' );
    } else {
        responseBody = request( 'GET', getEnmTopicPageUrl( topicId ) ).body;

        fs.writeFileSync( `${ enmCache }/${ topicId }.html`, responseBody );
    }

    return responseBody;
}

function getEnmTopicPageUrl( id ) {
    var zeroPaddedString = id.padStart( 10, "0" );

    return `http://${ program.enmHost }/enm/enm-web/prototypes/topic-pages/` +
           zeroPaddedString.substring( 0, 2 ) + "/" +
           zeroPaddedString.substring( 2, 4 ) + "/" +
           zeroPaddedString.substring( 4, 6 ) + "/" +
           zeroPaddedString.substring( 6, 8 ) + "/" +
           zeroPaddedString + '.html';
}

function getVisualizationDataFromScript( script ) {
    var visualizationData = JSON.parse( script.replace( /^var visualizationData = /, '' ) );

    return visualizationData;
}

function generateDiffs( tct, enm ) {
    var diffs = {};

    diffs.relatedTopicsInTctNotInEnm = _.difference( tct.relatedTopicNames, enm.relatedTopicNames );
    diffs.relatedTopicsInEnmNotTct = _.difference( enm.relatedTopicNames, tct.relatedTopicNames );

    diffs.epubsInTctNotInEnm = _.difference( tct.epubs, enm.epubs );
    diffs.epubsInEnmNotInTct = _.difference( enm.epubs, tct.epubs );

    diffs.authorPublisherInTctNotInEnm = _.difference( tct.authorPublishers, enm.authorPublishers );
    diffs.authorPublisherInEnmNotInTct = _.difference( enm.authorPublishers, tct.authorPublishers );

    if ( countRelatedTopicsOccurrences ) {
        diffs.topicOccurrenceCounts = getTopicOccurrenceCountsDifference(
            tct.topicOccurrenceCounts,
            enm.topicOccurrenceCounts
        );
    }

    return diffs;
}

function getTopicOccurrenceCountsDifference( tct, enm ) {
    var diff = [],
        // Don't bother with topics that are only in TCT or ENM and not both.
        // Other tests will catch those errors.
        topicsToCompare = _.intersection( Object.keys( enm ), Object.keys( tct ) ),
        tctCount, enmCount;

    topicsToCompare.forEach( topic => {
        tctCount = tct[ topic ];
        enmCount = enm[ topic ];

        if ( tctCount !== enmCount ) {
            diff.push( `${ topic }: TCT count = ${ tctCount }; ENM count = ${ enmCount }` );
        }
    } );

    return diff;
}

function writeDiffReports( topicId, diffs ) {
    if ( diffs.relatedTopicsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-topics.json`,
                          util.stableStringify( diffs.relatedTopicsInTctNotInEnm ) );
    }

    if ( diffs.relatedTopicsInEnmNotTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-topics.json`,
                          util.stableStringify( diffs.relatedTopicsInEnmNotTct ) );
    }

    if ( diffs.epubsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-epubs.json`,
                          util.stableStringify( diffs.epubsInTctNotInEnm ) );
    }

    if ( diffs.epubsInEnmNotInTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-epubs.json`,
                          util.stableStringify( diffs.epubsInEnmNotInTct ) );
    }

    if ( diffs.authorPublisherInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-missing-authorPublishers.json`,
                          util.stableStringify( diffs.authorPublisherInTctNotInEnm ) );
    }

    if ( diffs.authorPublisherInEnmNotInTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-enm-extra-authorPublishers.json`,
                          util.stableStringify( diffs.authorPublisherInEnmNotInTct ) );
    }

    if ( countRelatedTopicsOccurrences && diffs.topicOccurrenceCounts.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ topicId }-occurrence-counts-discrepancies.json`,
                          util.stableStringify( diffs.topicOccurrenceCounts ) );
    }
}

function getTctOccurrenceCounts( topicId ) {
    var responseBody = getTctResponseBody( topicId ),
        json;

    try {
        json = JSON.parse( responseBody );
    } catch( e ) {
        console.error( `ERROR getTctOccurrenceCounts( ${ topicId } ): ${ e }` );

        process.exit();
    }

    if ( json.basket.occurs ) {
        return json.basket.occurs.length;
    } else {
        return 0;
    }
}

module.exports.init = init;
