//.  app.js
//. https://qiita.com/PonDad/items/81b85d76b1a89ee2598b
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    fs = require( 'fs' ),
    settings = require( './settings' ),
    app = express();

app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.use( bodyParser.urlencoded( { limit: '10mb', extended: true } ) );
app.use( bodyParser.json() );

var db = null;
var cloudant = null;
if( settings.db_username && settings.db_password && settings.db_name ){
  cloudant = cloudantlib( { account: settings.db_username, password: settings.db_password } );
  if( cloudant ){
    cloudant.db.get( settings.db_name, function( err, body ){
      if( err ){
        if( err.statusCode == 404 ){
          cloudant.db.create( settings.db_name, function( err, body ){
            if( err ){
              db = null;
            }else{
              db = cloudant.db.use( settings.db_name );
            }
          });
        }else{
          db = cloudant.db.use( settings.db_name );
        }
      }else{
        db = cloudant.db.use( settings.db_name );
      }
    });
  }
}

app.get( '/names', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    //. https://xxxxx.cloudant.com/db_name/_design/names-index/_view/names-index?group=true
    db.view( 'names-index', 'names-view', { group: true }, function( err, result ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: err } ) );
        res.end();
      }else{
        var names = {};
        if( result.rows ){
          result.rows.forEach( function( row ){
            names[row.key] = row.value;
          });
        }
        res.write( JSON.stringify( { status: true, names: names } ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db not initialized.' } ) );
    res.end();
  }
});

app.get( '/wordsweightbyname', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var name = req.query.name;
  if( db ){
    var q = {
      selector: {
        name: { "$eq": name }
      }
    };
    db.find( q ).then( function( body ){
      var docs = [];
      var words = [];
      body.docs.forEach( function( doc ){
        //. doc = { _id: '_id', filename: 'filename', name: 'name', yyyy: yyyy, nn: nn, datetime: datetime, results: [ { text: 'text', weight: m }, .. ] }
        //console.log( doc );
        docs.push( doc );

        doc.results.forEach( function( result ){
          var b = false;
          words.forEach( function( word ){
            if( word.text == result.text ){
              b = true;
              word.weight += result.weight;
            }
          });
          if( !b ){
            words.push( result );
          }
        });
      });

      words.sort( compare );
      res.write( JSON.stringify( { status: true, docs: docs, words: words } ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db not initialized.' } ) );
    res.end();
  }
});

app.get( '/weightsbynameword', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var name = req.query.name;
  var word = req.query.word;
  if( db ){
    var q = {
      selector: {
        name: { "$eq": name }
      }
    };
    db.find( q ).then( function( body ){
      var weights = [];
      body.docs.forEach( function( doc ){
        //. doc = { _id: '_id', filename: 'filename', name: 'name', yyyy: yyyy, nn: nn, datetime: datetime, results: [ { text: 'text', weight: m }, .. ] }
        //console.log( doc );
        var weight = 0;
        doc.results.forEach( function( result ){
          if( result.text == word ){
            weight = result.weight;
          }
        });

        var data = { name: name, yyyy: doc.yyyy, nn: doc.nn, weight: weight };
        weights.push( data );
      });

      weights.sort( compare2 );
      res.write( JSON.stringify( { status: true, weights: weights } ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db not initialized.' } ) );
    res.end();
  }
});

app.post( '/reset', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    db.list( {}, function( err, result ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        var docs = [];
        result.rows.forEach( function( doc ){
          if( !doc.id.startsWith( '_' ) ){
            docs.push( { _id: doc.id, _rev: doc.value.rev, _deleted: true } );
          }
        });
        db.bulk( { docs: docs }, function( err ){
          if( err ){
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
            res.end();
          }else{
            res.write( JSON.stringify( { status: true }, 2, null ) );
            res.end();
          }
        });
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db not initialized.' } ) );
    res.end();
  }
});

app.get( '/dburl', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    var url = 'https://' + settings.db_username + ':' + settings.db_password + '@' + settings.db_username + '.cloudant.com/dashboard.html';
    res.write( JSON.stringify( { status: true, url: url } ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db not initialized.' } ) );
    res.end();
  }
});


function compare( a, b ){
  if( a.weight < b.weight ){
    return 1;
  }else if( a.weight > b.weight ){
    return -1;
  }else{
    return 0;
  }
}

function compare2( a, b ){
  if( a.yyyy + '_' + a.nn < b.yyyy + '_' + b.nn ){
    return -1;
  }else if( a.yyyy + '_' + a.nn > b.yyyy + '_' + b.nn ){
    return 1;
  }else{
    return 0;
  }
}

var port = process.env.PORT || 8080;
app.listen( port );
console.log( "server starting on " + port + " ..." );
