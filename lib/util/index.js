const rimraf    = require( 'rimraf' );
const stringify = require( 'json-stable-stringify' );

const DEFAULT_ENM_HOST_FOR_COMMAND = {
    'browsetopicslists' : 'dlib.nyu.edu',
    'solr'              : 'discovery1.dlib.nyu.edu:8983',
    'topicpages'        : 'dlib.nyu.edu',
};

function caseInsensitiveSort( a, b ) {
    return a.toLowerCase().localeCompare( b.toLowerCase() );
}

function getDefaultEnmHost( command ) {
    return DEFAULT_ENM_HOST_FOR_COMMAND[ command ];
}

function firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort( a, b ) {
    return ignoreWrappingDoubleQuotesCaseInsensitiveSort( a[ 0 ], b[ 0 ] );
}

function ignoreWrappingDoubleQuotesCaseInsensitiveSort( a, b ) {
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
    firstElementIgnoreWrappingDoubleQuotesCaseInsensitiveSort,
    getDefaultEnmHost,
    ignoreWrappingDoubleQuotesCaseInsensitiveSort,
    stableStringify,
};
