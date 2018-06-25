const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const process   = require( 'process' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const COMMAND_NAME = 'topicpages';

let program,
    directories,
    epubsAllTctResponse,
    epubs = {},
    enmCache, tctCache,
    reportsDir;


function init( programArg, directoriesArg ) {
    program     = programArg;
    directories = directoriesArg;

    enmCache   = `${ directories.cache.enm }/${ COMMAND_NAME }`;
    tctCache   = `${ directories.cache.tct }/${ COMMAND_NAME }`;
    reportsDir = `${ directories.reports }/${ COMMAND_NAME }`;

    program
        .command( `${ COMMAND_NAME } [topicIds...]` )
        .option(
            '--count-related-topics-occurrences',
            'Verify occurrence counts -- can be very network-intensive (default: false)')
        .action( verify );
}

function verify( topicIds ) {
    util.clearDirectory( enmCache );
    util.clearDirectory( tctCache );
    util.clearDirectory( reportsDir );

    countRelatedTopicsOccurrences = this.countRelatedTopicsOccurrences;

    if ( ! program.enmHost ) {
        program.enmHost = util.getDefaultEnmHost( COMMAND_NAME );
    }

    epubsAllTctResponse = JSON.parse( getEpubsAllResponseBody() );

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
    const tct = getTctData( topicId ),
          enm = getEnmData( topicId, tct.topicName ),

          diffs = generateDiffs( tct, enm );

    writeDiffReports( topicId, diffs );
}

function getEnmData( topicId, topicName ) {
    const enm = {};

    let visualizationData;

    enm.responseBody = getEnmResponseBody( topicId );

    enm.dom = new JSDOM( enm.responseBody );

    visualizationData = getVisualizationDataFromScript(
        enm.dom.window.document.querySelector( 'script' ).textContent
    );

    enm.topicNames = visualizationData.nodes.map( ( node ) => {
        return node.name;
    } );

    // See "Notes on sorting of topic names" in README.md
    util.sortTopicNames( enm.topicNames );

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

function getTctData( topicId ) {
    const tct = {};

    tct.responseBody = getTctResponseBody( topicId );

    tct.json = JSON.parse( tct.responseBody );

    tct.topicName = tct.json.basket.display_name;
    tct.topicOccurrenceCounts = {};
    tct.topicOccurrenceCounts[ tct.topicName ] = tct.json.basket.occurs.length;

    if ( tct.json.relations ) {
        tct.relatedTopicNames = [];

        tct.json.relations.forEach( relation => {
            const relatedTopicName = relation.basket.display_name;
            tct.relatedTopicNames.push( relatedTopicName );

            if ( countRelatedTopicsOccurrences ) {
                tct.topicOccurrenceCounts[ relatedTopicName ] =
                    getTctOccurrenceCounts( relation.basket.id );
            }
        } );

        tct.relatedTopicNames.sort( util.caseInsensitiveSort );
    }

    tct.epubs = _.sortedUniq( tct.json.basket.occurs.map( occurrence => {
        return occurrence.location.document.title;
    } ).sort( util.caseInsensitiveSort ) );

    tct.authorPublishers = tct.epubs.map( epubTitle => {
        const author    = epubs[ epubTitle ].author,
              publisher = epubs[ epubTitle ].publisher;

        return `${ author }; ${ publisher }`;
    } ).sort();

    return tct;
}

function getEnmResponseBody( topicId ) {
    let responseBody;

    if ( program.enmLocal ) {
        responseBody = fs.readFileSync( `${ program.enmLocal }/${ topicId }.html`, 'utf8' );
    } else {
        responseBody = request( 'GET', getEnmTopicPageUrl( topicId ) ).getBody( 'utf8' );

        fs.writeFileSync( `${ enmCache }/${ topicId }.html`, responseBody );
    }

    return responseBody;
}

function getEpubsAllResponseBody() {
    let responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/EpubsAll.json`, 'utf8' );
    } else {
        responseBody = request( 'GET', `https://${ program.tctHost }/api/epub/document/all/?format=json` ).getBody( 'utf8' );

        // Cache response
        fs.writeFileSync( `${ tctCache }/EpubsAll.json`, responseBody );
    }

    return responseBody;
}

function getTctResponseBody( topicId ) {
    let responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/${ topicId }.json`, 'utf8' );
    } else {
        responseBody = request( 'GET', `https://${ program.tctHost }/api/hit/basket/${ topicId }/?format=json` ).getBody( 'utf8' );

        // Cache TCT response body
        fs.writeFileSync( `${ tctCache }/${ topicId }.json`, responseBody );
    }

    return responseBody;
}

function getEnmTopicPageUrl( id ) {
    const zeroPaddedString = id.padStart( 10, "0" );

    return `http://${ program.enmHost }/enm/enm-web/prototypes/topic-pages/` +
           zeroPaddedString.substring( 0, 2 ) + "/" +
           zeroPaddedString.substring( 2, 4 ) + "/" +
           zeroPaddedString.substring( 4, 6 ) + "/" +
           zeroPaddedString.substring( 6, 8 ) + "/" +
           zeroPaddedString + '.html';
}

function getVisualizationDataFromScript( script ) {
    return  JSON.parse( script.replace( /^var visualizationData = /, '' ) );
}

function generateDiffs( tct, enm ) {
    const diffs = {};

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
    const diff = [],
          // Don't bother with topics that are only in TCT or ENM and not both.
          // Other tests will catch those errors.
          topicsToCompare = _.intersection( Object.keys( enm ), Object.keys( tct ) );

    let tctCount, enmCount;

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
    const responseBody = getTctResponseBody( topicId );

    let json;

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
