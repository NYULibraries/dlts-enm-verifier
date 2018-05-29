const fs = require( 'fs' );

var jsonDir = __dirname + '/test/tct',
    dirs = fs.readdirSync( jsonDir ),
    topicIds = {};

dirs.forEach( ( file ) => {
        var relations, relation;

        if ( file.match( /[\d]+\.json/ ) ) {
            relations = require( jsonDir + '/' + file ).relations;
            
            relations.forEach( ( relation ) => {
                    topicIds[ relation.id ] = 1;
                } );
        }
    }
    );

Object.keys( topicIds ).sort().forEach( ( id ) => {
        console.log( id );
    } );

