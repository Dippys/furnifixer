
# FurniFixer

FurniFixer is a Configurable Furniture Management Tool designed to help manage and configure furniture data efficiently. It provides a web interface for editing furnidata and supports file uploads, including furniture assets in `.nitro` format and icons.

## Features

- Upload and manage furniture data and assets.
- Edit existing furniture items.
- Add new furniture items with default configurations.
- Web interface for easy access and management.

## Prerequisites

- Node.js (v21 or newer)
- npm (Node Package Manager)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/dippys/furnifixer.git
   cd furnifixer
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Configure paths for storing furniture data and assets in `config.json`.

## Usage

To start the application:

```bash
npm start
```

The server will start, and you can access the application at `http://localhost:3000` in your web browser.

## Key Routes

- `/` - The main page with the Furnidata Editor interface.
- `/files` - Fetch furniture data files.
- `/upload-asset` - Upload a new asset (such as a `.nitro` file or an icon).
- `/add-item` - Add a new furniture item.
- `/update-item` - Update an existing furniture item.

## Adding and Managing Items

1. **View Existing Items**: The main page displays the list of current furniture items.
2. **Add a New Item**:
    - Open the add item modal.
    - Enter item details such as classname, name, dimensions, and other properties.
    - Upload furniture and icon files, if necessary.
    - Click "Save Item" to confirm the addition.
3. **Edit an Item**:
    - Select an item from the list.
    - Make the desired changes.
    - Click "Save Item" to update the item.

## File Uploads

- **Icon Files**: Must be in `PNG` format and end with `_icon.png`.
- **Furniture Files**: Must be in `.nitro` format.

## Licensing

This project is licensed under the Unlicense License.

## Contributing

Contributions are welcome! Please read our contributing guidelines for more details.

## Support

For any issues, please [open an issue](https://github.com/dippys/furnifixer/issues) on GitHub.

## Acknowledgments

Thanks to all contributors and supporters of this project!
