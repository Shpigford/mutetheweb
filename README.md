# Mute the Web

A Chrome extension that uses AI to detect and filter out negative posts from X.com (formerly Twitter), making your social media experience more positive.

## Features

- Analyzes posts in real-time using Llama 3.3 70B via OpenRouter API
- Automatically detects and filters multiple types of content:
  - Cynical posts
  - Sarcastic content
  - Threatening language
  - Political content
  - Racist or discriminatory content
- Works on X.com (formerly Twitter)
- Easy to enable/disable through popup interface
- Blur mode option instead of hiding posts completely
- Toggle button to show/hide filtered posts
- Visual indicators for filtered content
- Debug mode for troubleshooting
- 24-hour content caching to reduce API usage
- Real-time statistics tracking
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
3. Configure your filter preferences:
   - Enable/disable specific content filters
   - Toggle blur mode vs. hide mode
   - Enable/disable debug mode
4. Browse X.com normally - filtered posts will be hidden or blurred
5. Use the floating toggle button to show/hide filtered posts
6. View filtering statistics and manage cache
7. Click blurred posts to reveal their content

## How it Works

The extension analyzes the text content of posts using the Llama 3.3 70B model through OpenRouter's API. Each post is evaluated for multiple characteristics (cynicism, sarcasm, threats, political content, and racism) with scores between 0 and 1. Posts scoring above 0.5 in any enabled category are automatically hidden or blurred based on your settings.

The extension includes a caching system that stores analysis results for 24 hours to minimize API usage and improve performance. A statistics page allows you to track filtered content and monitor the extension's effectiveness.

## Privacy

- The extension only sends post text to OpenRouter for analysis
- No personal data is collected or stored
- Your API key is stored locally in your browser
- All processing happens in real-time
- Cache data is stored locally and automatically cleared after 24 hours

## Development

The extension consists of:
- `manifest.json`: Extension configuration
- `content.js`: Handles post detection, filtering, and UI elements
- `background.js`: Manages API calls and extension state
- `popup.html/js`: User interface for settings and controls
- `stats.html/js`: Statistics tracking and visualization
- Custom CSS for visual styling and animations

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 