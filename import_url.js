//.  import.js
//. https://qiita.com/PonDad/items/81b85d76b1a89ee2598b
var cloudantlib = require( '@cloudant/cloudant' ),
    client = require( 'cheerio-httpcli' ),
    fs = require( 'fs' ),
    MeCab = require( 'mecab-async' ),
    pdf = require( 'pdf-parse' ),
    request = require( 'request' ),
    settings = require( './settings' );

var target_file = './pdfs.csv';

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

var text = fs.readFileSync( target_file, 'utf-8' );
var lines = text.split( '\n' );

//. fileList 内のファイルを１つずつ処理していく
if( lines.length > 0 ){
  setTimeout( function(){
    processLine( lines, 0 );
  }, 3000 );
}



function processLine( lines, idx ){
  if( idx < lines.length ){
    var line = lines[idx];                // https://xxx.xxx.xxx/019.1.pdf,filename(xxx.2019.1.pdf)
    if( line.startsWith( '#' ) ){
      setTimeout( function(){
        processLine( lines, idx + 1 );
      }, 1000 );
    }else{
      var tmp1 = line.split( ',' );            // [ 'abc', 'dec', 'xxx.2019.1.pdf' ]
      if( tmp1.length > 1 ){
        var url = tmp1[0];
        var filename = tmp1[1].trim();
        var tmp2 = filename.split( '.' ); // [ 'xxx', '2019', '1', 'pdf' ];
        var name = tmp2[0];
        var yyyy = tmp2[1];
        var nn = tmp2[2];

        var option = {
          url: url,
          method: 'GET',
          encoding: null,  //. 'binary'
          headers: {
            "Content-type": "application/pdf"
          }
        };
        request( option, function( err0, res0, body0 ){
          var filepath = './pdfs/' + filename;
          var stream = fs.createWriteStream( filepath );
          stream.write( body0, 'binary' );  //. TypeError: Invalid non-string/buffer chunk
          stream.on( 'finish', function(){
            var buf = fs.readFileSync( filepath );
            pdf( buf ).then( function( data ){
              //. Nitori.2020.3.pdf だと data.text = '\n\n\n\n....' となってしまう
              var text = data.text.split( "\n" ).join( ' ' );

              text2morphs( text ).then( function( results ){
                var id = filename; //. ファイル名を id とする
                var buf64 = new Buffer( buf ).toString( 'base64' );
                var data = {
                  _id: id,
                  filename: id,
                  name: name,
                  yyyy: yyyy,
                  nn: nn,
                  results: results,
                  datetime: ( new Date() ).getTime(),
                  _attachments: {}
                };
                data._attachments[id] = { content_type: 'application/pdf', data: buf64 };
                if( db ){
                  db.insert( data, function( err, body ){
                    setTimeout( function(){
                      processLine( lines, idx + 1 );
                    }, 1000 );
                  });
                }else{
                  console.log( 'db not ready: ' + id );
                  setTimeout( function(){
                    processLine( lines, idx + 1 );
                  }, 1000 );
                }
              }, function( err ){
                console.log( err );
                setTimeout( function(){
                  processLine( lines, idx + 1 );
                }, 1000 );
              });
            }, function( err ){
              console.log( err );
            });
          });
          stream.end();
        });
      }else{
        setTimeout( function(){
          processLine( lines, idx + 1 );
        }, 1000 );
      }
    }
  }else{
    return idx;
  }
}


function text2morphs( text ){
  return new Promise( function( resolve, reject ){
    try{
      //. Rakuten.2019.3.pdf や SoftBank.2019.3.pdf 等だとここで 'Error: spawn E2BIG' エラー
      //. エラーは仕方ないが、プロセスが止まってしまう（catch できない）のが問題・・・・
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
    }catch( e ){
      console.log( e );
      reject( e );
    }
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
