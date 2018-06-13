const rimraf    = require( 'rimraf' );
const stringify = require( 'json-stable-stringify' );

const stringifySpace = '    ';

function caseInsensitiveSort( a, b ) {
    return a.toLowerCase().localeCompare( b.toLowerCase() );
}

function clearDirectory( directory ) {
    try {
        rimraf.sync( directory + '/*' );
    } catch ( error ) {
        console.error( `ERROR clearing ${ directory }: ${error}` );

        process.exit( 1 );
    }
}

function stableStringify( json ) {
    return stringify( json, { space: '    ' } );
}

module.exports = {
    caseInsensitiveSort,
    clearDirectory,
    stableStringify,
};
