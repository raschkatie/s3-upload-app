const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();

// middleware
app.use(fileUpload());

// tells express to serve static files like styles.css
app.use(express.static(__dirname));

// temporary path to upload files
const UPLOAD_TEMP_PATH = path.join(__dirname, 'uploads');

// confirm upload folder exists
if (!fs.existsSync(UPLOAD_TEMP_PATH)) {
    fs.mkdirSync(UPLOAD_TEMP_PATH);
}

// set up S3 Client (using LocalStack)
const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
    forcePathStyle: true
});

const PORT = 3000;

app.get('/images', async (req, res) => {
    try {
        const listObjectsParams = {
            Bucket: 'my-cool-local-bucket'
        };

        const command = new ListObjectsV2Command(listObjectsParams);
        const data = await s3Client.send(command);

        // check if there are any contents
        const files = data.Contents ? data.Contents.map(obj => obj.Key) : [];

        res.send(files);
    } catch(err) {
        console.error('Error listing objects: ', err);
        res.status(500).send('Error listing images');
    }
});

app.post('/images', async (req, res) => {
    if (!req.files || !req.files.image) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.image;
    const fileName = file.name;
    const tempPath = path.join(UPLOAD_TEMP_PATH, fileName);

    try {
        // save file temporarily
        await file.mv(tempPath);

        // read file from disk
        const fileContent = fs.readFileSync(tempPath);

        // upload to S3
        const uploadParams = {
            Bucket: 'my-cool-local-bucket',
            Key: fileName,
            Body: fileContent
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // clean up temp file
        // fs.unlinkSync(tempPath);

        res.send('File uploaded successfully!');
    } catch(err) {
        console.error('Error uploading file: ', err);
        res.status(500).send('Error uploading file.');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_TEMP_PATH, filename);

    if(fs.existsSync(filePath)) {
        res.download(filePath); // tells browser to download the response
    } else {
        res.status(404).send('File not found');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});