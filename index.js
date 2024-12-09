const express = require('express');
const multer = require('multer');
const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand
} = require('@aws-sdk/client-s3');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
const dotenv = require('dotenv');


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3123;

// Configuration loader
const loadConfig = () => {
    try {
        return require('./config.json');
    } catch (error) {
        console.error('Error loading config:', error);
        return {
            storageType: 'filesystem',
            paths: {
                furnitureData: './data',
                icons: {
                    filesystem: './icons',
                    r2: '',
                    s3: ''
                },
                furniture: {
                    filesystem: './furniture',
                    r2: '',
                    s3: ''
                }
            }
        };
    }
};

// Dynamic storage client based on configuration
class StorageClient {
    constructor(config) {
        this.config = config;
        this.client = this.initializeClient();
    }

    initializeClient() {
        switch (this.config.storageType) {
            case 'r2':
            case 's3':
                return new S3Client({
                    region: 'auto',
                    endpoint: this.config.r2?.endpoint || '',
                    credentials: {
                        accessKeyId: this.config.r2?.accessKeyId || '',
                        secretAccessKey: this.config.r2?.secretAccessKey || ''
                    }
                });
            case 'filesystem':
            default:
                return null;
        }
    }

    // Resolve path based on storage type and path type
    resolvePath(pathType) {
        const { storageType, paths } = this.config;

        // Get the specific path for the given type
        const specificPath = paths[pathType][storageType];

        // If no specific path is set, use a default
        if (!specificPath) {
            throw new Error(`No path configured for ${pathType} with storage type ${storageType}`);
        }

        return specificPath;
    }

    async readJsonFile(filename) {
        try {
            const basePath = this.resolvePath('furnitureData');

            switch (this.config.storageType) {
                case 'r2':
                case 's3':
                    const params = {
                        Bucket: this.config.r2?.bucketName,
                        Key: `${basePath}/${filename}`
                    };
                    const command = new GetObjectCommand(params);
                    const response = await this.client.send(command);
                    const bodyContents = await response.Body.transformToString();
                    return JSON.parse(bodyContents);

                case 'filesystem':
                default:
                    const filePath = path.join(basePath, filename);
                    const fileContents = await fs.readFile(filePath, 'utf8');
                    return JSON.parse(fileContents);
            }
        } catch (error) {
            console.error(`Error reading file ${filename}:`, error);
            return null;
        }
    }

    async writeJsonFile(filename, data) {
        try {
            const basePath = this.resolvePath('furnitureData');

            switch (this.config.storageType) {
                case 'r2':
                case 's3':
                    const params = {
                        Bucket: this.config.r2?.bucketName,
                        Key: `${basePath}/${filename}`,
                        Body: JSON.stringify(data, null, 2),
                        ContentType: 'application/json'
                    };
                    const command = new PutObjectCommand(params);
                    await this.client.send(command);
                    return true;

                case 'filesystem':
                default:
                    const fullFilePath = path.join(basePath, filename);

                    // Ensure directory exists (recursive creation)
                    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });

                    // Write file with full permissions and ensure parent directory exists
                    await fs.writeFile(fullFilePath, JSON.stringify(data, null, 2), {
                        encoding: 'utf8',
                        mode: 0o666
                    });

                    // Optional: Verify file was written (adds some overhead, can be removed)
                    try {
                        await fs.access(fullFilePath);
                        console.log(`File successfully written: ${fullFilePath}`);
                        return true;
                    } catch (accessError) {
                        console.error(`Failed to verify file: ${fullFilePath}`, accessError);
                        return false;
                    }
            }
        } catch (error) {
            console.error(`Error writing file ${filename}:`, error);
            console.error('Detailed error stack:', error.stack);
            return false;
        }
    }

    async uploadFile(filename, file, fileType = 'icons') {
        try {
            const basePath = this.resolvePath(fileType);

            switch (this.config.storageType) {
                case 'r2':
                case 's3':
                    const params = {
                        Bucket: this.config.r2?.bucketName,
                        Key: `${basePath}/${filename}`,
                        Body: file.buffer,
                        ContentType: file.mimetype
                    };
                    const command = new PutObjectCommand(params);
                    await this.client.send(command);
                    return true;

                case 'filesystem':
                default:
                    const filePath = path.join(basePath, filename);
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, file.buffer);
                    return true;
            }
        } catch (error) {
            console.error(`Error uploading file ${filename}:`, error);
            return false;
        }
    }
}

// Load configuration
const config = loadConfig();
const storageClient = new StorageClient(config);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/files', async (req, res) => {
    try {
        const filename = req.query.filename || 'FurnitureData.json';
        const fileContents = await storageClient.readJsonFile(filename);

        if (!fileContents) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ filename, data: fileContents });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read files', details: error.message });
    }
});

