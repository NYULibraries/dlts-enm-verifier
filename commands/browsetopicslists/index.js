const fs        = require( 'fs' );
const jsdom     = require( 'jsdom' );
const { JSDOM } = jsdom;
const _         = require( 'lodash' );
const path      = require( 'path' );
const request   = require( 'sync-request' );

const util      = require( '../../lib/util' );

const COMMAND_NAME = 'browsetopicslists';

const browseTopicsListCategories = [
    '0-9',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'non-alphanumeric',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
];

var program,
    directories,
    topicsAllResponse,
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
        .command( `${ COMMAND_NAME }` )
        .action( verify );
}

function verify() {
    if ( ! program.enmHost ) {
        program.enmHost = util.getDefaultEnmHost( COMMAND_NAME );
    }

    topicsAllResponse = JSON.parse( getTopicsAllResponseBody() );

    browseTopicsListCategories.forEach( browseTopicsListCategory => {
        compareTctAndEnm( browseTopicsListCategory );
    } );
}

function compareTctAndEnm( browseTopicsListCategory ) {
    var tct = getTctData( browseTopicsListCategory ),
        enm = getEnmData( browseTopicsListCategory ),

        diffs = generateDiffs( tct, enm );

    writeDiffReports( browseTopicsListCategory, diffs );
}

function getTctData( browseTopicsListCategory ) {
    var tct = {};

    tct.topics = getTctTopicsForBrowseTopicsListCategory( browseTopicsListCategory );

    return tct;
}

function getEnmData( browseTopicsListCategory ) {
    var enm = {};

    enm.responseBody = getEnmResponseBody( browseTopicsListCategory );

    enm.dom = new JSDOM( enm.responseBody );

    enm.topics = getEnmTopicsFromBrowseTopicsList( enm.dom );
    
    return enm;
}

function getTopicsAllResponseBody() {
    var responseBody;

    if ( program.tctLocal ) {
        responseBody = fs.readFileSync( `${ program.tctLocal }/TopicsAll.json`, 'utf8' );
    } else {
        responseBody = request( 'GET', `https://${ program.tctHost }/api/hit/basket/all/?format=json` ).getBody( 'utf8' );

        // Cache response
        fs.writeFileSync( `${ tctCache }/TopicsAll.json`, responseBody );
    }

    return responseBody;
}

function getEnmResponseBody( browseTopicsListCategory ) {
    var responseBody;

    if ( program.enmLocal ) {
        responseBody = fs.readFileSync( `${ program.enmLocal }/${ browseTopicsListCategory }.html`, 'utf8' );
    } else {
        responseBody = request( 'GET', getEnmBrowseTopicsListUrl( browseTopicsListCategory ) ).getBody( 'utf8' );

        fs.writeFileSync( `${ enmCache }/${ browseTopicsListCategory }.html`, responseBody );
    }

    return responseBody;
}

function getEnmBrowseTopicsListUrl( browseTopicsListCategory ) {
    return `http://${ program.enmHost }/enm/enm-web/prototypes/browse-topics-lists/${ browseTopicsListCategory }.html`;
}

function getTctTopicsForBrowseTopicsListCategory( category ) {
    var regexp,
        topics;

    if ( category === 'non-alphanumeric' ) {
        regexp = new RegExp( `^[^a-z0-9]` );
    } else {
        regexp = new RegExp( `^[${ category }]` );
    }

    topics = topicsAllResponse.filter( topic => {
        return topic.display_name.replace( /^"+/, '' ).toLocaleLowerCase().match( regexp )
    } )
        .map( topic => {
            return getTopicString( topic.display_name.trim(), topic.id );
        } )
        .sort( util.caseInsensitiveSort );

    return topics;
}

function getEnmTopicsFromBrowseTopicsList( dom ) {
    var topics = [],
        topicAnchors = dom.window.document.querySelectorAll( '.enm-topiclist a' );

    topicAnchors.forEach( topicAnchor => {
        topics.push( getTopicStringFromAnchor( topicAnchor ) );
    } );

    return topics;
}

function getTopicStringFromAnchor( topicLink ) {
    var topicId = parseInt( path.basename( topicLink.getAttribute( 'href' ), '.html' ), 10 ),
        topicName = topicLink.textContent.trim();

    return getTopicString( topicName, topicId );
}

function getTopicString( topicName, topicId ) {
    return `${ topicName } | Topic ID: ${ topicId }`;
}

function generateDiffs( tct, enm ) {
    var diffs = {};

    diffs.topicsInTctNotInEnm = _.difference( tct.topics, enm.topics );
    diffs.topicsInEnmNotTct = _.difference( enm.topics, tct.topics) ;

    return diffs;
}

function writeDiffReports( browseTopicsListCategory, diffs ) {
    if ( diffs.topicsInTctNotInEnm.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ browseTopicsListCategory }-enm-missing-topics.json`,
                          util.stableStringify( diffs.topicsInTctNotInEnm ) );
    }

    if ( diffs.topicsInEnmNotTct.length > 0 ) {
        fs.writeFileSync( `${ reportsDir }/${ browseTopicsListCategory }-enm-extra-topics.json`,
                          util.stableStringify( diffs.topicsInEnmNotTct ) );
    }
}

module.exports.init = init;
