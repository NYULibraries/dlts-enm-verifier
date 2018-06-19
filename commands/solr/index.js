const fs        = require( 'fs' );
const _         = require( 'lodash' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const COMMAND_NAME = 'solr';

const fieldsToVerify = {
    'authors'                  : { multiValued: false },
    'epubNumberOfPages'        : { multiValued: false },
    'id'                       : { multiValued: false },
    'isbn'                     : { multiValued: false },
    'pageLocalId'              : { multiValued: false },
    'pageNumberForDisplay'     : { multiValued: false },
    'pageSequenceNumber'       : { multiValued: false },
    'pageText'                 : { multiValued: false },
    'publisher'                : { multiValued: false },
    'title'                    : { multiValued: false },
    'topicNames'               : { multiValued: true  },
    'topicNamesForDisplayData' : { multiValued: true  },
};

var program,
    directories,
    locationIds,
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

    util.clearDirectory( enmCache );
    util.clearDirectory( tctCache );
    util.clearDirectory( reportsDir );

    program
        .command( `${ COMMAND_NAME } [locationIds...]` )
        .action( verify );
}

function verify( locationIds ) {
    if ( ! program.enmHost ) {
        program.enmHost = util.getDefaultEnmHost( COMMAND_NAME );
    }

    namesAll = JSON.parse( getNamesAllResponseBody() );
    namesAll.forEach( name => {
        var topicId = name.basket;

        if ( ! topicNamesForId[ topicId ] ) {
            topicNamesForId[ topicId ] = [];
        }

        topicNamesForId[ topicId ].push( name.name );
    } );

    locationIds.forEach( locationId => {
        compareTctAndEnm( locationId );
    } );
}

function getNamesAllResponseBody() {
    var responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/NamesAll.json`, 'utf8' );
    } else {
        responseBody = request( 'GET', `https://${ program.tctHost }/api/hit/hits/all/?format=json` ).getBody( 'utf8' );

        // Cache response
        fs.writeFileSync( `${ tctCache }/NamesAll.json`, responseBody );
    }

    return responseBody;
}

function compareTctAndEnm( locationId ) {
    var tct = getTctData( locationId ),
        enm = getEnmData( locationId ),

        diffs = generateDiffs( tct, enm );

    writeDiffReports( locationId, diffs );
}

function getTctData( locationId ) {
    var tct = {};

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
        var topicId = occurrence.basket.id,
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

    tct.topicNames.sort( util.ignoreWrappingDoubleQuotesCaseInsenstiveSort );

    sortNestedArraysInTopicNamesDisplayData( tct.topicNamesForDisplayData );
    tct.topicNamesForDisplayData.sort( util.firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort );

    return tct;
}

function getEpubDetail( epubId ) {
    var epubDetailResponseBody = getEpubDetailResponseBody( epubId ),
        epubDetail = JSON.parse( epubDetailResponseBody );

    return epubDetail;
}

function getSequenceNumberForLocationId( epubDetail, locationId ) {
    var location = epubDetail.locations.find( location => {
        return location.id === locationId;
    } );

    return location.sequence_number;
}

function getEnmData( locationId ) {
    var responseBody = getEnmResponseBody( locationId ),
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
    // Should already be sorted, but just sort them to match tct.topicNames order
    // just in case so that _.difference will report accurately on whether they
    // contain the same elements.
    // We not verifying the correctness of ENM ordering because our custom
    // sort as specified in NYUP-376 is something that is implemented outside of
    // TCT.  util.ignoreWrappingDoubleQuotesCaseInsensitiveSort is an attempt to
    // match the sorting done by enm, which is done at the database level in SQL.
    // So far, though, haven't been able to iron out all the fine differences.
    // The Solr indexer tests will check for the correct ordering.
    if ( enm.topicNames ) {
        enm.topicNames.sort( util.ignoreWrappingDoubleQuotesCaseInsensitiveSort );

        // Again, because util.ignoreWrappingDoubleQuotesCaseInsensitiveSort doesn't
        // currently match the SQL-based sort used in enm, for now just verify
        // that topic mappings are correct and ignore the ordering.  The ordering
        // is not really in scope for this verification program anyway, that's the
        // job of the Solr indexer tests.
        enm.topicNamesForDisplayData = JSON.parse( enm.topicNamesForDisplay );
        sortNestedArraysInTopicNamesDisplayData( enm.topicNamesForDisplayData );
        enm.topicNamesForDisplayData.sort( util.firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort );
    } else {
        enm.topicNames = [];
    }

    return enm;
}