app.post('/update-item', async (req, res) => {
    const { filename, itemId, updates } = req.body;

    try {
        const jsonData = await storageClient.readJsonFile(filename);

        if (!jsonData) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Define default values
        const defaultValues = {
            adurl: "",
            bc: false,
            buyout: false,
            canlayon: false,
            cansiton: false,
            canstandon: false,
            category: "credit",
            classname: "",
            customparams: "",
            defaultdir: 0,
            description: "",
            environment: "",
            excludeddynamic: false,
            furniline: "",
            id: 0,
            name: "",
            offerid: 0,
            partcolors: {
                color: []
            },
            rare: false,
            rentbuyout: false,
            rentofferid: -1,
            revision: 0,
            specialtype: 0,
            xdim: 1,
            ydim: 1
        };

        // Support both room and wall item types
        const itemTypes = ['roomitemtypes', 'wallitemtypes'];
        let itemFound = false;

        for (const itemType of itemTypes) {
            if (jsonData[itemType] && jsonData[itemType].furnitype) {
                const itemIndex = jsonData[itemType].furnitype.findIndex(
                    item => item.id == itemId
                );

                if (itemIndex !== -1) {
                    // Merge the existing item, updates, and default values
                    jsonData[itemType].furnitype[itemIndex] = {
                        ...defaultValues, // Ensure defaults are applied first
                        ...jsonData[itemType].furnitype[itemIndex], // Retain current item data
                        ...updates // Apply incoming updates
                    };
                    itemFound = true;
                    break;
                }
            }
        }

        if (!itemFound) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const writeSuccess = await storageClient.writeJsonFile(filename, jsonData);

        if (writeSuccess) {
            res.json({
                message: 'Item successfully updated',
                updatedItem: updates
            });
        } else {
            res.status(500).json({ error: 'Failed to write updates' });
        }
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.post('/add-item', async (req, res) => {
    const { filename, itemData } = req.body;

    try {
        const jsonData = await storageClient.readJsonFile(filename);

        if (!jsonData) {
            return res.status(404).json({ error: 'File not found' });
        }

        const defaultValues = {
            adurl: "",
            bc: false,
            buyout: false,
            canlayon: false,
            cansiton: false,
            canstandon: false,
            category: "credit",
            classname: "",
            customparams: "",
            defaultdir: 0,
            description: "",
            environment: "",
            excludeddynamic: false,
            furniline: "",
            id: 0,
            name: "",
            offerid: 0,
            partcolors: {
                color: []
            },
            rare: false,
            rentbuyout: false,
            rentofferid: -1,
            revision: 0,
            specialtype: 0,
            xdim: 1,
            ydim: 1
        };

        // Support both room and wall item types
        const itemTypes = ['roomitemtypes', 'wallitemtypes'];
        let itemAdded = false;

for (const itemType of itemTypes) {
    if (jsonData[itemType] && jsonData[itemType].furnitype) {
        // Ensure a unique ID
        const newItemId = Date.now();
        const newItem = {
            ...defaultValues, // Apply default values first
            ...itemData, // Override with new item data
            id: newItemId // Ensure unique ID
        };

        jsonData[itemType].furnitype.push(newItem);
        itemAdded = true;
        break;
    }
}

        if (!itemAdded) {
            return res.status(400).json({ error: 'Could not add item' });
        }

        const writeSuccess = await storageClient.writeJsonFile(filename, jsonData);

        if (writeSuccess) {
            res.json({
                message: 'Item successfully added',
                newItem: itemData
            });
        } else {
            res.status(500).json({ error: 'Failed to write updates' });
        }
    } catch (error) {
        console.error('Add item error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.post('/upload-asset', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { classname } = req.body;
    const file = req.file;

    // Validate file type and generate filename
    let filename;
    let fileType;

    if (file.mimetype === 'image/png' && file.originalname.endsWith('_icon.png')) {
        filename = file.originalname;
        fileType = 'icons';
    } else if (file.originalname.endsWith('.nitro')) {
        filename = file.originalname;
        fileType = 'furniture';
    } else {
        return res.status(400).json({ error: 'Invalid file type or name' });
    }

    console.log('Uploading file:', filename);

    try {
        const uploadSuccess = await storageClient.uploadFile(filename, file, fileType);

        if (uploadSuccess) {
            res.json({
                message: 'Asset successfully uploaded',
                filename: filename
            });
        } else {
            res.status(500).json({ error: 'Failed to upload asset' });
        }
    } catch (error) {
        console.error('Asset upload error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Furnidata Editor running on http://localhost:${PORT}`);
});