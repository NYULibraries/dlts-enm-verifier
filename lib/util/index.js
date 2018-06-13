const stringify = require( 'json-stable-stringify' );

const stringifySpace = '    ';

function caseInsensitiveSort( a, b ) {
    return a.toLowerCase().localeCompare( b.toLowerCase() );
}

function getEpubsAllResponseBody( program ) {
    if ( program.tctLocal ) {
        return require( `${ program.tctLocal }/EpubsAll.json` );
    } else {
        return require( `${ directories.test }/tct/EpubsAll.json` );
    }
}

function stableStringify( json ) {
    return stringify( json, { space: '    ' } );
}

module.exports = {
    caseInsensitiveSort,
    getEpubsAllResponseBody,
    stableStringify,
};
