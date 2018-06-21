const fs        = require( 'fs' );
const _         = require( 'lodash' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const COMMAND_NAME = 'solr';

const FIELD_TYPE_SINGLE   = '0';
const FIELD_TYPE_MULTIPLE = '1';

const fieldsToVerify = [
    'authors',
    'epubNumberOfPages',
    'id',
    'isbn',
    'pageLocalId',
    'pageNumberForDisplay',
    'pageSequenceNumber',
    'pageText',
    'publisher',
    'title',
    'topicNames',
    'topicNamesForDisplayData',
];

let program,
    directories,
    namesAll = {},
    topicNamesForId = {},
    topicDisplayNamesToTopicIdMap = {},
    enmCache, tctCache,
    reportsDir;

function init( programArg, directoriesArg ) {
    program     = programArg;
    directories = directoriesArg;

    enmCache   = `${ directories.cache.enm }/${ COMMAND_NAME }`;
    tctCache   = `${ directories.cache.tct }/${ COMMAND_NAME }`;
    reportsDir = `${ directories.reports }/${ COMMAND_NAME }`;

    program
        .command( `${ COMMAND_NAME } [locationIds...]` )
        .action( verify );
}

function verify( locationIds ) {
    util.clearDirectory( enmCache );
    util.clearDirectory( tctCache );
    util.clearDirectory( reportsDir );

    if ( ! program.enmHost ) {
        program.enmHost = util.getDefaultEnmHost( COMMAND_NAME );
    }

    namesAll = JSON.parse( getNamesAllResponseBody() );
    namesAll.forEach( name => {
        const topicId = name.basket;

        if ( ! topicNamesForId[ topicId ] ) {
            topicNamesForId[ topicId ] = [];
        }

        topicNamesForId[ topicId ].push( name.name );
    } );

    locationIds.forEach( locationId => {
        compareTctAndEnm( locationId );
    } );
}

function compareTctAndEnm( locationId ) {
    const tct = getTctData( locationId ),
          enm = getEnmData( locationId ),

          diffs = generateDiffs( tct, enm );

    writeDiffReports( locationId, diffs );
}

function getSequenceNumberForLocationId( epubDetail, locationId ) {
    const location = epubDetail.locations.find( location => {
        return location.id === locationId;
    } );

    return location.sequence_number;
}

function getEnmData( locationId ) {
    const responseBody = getEnmResponseBody( locationId ),
          enm = JSON.parse( responseBody ).response.docs[ 0 ];

    enm.responseBody = responseBody;

    // At the moment, all authors are jammed into first array element, separated
    // by semi-colons.  This is how they came in through TCT EpubDetail.
    enm.authors = enm.authors[ 0 ];
    // Solr schema currently has publisher as multi-valued.  TCT uses single string
    // for publisher...not sure if it's the case that there can be multiple publishers,
    // in which case Solr field should be set to single-valued.  For now, need
    // to extract the publisher from the first element.
    enm.publisher = enm.publisher[ 0 ];
    // See "Notes on sorting of topic names" in README.md
    if ( enm.topicNames ) {
        util.sortTopicNames( enm.topicNames );

        enm.topicNamesForDisplayData = JSON.parse( enm.topicNamesForDisplay );
        sortNestedArraysInTopicNamesDisplayData( enm.topicNamesForDisplayData );
        enm.topicNamesForDisplayData.sort( util.firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort );
    } else {
        enm.topicNames = [];
    }

    return enm;
}

function getTctData( locationId ) {
    let tct = {};

    tct.responseBody = getTctResponseBody( locationId );

    tct.json = JSON.parse( tct.responseBody )[ 0 ];

    tct.authors = tct.json.document.author;
    tct.epubDetail = getEpubDetail( tct.json.document.id );
    tct.epubNumberOfPages = tct.epubDetail.locations.length;
    tct.id = tct.json.id;
    tct.isbn = tct.json.document.isbn;
    tct.pageLocalId = tct.json.localid;
    tct.pageNumberForDisplay = tct.pageLocalId.replace( /^page_/, '' );
    tct.pageSequenceNumber = getSequenceNumberForLocationId( tct.epubDetail, tct.id );
    tct.pageText = tct.json.content.text;
    tct.publisher = tct.json.document.publisher;
    tct.title = tct.json.document.title;
    tct.topicNames = [];
    tct.topicNamesForDisplayData = [];

    tct.json.occurrences.forEach( occurrence => {
        let topicId = occurrence.basket.id,
            topicDisplayName = occurrence.basket.display_name,
            topicNamesAll = topicNamesForId[ topicId ];

        // Add to topicNames field
        tct.topicNames = tct.topicNames.concat( topicNamesAll );

        // Add to data that will be marshalled into JSON for topicNamesForDisplay field
        tct.topicNamesForDisplayData.push(
            [ topicDisplayName ].concat(
                topicNamesAll.filter( topicName => {
                    return topicName !== topicDisplayName;
                } )
            )
        );

        // Add to map used later for looking up topic id for a display name
        topicDisplayNamesToTopicIdMap[ topicDisplayName ] = topicId;
    } );

    util.sortTopicNames( tct.topicNames );

    sortNestedArraysInTopicNamesDisplayData( tct.topicNamesForDisplayData );
    tct.topicNamesForDisplayData.sort( firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort );

    return tct;
}

function getEpubDetail( epubId ) {
    let epubDetailResponseBody = getEpubDetailResponseBody( epubId ),
        epubDetail = JSON.parse( epubDetailResponseBody );

    return epubDetail;
}

function getEnmResponseBody( locationId ) {
    let responseBody;

    if ( program.enmLocal ) {
        responseBody = fs.readFileSync( `${ program.enmLocal }/${ locationId }.json`, 'utf8' );
    } else {
        responseBody = request(
            'GET',
            `http://${ program.enmHost }/solr/enm-pages/select?indent=on&q=id:${ locationId }&wt=json`
        ).getBody( 'utf8' );

        fs.writeFileSync( `${ enmCache }/${ locationId }.json`, responseBody );
    }

    return responseBody;
}

function getEpubDetailResponseBody( epubId ) {
    let responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal}/EpubDetail-${ epubId }.json`, 'utf8' );
    } else {
        responseBody = request(
            'GET',
            `https://${ program.tctHost }/api/epub/document/${ epubId }/`
        ).getBody( 'utf8' );

        fs.writeFileSync( `${ tctCache }/EpubDetail-${ epubId }.json`, responseBody );
    }

    return responseBody;
}

