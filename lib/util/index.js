const stringify = require( 'json-stable-stringify' );

const stringifySpace = '    ';

function caseInsensitiveSort( a, b ) {
    return a.toLowerCase().localeCompare( b.toLowerCase() );
}

function stableStringify( json ) {
    return stringify( json, { space: '    ' } );
}

module.exports = {
    caseInsensitiveSort,
    stableStringify,
};
