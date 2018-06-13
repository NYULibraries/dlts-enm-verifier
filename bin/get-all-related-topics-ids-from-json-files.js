const fs   = require( 'fs' );
const path = require( 'path' );

var jsonDir = path.resolve( process.argv[ 2 ] ),
    dirs = fs.readdirSync( jsonDir ),
    topicIds = {};

dirs.forEach( ( file ) => {
        var relations, relation;

        if ( file.match( /[\d]+\.json/ ) ) {
            relations = require( jsonDir + '/' + file ).relations;
            
            relations.forEach( ( relation ) => {
                    topicIds[ relation.basket.id ] = 1;
                } );
        }
    }
    );

Object.keys( topicIds ).sort().forEach( ( id ) => {
        console.log( id );
    } );

