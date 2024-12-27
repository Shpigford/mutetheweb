// Debug logging wrapper
let debugMode = false;

// Initialize debug mode
chrome.storage.local.get(['debugMode'], (result) => {
    debugMode = result.debugMode || false;
});

// Listen for debug mode changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.debugMode) {
        debugMode = changes.debugMode.newValue;
    }
});

function debugLog(...args) {
    if (debugMode) {
        console.log(...args);
    }
}

function debugError(...args) {
    if (debugMode) {
        console.error(...args);
    }
}

debugLog('=== CYNIC FILTER BACKGROUND SCRIPT LOADED ===');

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Function to update extension badge based on API key status
async function updateBadgeStatus() {
    const { apiKey } = await chrome.storage.local.get(['apiKey']);
    if (!apiKey) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// Initialize extension settings only if they don't exist
chrome.runtime.onInstalled.addListener(() => {
    debugLog('🔧 Checking initial settings...');
    chrome.storage.local.get(['apiKey', 'isEnabled', 'filteredPosts'], (result) => {
        const updates = {};
        
        // Only set if not already set
        if (typeof result.isEnabled === 'undefined') {
            updates.isEnabled = true;
        }
        
        // Don't override existing API key
        if (!result.apiKey) {
            updates.apiKey = '';
        }

        // Initialize filtered posts if not exists
        if (!result.filteredPosts) {
            updates.filteredPosts = [];
        }
        
        // Only save if we have updates to make
        if (Object.keys(updates).length > 0) {
            chrome.storage.local.set(updates, () => {
                debugLog('✅ Default settings initialized:', updates);
                updateBadgeStatus(); // Update badge after initialization
            });
        } else {
            debugLog('✅ Using existing settings:', {
                hasApiKey: !!result.apiKey,
                isEnabled: result.isEnabled,
                filteredPostsCount: result.filteredPosts?.length || 0
            });
            updateBadgeStatus(); // Update badge with existing settings
        }
    });
});

// Listen for changes to the API key
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.debugMode) {
            debugMode = changes.debugMode.newValue;
        }
        if (changes.apiKey) {
            updateBadgeStatus(); // Update badge when API key changes
        }
    }
});

// Function to analyze text for different types of content using OpenRouter API
async function analyzeContentWithAI(text) {
    debugLog('🤖 Starting AI analysis for text:', text);
    
    const { apiKey, isEnabled } = await chrome.storage.local.get(['apiKey', 'isEnabled']);
    
    if (!isEnabled) {
        debugLog('⚠️ Extension is disabled');
        return null;
    }

    if (!apiKey) {
        debugError('❌ API key not set - please set your OpenRouter API key in the extension popup');
        throw new Error('API key not set');
    }

    const prompt = `Analyze the following text and rate it on a scale of 0 to 1 for different characteristics. Respond with ONLY a JSON object in this exact format, nothing else:
{
    "cynical": 0.0,
    "sarcastic": 0.0,
    "aggressive": 0.0,
    "threatening": 0.0,
    "politics": 0.0,
    "racism": 0.0
}

Here are definitions for each of the fields:
- "cynical": 0.0 - The text is highly cynical and negative.
- "sarcastic": 0.0 - The text is sarcastic and mocking.
- "aggressive": 0.0 - The text is aggressive and hostile.
- "threatening": 0.0 - The text is threatening and contains violent or harmful content.
- "politics": 0.0 - The text is highly political and contains political content.
- "racism": 0.0 - The text contains racist content, hate speech, or discriminatory language.

Text: "${text}"`;
    
    try {
        debugLog('🔄 Making API request with prompt:', prompt);
        debugLog('🔑 Using API key:', apiKey.substring(0, 4) + '...');
        
        const requestBody = {
            model: 'meta-llama/llama-3.3-70b-instruct',
            messages: [
                {
                    role: 'system',
                    content: 'You are a content analyzer that exclusively responds with JSON. Never include any other text or explanation in your response.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            provider: {
                ignore: ["Lambda"]
            },
            temperature: 0,
            max_tokens: 200,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };
        
        debugLog('📤 Request body:', requestBody);
        
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/Shpigford/mutetheweb',
                'X-Title': 'MuteTheWeb'
            },
            body: JSON.stringify(requestBody)
        });

        debugLog('📥 Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            debugError('❌ API request failed:', {
                status: response.status,
                statusText: response.statusText,
                response: errorText
            });
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        debugLog('✅ Response received, parsing JSON...');
        const data = await response.json();
        debugLog('📥 Raw API Response:', data);

        // Extract the response text and parse JSON
        const responseText = data?.choices?.[0]?.message?.content?.trim() || '';
        debugLog('📥 Raw response text:', responseText);

        try {
            // Try to extract JSON from the response if it contains other text
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
            
            // Parse the JSON
            const scores = JSON.parse(jsonStr);
            
            // Validate the required fields
            const requiredFields = ['cynical', 'sarcastic', 'aggressive', 'threatening'];
            const hasAllFields = requiredFields.every(field => typeof scores[field] === 'number');
            
            if (!hasAllFields) {
                debugError('❌ Response missing required fields');
                return null;
            }
            
            // Ensure all scores are between 0 and 1
            Object.keys(scores).forEach(key => {
                scores[key] = Math.max(0, Math.min(1, parseFloat(scores[key]) || 0));
            });
            
            debugLog('📊 Final content scores:', scores);
            return scores;
        } catch (error) {
            debugError('❌ Error parsing response JSON:', error);
            debugError('Raw response was:', responseText);
            return null;
        }
    } catch (error) {
        debugError('❌ Error during API call:', error);
        throw error;
    }
}

// Function to update filtered posts
async function updateFilteredPosts(text, scores, filterType, url) {
    const { filteredPosts = [] } = await chrome.storage.local.get(['filteredPosts']);
    
    // Add new filtered post
    const newPost = {
        text: text,
        scores: scores,
        filterType: filterType,
        url: url,
        timestamp: Date.now()
    };
    
    // Keep only the last 100 filtered posts
    const updatedPosts = [newPost, ...filteredPosts].slice(0, 100);
    
    await chrome.storage.local.set({ filteredPosts: updatedPosts });
    return updatedPosts.length;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'analyzeContent') {
        debugLog('📨 Received analysis request from content script for text:', request.text);
        
        // Create an async wrapper function
        const handleAnalysis = async () => {
            try {
                const scores = await analyzeContentWithAI(request.text);
                debugLog('📤 Sending scores back to content script:', scores);
                
                if (scores) {
                    const url = sender.tab?.url || '';
                    // We'll let the content script decide which filter type triggered the hide
                    await updateFilteredPosts(request.text, scores, null, url);
                    sendResponse({ success: true, scores });
                } else {
                    sendResponse({ success: false, error: 'Failed to analyze content' });
                }
            } catch (error) {
                debugError('❌ Error in analysis:', error);
                sendResponse({ success: false, error: error.message });
            }
        };

        // Execute the analysis and keep the message channel open
        handleAnalysis().catch(error => {
            debugError('❌ Unhandled error in analysis:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true; // Keep the message channel open for the async response
    }
}); 