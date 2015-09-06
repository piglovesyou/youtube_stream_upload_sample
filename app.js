const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const connectFlash = require('connect-flash');
const FS = require('fs');
const Q = require('q');
Q.longStackSupport = true;
const Busboy = require('busboy');
const stream = require('stream');
const Youtube = require("youtube-api");


const app = express();
const oauth = Youtube.authenticate({
  type: "oauth",
  client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID,
  client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
  redirect_url: 'http://localhost:3000/oauth2callback'
}); 


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fileStore = new FileStore({});


app.use(session({
  store: fileStore,
  resave: 'boom',
  saveUninitialized: 'baa',
  secret: 'keyboard cat'
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(connectFlash());

app.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Test File Uploading',
    isAuthed: !!req.session.auth_token,
    msg: req.flash('msg') || null
  });
});

app.get('/authenticate', function(req, res) {
  res.redirect(oauth.generateAuthUrl({
    access_type: "offline", scope: ["https://www.googleapis.com/auth/youtube.upload"]
  }));
});

app.get('/logout', function(req, res) {
  console.log(fileStore.destroy)
  fileStore.destroy(req.sessionID, function(err) {
    if (err) {
      res.send("logout failed");
    }
    req.session.auth_token = null;
    res.redirect('/');
  });
});

app.get("/oauth2callback", function (req, res) {
  Q.ninvoke(oauth, 'getToken', req.query.code)
  .then(([tokens]) => {
    req.session.auth_token = tokens;
    var hour = 60 * 60 * 1000;
    req.session.cookie.expires = new Date(Date.now + hour);
    req.session.cookie.maxAge = hour;
    res.redirect('/');
  })
});

app.post('/upload', function(req, res) {
  if (!req.session.auth_token) {
    res.redirect('/');
  }

  // Suppose there are only two fields in a form:
  // - nice_title
  // - nice_attachment
  // If more, we cannot handle it correctly.

  let deferredFileStream = Q.defer();
  let deferredField = Q.defer();
  let busboy = new Busboy({ headers: req.headers });

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    console.log('file detected')
    deferredFileStream.resolve(file);
    // let saveTo = path.join(os.tmpDir(), path.basename(fieldname));
    // file.pipe(fs.createWriteStream(saveTo));
  });
  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
    console.log('======')
    console.log(val)
    deferredField.resolve(val);
  });
  busboy.on('finish', function() {
    console.log('Uploading from client-side has done');
    // res.writeHead(200, { 'Connection': 'close' });
    // res.end("That's all folks!");
  });
  req.pipe(busboy);

  Q.all([deferredFileStream.promise, deferredField.promise])
  .then(([fileStream, title]) => {
    console.log('lengtu', title)
    oauth.setCredentials(req.session.auth_token);
    return uploadToYoutube(fileStream, title);
  })
  .then(result => {
    req.flash('msg', 'upload succeeded!');
    res.redirect('/');
  })
  .catch(err => {
    console.log(err.stack);
    res.status(500).send('booom..');
  });


  // Q().then(() => {
  //   oauth.setCredentials(req.session.auth_token = tokens);
  //   Youtube.videos.insert({
  //     resource: {
  //       snippet: {
  //         title: "Testing YoutTube API NodeJS module",
  //         description: "Test video upload via YouTube API"
  //       },
  //       status: {
  //         privacyStatus: "private"
  //       }
  //     },
  //     part: "snippet,status",
  //     media: {
  //       body: FS.createReadStream("video.mp4")
  //     }
  //   }, function (err, data) {
  //     if (err) {
  //       return res.status(400).send(err.stack);
  //     }
  //     res.json(data);
  //   });
  //   oauth.credentials = null;
  // })
  // .catch(err => {
  //   console.error(err.stack)
  //   res.send(err.stack);
  // })
});

function uploadToYoutube(fileStream, title) {
  return Q.ninvoke(Youtube.videos, 'insert', {
    resource: {
      snippet: {
        title: title,
        description: "Test video upload via YouTube API"
      },
      status: {
        privacyStatus: "private"
      }
    },
    part: "snippet,status",
    media: {
      body: fileStream
    }
  })
}




function errRes(res) {
  return function(err) {
    res.status(400).send(err);
  }
}





// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
