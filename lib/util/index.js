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

function clearDirectory( directory ) {
    try {
        rimraf.sync( directory + '/*' );
    } catch ( error ) {
        console.error( `ERROR clearing ${ directory }: ${error}` );

        process.exit( 1 );
    }
}

function getDefaultEnmHost( command ) {
    return DEFAULT_ENM_HOST_FOR_COMMAND[ command ];
}

function getNormalizedTopicNameForSorting( topicName ) {
    if ( topicName.startsWith( '"' ) ) {
        return topicName.slice( 1 ).toLowerCase();
    } else {
        return topicName.toLowerCase();
    }
}

function ignoreWrappingDoubleQuotesCaseInsensitiveSort( a, b ) {
    return getNormalizedTopicNameForSorting( a ).localeCompare(
        getNormalizedTopicNameForSorting( b )
    );
}

function sortTopicNames( topicNames ) {
    // Even though ultimately we want sorting to be case-insensitive to avoid
    // (for example) "Zebra" sorting before "alpha", we still need to do an
    // initial "normal" sort with case-sensitivity so that unordered sets of
    // topic names like "Programming" and "programming" will sort deterministically.
    // If we don't do this, then the output can potentially have
    // [ "Programming", "programming" ] if that's how it was originally ordered
    // in the input, and [ "programming", "Programming" ] if the input has
    // that.
    topicNames.sort();
    topicNames.sort( ignoreWrappingDoubleQuotesCaseInsensitiveSort );
}

function stableStringify( json ) {
    return stringify( json, { space: '    ' } );
}

module.exports = {
    caseInsensitiveSort,
    clearDirectory,
    getDefaultEnmHost,
    ignoreWrappingDoubleQuotesCaseInsensitiveSort,
    sortTopicNames,
    stableStringify,
};
