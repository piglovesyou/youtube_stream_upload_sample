const express = require('express');
const Path = require('path');
const connectFlash = require('connect-flash');
const Q = require('q');
const Busboy = require('busboy');
const stream = require('stream');
const Youtube = require('youtube-api');
const Session = require('express-session');
const FileStore = require('session-file-store')(Session);



Q.longStackSupport = true;
const app = express();
const fileStore = new FileStore();
const oauth = Youtube.authenticate({
  type: 'oauth',
  client_id: process.env.YOUTUBE_TESTAPP_OAUTH_CLIENT_ID,
  client_secret: process.env.YOUTUBE_TESTAPP_OAUTH_CLIENT_SECRET,
  redirect_url: process.env.YOUTUBE_TESTAPP_OAUTH_REDIRECT_URL
});



app.set('views', Path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(Session({
  store: fileStore,
  resave: 'boom',
  saveUninitialized: 'baa',
  secret: 'keyboard cat'
}));
app.use(express.static(Path.join(__dirname, 'public')));
app.use(connectFlash());



app.get('/', (req, res, next) => {
  res.render('index', {
    title: 'Piglovesyou File Uploading Test',
    isAuthed: !!req.session.auth_token,
    message: req.flash('message') || null,
    errorMessage: req.flash('error-message') || null,
    movieId: req.flash('movieId') || null,
  });
});

app.get('/authenticate', (req, res) => {
  res.redirect(oauth.generateAuthUrl({
    access_type: 'offline', scope: ['https://www.googleapis.com/auth/youtube.upload']
  }));
});

app.get('/logout', (req, res) => {
  fileStore.destroy(req.sessionID, (err) => {
    if (err) {
      res.send('logout failed');
    }
    req.session.auth_token = null;
    res.redirect('/');
  });
});

app.get('/oauth2callback', function (req, res) {
  Q.ninvoke(oauth, 'getToken', req.query.code)
  .then(([tokens]) => {
    req.session.auth_token = tokens;
    var hour = 60 * 60 * 1000;
    req.session.cookie.expires = new Date(Date.now + hour);
    req.session.cookie.maxAge = hour;
    req.flash('message', 'Authenticated.');
    res.redirect('/');
  })
});

app.post('/upload', (req, res) => {
  if (!req.session.auth_token) {
    req.flash('First authenticate.')
    return res.redirect('/');
  }

  // Suppose there are only two fields in a form:
  // - "nice_title" of text
  // - "nice_attachment" of file
  // If more, we have to write code little more.

  parseBody(req)
  .then(([fileStream, title]) => {
    return uploadToYoutube(req.session.auth_token, fileStream, title);
  })
  .then(([result]) => {
    req.flash('message', 'uploading succeeded!');
    req.flash('movieId', result.id);
    res.redirect('/');
  })
  .catch(reason => {
    console.error(reason.stack ? reason.stack : reason);
    req.flash('error-message', reason.stack ? reason.stack : reason);
    res.set({Connection: 'close'});
    res.redirect('/');
  });

});

function parseBody(req) {
  let detectAttachment = Q.defer();
  let detectTitle = Q.defer();

  // Set waiting limit
  setTimeout(()=> {
    let message = 'uploading from client timed out';
    if (detectAttachment.promise.isPending()) {
      detectAttachment.reject(message);
    }
    if (detectTitle.promise.isPending()) {
      detectTitle.reject(message);
    }
  }, 8 * 1000);

  let busboy = new Busboy({ headers: req.headers });
  busboy.on('file', (fieldname, fileReadableStream, filename, encoding, mimetype) => {
    detectAttachment.resolve(fileReadableStream);
  });
  busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated) => {
    detectTitle.resolve(val);
  });
  req.pipe(busboy);

  return Q.all([detectAttachment.promise, detectTitle.promise]);
}

function uploadToYoutube(authToken, readableStream, title) {
  oauth.setCredentials(authToken);
  return Q.ninvoke(Youtube.videos, 'insert', {
    resource: {
      snippet: {
        title: title,
        description: 'Test video upload via YouTube API'
      },
      status: {
        privacyStatus: 'private'
      }
    },
    part: 'snippet,status',
    media: {
      body: readableStream
    }
  })
}



// catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
