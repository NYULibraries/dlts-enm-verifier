const fs        = require( 'fs' );
const _         = require( 'lodash' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const commandName = 'solr';

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

    tct.json = JSON.parse( tct.responseBody );

    return tct;
}

function getEnmData( locationId ) {
    var responseBody = getEnmResponseBody( locationId ),
        enm = JSON.parse( responseBody ).response.docs[ 0 ];

    enm.responseBody = responseBody;

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

function generateDiffs( tct, enm ) {
    var diffs = {};

    return diffs;
}

function writeDiffReports( locationId, diffs ) {

}

module.exports.init = init;
