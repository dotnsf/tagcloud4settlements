//.  import.js
//. https://qiita.com/PonDad/items/81b85d76b1a89ee2598b
var cloudantlib = require( '@cloudant/cloudant' ),
    client = require( 'cheerio-httpcli' ),
    fs = require( 'fs' ),
    MeCab = require( 'mecab-async' ),
    pdf = require( 'pdf-parse' ),
    settings = require( './settings' );

var db_username = settings.db_username;
var db_password = settings.db_password;
var db_name = settings.db_name;
var db = null;
var cloudant = null;
if( db_username && db_password && db_name ){
  cloudant = cloudantlib( { account: db_username, password: db_password } );
  if( cloudant ){
    cloudant.db.get( db_name, function( err, body ){
      if( err ){
        if( err.statusCode == 404 ){
          cloudant.db.create( db_name, function( err, body ){
            if( err ){
              db = null;
            }else{
              db = cloudant.db.use( db_name );
              createDesignDocument();
            }
          });
        }else{
          db = cloudant.db.use( db_name );
        }
      }else{
        db = cloudant.db.use( db_name );
      }
    });
  }
}

var mecab = new MeCab();
mecab.command = settings.mecab_command;
mecab.options = {
  //timeout: 1000,
  maxBuffer: 1024 * 1024  //. to avoid `stdout maxBuffer exceeded` error
};

var target_folder = './pdfs';
fs.readdir( target_folder, function( err, files ){
  if( err ) throw err;

  var fileList = [];
  files.filter( function( file ){
    return fs.statSync( target_folder + '/' + file ).isFile() && /.*\.pdf$/.test( target_folder + '/' + file );
  }).forEach( function( file ){
    fileList.push( target_folder + '/' + file );
  });

  //. fileList 内のファイルを１つずつ処理していく
  processFile( fileList, 0 );
});



function processFile( fileList, idx ){
  if( idx < fileList.length ){
    var filepath = fileList[idx];                // abc/dec/xxx.2019.1.pdf

    var tmp1 = filepath.split( '/' );            // [ 'abc', 'dec', 'xxx.2019.1.pdf' ]
    var tmp2 = tmp1[tmp1.length-1].split( '.' ); // [ 'xxx', '2019', '1', 'pdf' ];
    var name = tmp2[0];
    var yyyy = tmp2[1];
    var nn = tmp2[2];

    var buf = fs.readFileSync( filepath );
    pdf( buf ).then( function( data ){
      var text = data.text.split( "\n" ).join( ' ' );

      text2morphs( text ).then( function( results ){
        var id = tmp1[tmp1.length-1]; //. ファイル名を id とする
        var data = { _id: id, filename: id, name: name, yyyy: yyyy, nn: nn, results: results, datetime: ( new Date() ).getTime() };
        if( db ){
          db.insert( data, function( err, body ){
            setTimeout( function(){
              processFile( fileList, idx + 1 );
            }, 1000 );
          });
        }else{
          console.log( data );
          setTimeout( function(){
            processFile( fileList, idx + 1 );
          }, 1000 );
        }
      }, function( err ){
        console.log( err );
        setTimeout( function(){
          processFile( fileList, idx + 1 );
        }, 1000 );
      });
    }, function( err ){
      console.log( err );
    });
  }else{
    return idx;
  }
}


function text2morphs( text ){
  return new Promise( function( resolve, reject ){
    mecab.parseFormat( text, function( err, morphs ){
      if( err ){
        reject( err );
      }else{
        var results = [];
        var list = [];
        morphs.forEach( function( morph ){
          //. morph = { kanji: "おはよう", lexical: "感動詞", compound: "*", compound2: "*", compound3: "*", conjugation: "*", inflection: "*", original: "おはよう", "reading": "オハヨウ", pronounciation: "オハヨー" }
          if( [ '名詞', '代名詞', '動詞', '形容詞' ].indexOf( morph.lexical ) > -1 ){
            var word = morph.original;
            var idx = list.indexOf( word );
            if( idx == -1 ){
              var result = {
                text: word,
                weight: 1
              };
              list.push( word );
              results.push( result );
            }else{
              results[idx].weight ++;
            }
          }
        });

        //resolve( morphs );
        results.sort( compare );
        resolve( results );
      }
    });
  });
}

function createDesignDocument(){
  var search_index_function = 'function (doc) { index( "default", doc._id ); }';
  if( settings.search_fields ){
    search_index_function = 'function (doc) { index( "default", ' + settings.search_fields + '.join( " " ) ); }';
  }

  //. デザインドキュメント作成
  var design_doc_doc = {
    _id: "_design/library",
    language: "javascript",
    views: {
      bydatetime: {
        map: "function (doc) { if( doc.datetime ){ emit(doc.datetime, doc); } }"
      },
      byfilename: {
        map: "function (doc) { if( doc.filename ){ emit(doc.filename, doc); } }"
      }
    },
    indexes: {
      newSearch: {
        "analyzer": 'japanese',
        "index": search_index_function
      }
    }
  };
  db.insert( design_doc_doc, function( err, body ){
    if( err ){
      console.log( "db init(1): err" );
      console.log( err );
    }else{
      console.log( "db init(1): " );
      console.log( body );

      //. クエリーインデックス作成
      //. https://31248dda-97cb-42ee-ab61-47600673a258-bluemix.cloudant.com/t4s/_design/names-index/_view/names-view?group=true
      var query_index_username = {
        _id: "_design/names-index",
        language: "query",
        views: {
          "names-view": {
            map: {
              fields: { "name": "asc" },
              partial_filter_selector: {}
            },
            reduce: "_count",
            options: {
              def: {
                fields: [ "name" ]
              }
            }
          }
        }
      };
      db.insert( query_index_username, function( err, body ){
        if( err ){
          console.log( "db init(2): err" );
          console.log( err );
        }else{
          console.log( "db init(2): " );
          console.log( body );
        }
      });
    }
  });
}

function compare( a, b ){
  if( a.weight < b.weight ){
    return 1;
  }else if( a.weight > b.weight ){
    return -1;
  }else{
    return 0;
  }
}
