# Cynic Filter Chrome Extension

A Chrome extension that uses AI to detect and filter out cynical posts from social media platforms (Twitter and Reddit).

## Features

- Analyzes posts in real-time using Llama 2 via OpenRouter API
- Automatically hides posts with high cynicism scores (>0.5)
- Works on Twitter and Reddit
- Easy to enable/disable through popup interface
- Customizable API key settings

## Setup

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Click the extension icon in your toolbar
6. Enter your OpenRouter API key in the popup
   - Get an API key from [OpenRouter](https://openrouter.ai/)
   - The extension uses the Llama 2 model

## Usage

1. Click the extension icon to open the popup
2. Enter your OpenRouter API key
3. Use the toggle to enable/disable the filter
4. Browse Twitter or Reddit normally - cynical posts will be hidden automatically

## How it Works

The extension analyzes the text content of posts using the Llama 2 model through OpenRouter's API. Each post receives a cynicism score between 0 and 1. Posts scoring above 0.5 are automatically hidden from view.

## Privacy

- The extension only sends post text to OpenRouter for analysis
- No personal data is collected or stored
- Your API key is stored locally in your browser

## Development

The extension consists of:
- `manifest.json`: Extension configuration
- `content.js`: Handles post detection and filtering
- `background.js`: Manages API calls
- `popup.html/js`: User interface

## License

MIT License - feel free to modify and use as needed. 