const path       = require( 'path' );
const program    = require( 'commander' );

const browseTopicsLists = require( './commands/browsetopicslists' );
const solr              = require( './commands/solr' );
const topicPages        = require( './commands/topicpages' );

const util       = require( './lib/util' );

const cacheDir = __dirname + '/cache';

const directories = {
    cache : {
        enm : cacheDir + '/enm',
        tct : cacheDir + '/tct',
    },
    test     : __dirname + '/test',
    reports  : __dirname + '/reports',
};

program
    .option( '--enm-host [hostname]', 'ENM host (default varies by command: ' +
        util.getDefaultEnmHostHelpMessage() + ')' )
    // See https://jira.nyu.edu/jira/browse/NYUP-477 for details on why we are
    // using port 80 instead of 8983
    .option( '--enm-host-port [port]', 'ENM host port', 80 )
    .option( '--tct-host [hostname]', 'TCT host', 'nyuapi.infoloom.nyc' )
    .option( '--enm-local [directory]', 'Use locally stored ENM files in <directory>', resolvedPath )
    .option( '--tct-local [directory]', 'Use locally stored TCT files in <directory>', resolvedPath );

browseTopicsLists.init( program, directories );
solr.init( program, directories );
topicPages.init( program, directories );

program.parse( process.argv );

if ( ! process.argv.slice( 2 ).length ) {
    program.help();
}

function resolvedPath( possiblyRelativePath ) {
    return path.resolve( possiblyRelativePath );
}
