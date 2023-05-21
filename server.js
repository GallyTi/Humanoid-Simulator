const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

var limits = {}; // Add this line

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/limits')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

var uploadLimits = multer({ storage: storage })

var modelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/models')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

var uploadModel = multer({ storage: modelStorage })

const uploadAnimation = multer({ dest: 'public/animations' });

app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/models', function (req, res) {
  fs.readdir('./public/models', (err, files) => {
    res.send(files);
  });
});

app.get('/animations', function (req, res) {
  fs.readdir('./public/animations', (err, files) => {
    res.send(files);
  });
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/limits')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

app.post('/upload/:modelName', function (req, res) {
  const modelName = req.params.modelName;
  const recordedRotations = req.body.recordedRotations;

  const dir = './public/animations/';
  let files = fs.readdirSync(dir);
  let count = 0;

  files.forEach(function (file) {
    if (file.startsWith(modelName)) {
      count++;
    }
  });

  let fileName = `${dir}${modelName}-animation-${count + 1}.json`;

  fs.writeFileSync(fileName, JSON.stringify(recordedRotations), 'utf8');

  res.send({ status: 'success', message: 'File saved', fileName: fileName });
});

app.post('/upload-animation', uploadAnimation.single('animation'), function (req, res) {
  fs.renameSync(req.file.path, path.join(req.file.destination, req.file.originalname));
  res.send({ status: 'success', message: 'File uploaded', fileName: req.file.originalname });
});

app.post('/upload-model', uploadModel.single('model'), function (req, res) {
  fs.renameSync(req.file.path, path.join(req.file.destination, req.file.originalname));
  res.send({ status: 'success', message: 'Model uploaded', fileName: req.file.originalname });
});

app.post('/upload-limits', uploadLimits.single('limits'), function (req, res) {
  fs.renameSync(req.file.path, path.join(req.file.destination, req.file.originalname));
  res.send({ status: 'success', message: 'Limits file uploaded', fileName: req.file.originalname });
});




app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

app.get('/getAnimations', (req, res) => {
  fs.readdir('./public/animations', (err, files) => {
    if (err) {
      console.log(err);
      res.status(500).send('Error reading animations directory');
    } else {
      res.json({ animations: files });
    }
  });
});

// Serve limit files
app.get('/limits/:filename', function(req, res) {
  const filename = req.params.filename;
  if (limits[filename]) {
    res.sendFile(path.join(__dirname, limits[filename]));
  } else {
    res.status(404).send('No such limits file');
  }
});