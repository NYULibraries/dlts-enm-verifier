const rimraf    = require( 'rimraf' );
const stringify = require( 'json-stable-stringify' );

const stringifySpace = '    ';

function caseInsensitiveSort( a, b ) {
    return a.toLowerCase().localeCompare( b.toLowerCase() );
}

function ignoreWrappingDoubleQuotesCaseInsenstiveSort( a, b ) {
    return getNormalizedTopicNameForSorting( a ).localeCompare(
        getNormalizedTopicNameForSorting( b )
    );
}

function getNormalizedTopicNameForSorting( topicName ) {
    if ( topicName.startsWith( '"' ) ) {
        return topicName.slice( 1 ).toLowerCase();
    } else {
        return topicName.toLowerCase();
    }
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
    ignoreWrappingDoubleQuotesCaseInsenstiveSort,
    stableStringify,
};