function getNamesAllResponseBody() {
    let responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/NamesAll.json`, 'utf8' );
    } else {
        responseBody = request( 'GET', `https://${ program.tctHost }/api/hit/hits/all/?format=json` ).getBody( 'utf8' );

        // Cache response
        fs.writeFileSync( `${ tctCache }/NamesAll.json`, responseBody );
    }

    return responseBody;
}

function getTctResponseBody( locationId ) {
    let responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/${ locationId }.json`, 'utf8' );
    } else {
        responseBody = request(
            'GET',
            `https://${ program.tctHost }/api/epub/location/${ locationId }/?format=json`
        ).getBody( 'utf8' );

        // Cache TCT response body
        fs.writeFileSync( `${ tctCache }/${ locationId }.json`, responseBody );
    }

    return responseBody;
}

function generateDiffs( tct, enm ) {
    const diffs = {};

    fieldsToVerify.sort().forEach( field => {
        let fieldType = typeof tct[ field ];

        if ( [ 'string', 'number' ].includes( fieldType ) ) {
            if ( enm[ field ] !== tct[ field ] ) {
                diffs[ field ]      = {};
                diffs[ field ].type = FIELD_TYPE_SINGLE;
                diffs[ field ].tct  = tct[ field ];
                diffs[ field ].enm  = enm[ field ];
            }
        } else if ( Array.isArray( tct[ field ] ) ) {
            diffs[ field ]      = {};
            diffs[ field ].type = FIELD_TYPE_MULTIPLE;
            diffs[ field ].tct  = _.differenceWith( tct[ field ], enm[ field ], _.isEqual );
            diffs[ field ].enm  = _.differenceWith( enm[ field ], tct[ field ], _.isEqual );
        } else {
            console.error( `TCT \`${ field }\` field value ${ tct[ field ] } is` +
                           ` of unexpected type "${ fieldType }".`);

            process.exit( 1 );
        }
    } );

    return diffs;
}

function writeDiffReports( locationId, diffs ) {
    fieldsToVerify.forEach( field => {
        let diffForField  = diffs[ field ];

        if ( diffForField ) {
            if ( diffForField.type === FIELD_TYPE_SINGLE ) {
                fs.writeFileSync( `${ reportsDir }/${ locationId }-unequal-${ field }-values.json`,
                    'ENM: ' + getDiffValueForDisplay( diffForField.enm ) +
                    '\n' +
                    'TCT: ' + getDiffValueForDisplay( diffForField.tct ) );
            } else if ( diffForField.type === FIELD_TYPE_MULTIPLE ) {
                if ( diffs[ field ].tct.length > 0 ) {
                    fs.writeFileSync( `${ reportsDir }/${ locationId }-enm-missing-${ field }.json`,
                                      util.stableStringify( diffs[ field ].tct ) );
                }

                if ( diffs[ field ].enm.length > 0 ) {
                    fs.writeFileSync( `${ reportsDir }/${ locationId }-tct-missing-${ field }.json`,
                                      util.stableStringify( diffs[ field ].enm ) );
                }
            } else {
                // Should never get here
            }
        }
    } );
}

function getDiffValueForDisplay( value ) {
    if ( typeof value === 'string' ) {
        return `"${ value }"`;
    } else if ( typeof value === 'number' ) {
        return value;
    } else {
        // undefined, or possibly something else unanticipated
        return value;
    }
}

function firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort( a, b ) {
    return util.ignoreWrappingDoubleQuotesCaseInsensitiveSort( a[ 0 ], b[ 0 ] );
}

function sortNestedArraysInTopicNamesDisplayData( topicNamesDisplayData ) {
    topicNamesDisplayData.forEach( topicNamesArray => {
        let displayName = topicNamesArray.shift();

        util.sortTopicNames( topicNamesArray );
        topicNamesArray.unshift( displayName );
    } );
}

module.exports.init = init;
