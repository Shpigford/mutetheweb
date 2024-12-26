# Mute the Web

A Chrome extension that uses AI to detect and filter out negative posts from X.com (formerly Twitter), making your social media experience more positive.

## Features

- Analyzes posts in real-time using Llama 3.3 70B via OpenRouter API
- Automatically hides posts with high cynicism scores (>0.5)
- Works on X.com (formerly Twitter)
- Easy to enable/disable through popup interface
- Toggle button to show/hide filtered posts
- Visual indicators for filtered content
- Customizable API key settings

## Setup

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Click the extension icon in your toolbar
6. Enter your OpenRouter API key in the popup
   - Get an API key from [OpenRouter](https://openrouter.ai/)
   - The extension uses the Llama 3.3 70B model

## Usage

1. Click the extension icon to open the popup
2. Enter your OpenRouter API key
3. Use the toggle to enable/disable the filter
4. Browse X.com normally - cynical posts will be hidden automatically
5. Use the floating toggle button to show/hide filtered posts
6. Filtered posts will be visually marked when shown

## How it Works

The extension analyzes the text content of posts using the Llama 3.3 70B model through OpenRouter's API. Each post receives a cynicism score between 0 and 1. Posts scoring above 0.5 are automatically hidden from view. A floating toggle button allows you to show/hide filtered posts, with filtered content being visually marked when shown.

## Privacy

- The extension only sends post text to OpenRouter for analysis
- No personal data is collected or stored
- Your API key is stored locally in your browser
- All processing happens in real-time with no data retention

## Development

The extension consists of:
- `manifest.json`: Extension configuration
- `content.js`: Handles post detection, filtering, and UI elements
- `background.js`: Manages API calls and extension state
- `popup.html/js`: User interface for settings
- Custom CSS for visual styling and animations

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 