function getTctResponseBody( locationId ) {
    var responseBody;

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

function getEnmResponseBody( locationId ) {
    var responseBody;

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
    var responseBody;

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

function generateDiffs( tct, enm ) {
    var diffs = {};

    Object.keys( fieldsToVerify ).sort().forEach( field => {
        if ( fieldsToVerify[ field ].multiValued === false ) {
            if ( enm[ field ] !== tct[ field ] ) {
                diffs[ field ] = {};
                diffs[ field ].tct = tct[ field ];
                diffs[ field ].enm = enm[ field ];
            }
        } else {
            diffs[ field ] = {};

            if ( Array.isArray( tct[ field ] ) ) {
                diffs[ field ].tct = _.differenceWith( tct[ field ], enm[ field ], _.isEqual );
                diffs[ field ].enm = _.differenceWith( enm[ field ], tct[ field ], _.isEqual );
            } else {
                diffs[ field ].tct = _.difference( tct[ field ], enm[ field ] );
                diffs[ field ].enm = _.difference( enm[ field ], tct[ field ] );
            }
        }
    } );

    return diffs;
}

function writeDiffReports( locationId, diffs ) {
    Object.keys( fieldsToVerify ).forEach( fieldName => {
        var fieldToVerify = fieldsToVerify[ fieldName ],
            diffForField  = diffs[ fieldName ];

        if ( diffForField ) {
            if ( fieldToVerify.multiValued === false ) {
                fs.writeFileSync( `${ reportsDir }/${ locationId }-unequal-${ fieldName }-values.json`,
                    'ENM: ' + getDiffValueForDisplay( diffForField.enm, fieldToVerify.type ) +
                    '\n' +
                    'TCT: ' + getDiffValueForDisplay( diffForField.tct, fieldToVerify.type ) );
            } else {
                if ( diffs[ fieldName ].tct.length > 0 ) {
                    fs.writeFileSync( `${ reportsDir }/${ locationId }-enm-missing-${ fieldName }.json`,
                                      util.stableStringify( diffs[ fieldName ].tct ) );
                }

                if ( diffs[ fieldName ].enm.length > 0 ) {
                    fs.writeFileSync( `${ reportsDir }/${ locationId }-tct-missing-${ fieldName }.json`,
                                      util.stableStringify( diffs[ fieldName ].enm ) );
                }
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

function sortNestedArraysInTopicNamesDisplayData( topicNamesDisplayData ) {
    topicNamesDisplayData.forEach( topicNamesArray => {
        var displayName = topicNamesArray.shift();

        // Even though ultimately we want sorting to be case-insensitive to avoid
        // (for example) "Zebra" sorting before "alpha", we still need to do an
        // initial "normal" sort with case-sensitivity so that unordered sets of
        // topic names like "Programming" and "programming" will sort deterministically.
        // If we don't do this, then the output can potentially have
        // [ "Programming", "programming" ] if that's how it was originally ordered
        // in the input, and [ "programming", "Programming" ] if the input has
        // that.
        topicNamesArray.sort();
        topicNamesArray.sort( util.ignoreWrappingDoubleQuotesCaseInsensitiveSort );
        topicNamesArray.unshift( displayName );
    } );
}

module.exports.init = init;
