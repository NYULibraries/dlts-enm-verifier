const fs        = require( 'fs' );
const _         = require( 'lodash' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const commandName = 'solr';

const MULTI_VALUED = 0;
const SINGLE_VALUED = 1;

const fieldsToVerify = {
    'authors'              : SINGLE_VALUED,
    'epubNumberOfPages'    : SINGLE_VALUED,
    'id'                   : SINGLE_VALUED,
    'isbn'                 : SINGLE_VALUED,
    'pageLocalId'          : SINGLE_VALUED,
    'pageNumberForDisplay' : SINGLE_VALUED,
    'pageSequenceNumber'   : SINGLE_VALUED,
    'pageText'             : SINGLE_VALUED,
    'publisher'            : SINGLE_VALUED,
    'title'                : SINGLE_VALUED,
    'topicNames'           : MULTI_VALUED,
    'topicNamesForDisplay' : SINGLE_VALUED,
};

var program,
    directories,
    locationIds,
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
        .command( `${ commandName } [locationIds...]` )
        .action( verify );
}

function verify( locationIdsArgs ) {
    locationIds = locationIdsArgs;

    locationIds.forEach( locationId => {
        compareTctAndEnm( locationId );
    } );
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
    tct.topicNames = tct.json.occurrences.map( occurrence => {
        return occurrence.basket.display_name;
    } ).sort();

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
    // Should already be sorted, but just in case...
    enm.topicNames = enm.topicNames.sort();

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
        if ( fieldsToVerify[ field ] === SINGLE_VALUED ) {
            if ( enm[ field ] !== tct[ field ] ) {
                diffs[ field ] = {};
                diffs[ field ].tct = tct[ field ];
                diffs[ field ].enm = enm[ field ];
            }
        } else if ( fieldsToVerify[ field ] === MULTI_VALUED ) {
                diffs[ field ] = {};
                diffs[ field ].tct = _.difference( tct[ field ], enm[ field ] );
                diffs[ field ].enm = _.difference( enm[ field ], tct[ field ] );

        } else {
            console.error( 'ERROR in generateDiffs( tct, enm ): got ' +
                `fieldsToVerify[ "${ field }" ] = ${ fieldsToVerify[ field ] }; ` +
                `expected either ${ SINGLE_VALUED } or ${ MULTI_VALUED }.` );

            process.exit( 1 );
        }
    } );

    return diffs;
}

function writeDiffReports( locationId, diffs ) {

}

module.exports.init = init;
