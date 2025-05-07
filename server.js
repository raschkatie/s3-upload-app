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
    region: 'us-east-2'
});

const PORT = 80;

app.get('/images', async (req, res) => {
    try {
        const listObjectsParams = {
            Bucket: 'exercise-2-5-lambda',
            Prefix: 'resized-images/'
        };

        const command = new ListObjectsV2Command(listObjectsParams);
        const data = await s3Client.send(command);

        const files = data.Contents
            ? data.Contents.map(obj => {
                const key = obj.Key;
                return `https://${listObjectsParams.Bucket}.s3.us-east-2.amazonaws.com/${key}`;
            })
            : [];

        res.send(files);
    } catch (err) {
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
            Bucket: 'exercise-2-5-lambda',
            Key: `original-images/${fileName}`,
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});