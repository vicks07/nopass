# NoPass - Website Time Limiter Extension

NoPass is a browser extension that helps you manage your time spent on websites by setting time limits and blocking access when those limits are reached.

## Features

- Set time limits for specific websites
- Real-time tracking of time spent on websites
- Automatic blocking when time limit is reached
- Easy-to-use interface
- Support for both online and local testing

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/nopass.git
cd nopass
```

2. Load the extension in your browser:
   - Open Chrome/Edge and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

## Testing

### Online Testing
1. Open `tests/test.html` in your browser
2. Click the extension icon in your browser toolbar
3. Add one of the test sites (e.g., "facebook.com") with a time limit
4. Click the test links to verify the extension's functionality

### Local Testing
1. Start the local server:
```bash
node server.js
```
2. Open `http://localhost:3000/tests/local-test.html`
3. Follow the testing instructions on the page

## Development

### Project Structure
```
nopass/
├── tests/              # Test files
│   ├── test.html      # Online testing page
│   └── local-test.html # Local testing page
├── server.js          # Local development server
└── README.md          # This file
```

### Local Development Server
The project includes a simple Node.js server for local testing. To start it:
```bash
node server.js
```
The server will run on `http://localhost:3000`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all contributors who have helped shape NoPass
- Inspired by the need for better digital wellbeing and time management
