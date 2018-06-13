const stringify = require( 'json-stable-stringify' );

const stringifySpace = '    ';

function stableStringify( json ) {
    return stringify( json, { space: '    ' } );
}

module.exports = {
    stableStringify
};
