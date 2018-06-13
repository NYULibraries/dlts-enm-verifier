const program = require( 'commander' );

const topicPages = require( './commands/topicpages' );

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
    .option( '--cache', 'Cache responses from ENM and TCT' )
    .option( '--enm-host [hostname]', 'ENM host', 'dlib.nyu.edu' )
    .option( '--tct-host [hostname]', 'TCT host', 'nyuapi.infoloom.nyc' )
    .option( '--use-enm-local [directory]', 'Use locally stored ENM files in <directory>' )
    .option( '--use-tct-local [directory]', 'Use locally stored TCT files in <directory>' );

topicPages.init( program, directories );

program.parse( process.argv );
