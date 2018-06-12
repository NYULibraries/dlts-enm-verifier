const program = require( 'commander' );

const topicPages = require( './commands/topicpages' );

topicPages.init( program );

program.parse( process.argv );
