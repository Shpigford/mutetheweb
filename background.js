console.log('=== CYNIC FILTER BACKGROUND SCRIPT LOADED ===');

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Initialize extension settings only if they don't exist
chrome.runtime.onInstalled.addListener(() => {
    console.log('🔧 Checking initial settings...');
    chrome.storage.local.get(['apiKey', 'isEnabled'], (result) => {
        const updates = {};
        
        // Only set if not already set
        if (typeof result.isEnabled === 'undefined') {
            updates.isEnabled = true;
        }
        
        // Don't override existing API key
        if (!result.apiKey) {
            updates.apiKey = '';
        }
        
        // Only save if we have updates to make
        if (Object.keys(updates).length > 0) {
            chrome.storage.local.set(updates, () => {
                console.log('✅ Default settings initialized:', updates);
            });
        } else {
            console.log('✅ Using existing settings:', {
                hasApiKey: !!result.apiKey,
                isEnabled: result.isEnabled
            });
        }
    });
});

// Function to analyze text for cynicism using OpenRouter API
async function analyzeCynicismWithAI(text) {
    console.log('🤖 Starting AI analysis for text:', text);
    
    const { apiKey, isEnabled } = await chrome.storage.local.get(['apiKey', 'isEnabled']);
    
    if (!isEnabled) {
        console.log('⚠️ Extension is disabled');
        return 0;
    }

    if (!apiKey) {
        console.error('❌ API key not set - please set your OpenRouter API key in the extension popup');
        throw new Error('API key not set');
    }

    const prompt = `Rate how cynical this text is on a scale of 0 to 1. Only respond with a number.

Text: "${text}"

Rating:`;
    
    try {
        console.log('🔄 Making API request with prompt:', prompt);
        console.log('🔑 Using API key:', apiKey.substring(0, 4) + '...');
        
        const requestBody = {
            model: 'meta-llama/llama-3.3-70b-instruct',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0,
            max_tokens: 10,
            stop: ["\n"],
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };
        
        console.log('📤 Request body:', requestBody);
        
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/Shpigford/mutetheweb',
                'X-Title': 'Mute the Web'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API request failed:', {
                status: response.status,
                statusText: response.statusText,
                response: errorText
            });
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        console.log('✅ Response received, parsing JSON...');
        const data = await response.json();
        console.log('📥 Raw API Response:', data);

        // Extract the response text
        const responseText = data?.choices?.[0]?.message?.content?.trim() || '';
        console.log('📥 Raw response text:', responseText);

        // Try to extract a number from the response
        let score = 0;
        
        // First try exact number match
        const numberMatch = responseText.match(/([0-9]*\.?[0-9]+)/);
        if (numberMatch) {
            score = parseFloat(numberMatch[1]);
        } else {
            // Fallback: try to interpret common text responses
            const lowerText = responseText.toLowerCase();
            if (lowerText.includes('high') || lowerText.includes('very cynical')) {
                score = 0.8;
            } else if (lowerText.includes('moderate')) {
                score = 0.5;
            } else if (lowerText.includes('low') || lowerText.includes('not cynical')) {
                score = 0.2;
            }
            console.log('ℹ️ No exact number found, interpreted text response:', score);
        }
        
        // Ensure the score is between 0 and 1
        const normalizedScore = Math.max(0, Math.min(1, score));
        console.log('📊 Final cynicism score:', normalizedScore);
        return normalizedScore;
    } catch (error) {
        console.error('❌ Error during API call:', error);
        throw error;
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'analyzeCynicism') {
        console.log('📨 Received analysis request from content script for text:', request.text);
        
        // Create an async wrapper function
        const handleAnalysis = async () => {
            try {
                const cynicismScore = await analyzeCynicismWithAI(request.text);
                console.log('📤 Sending score back to content script:', cynicismScore);
                sendResponse({ success: true, cynicismScore });
            } catch (error) {
                console.error('❌ Error in analysis:', error);
                sendResponse({ success: false, error: error.message });
            }
        };

        // Execute the analysis and keep the message channel open
        handleAnalysis().catch(error => {
            console.error('❌ Unhandled error in analysis:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true; // Keep the message channel open for the async response
    }
}); 