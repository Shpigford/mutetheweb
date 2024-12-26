console.log('=== CYNIC FILTER BACKGROUND SCRIPT LOADED ===');

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Initialize extension settings only if they don't exist
chrome.runtime.onInstalled.addListener(() => {
    console.log('🔧 Checking initial settings...');
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
                console.log('✅ Default settings initialized:', updates);
            });
        } else {
            console.log('✅ Using existing settings:', {
                hasApiKey: !!result.apiKey,
                isEnabled: result.isEnabled,
                filteredPostsCount: result.filteredPosts?.length || 0
            });
        }
    });
});

// Function to analyze text for different types of content using OpenRouter API
async function analyzeContentWithAI(text) {
    console.log('🤖 Starting AI analysis for text:', text);
    
    const { apiKey, isEnabled } = await chrome.storage.local.get(['apiKey', 'isEnabled']);
    
    if (!isEnabled) {
        console.log('⚠️ Extension is disabled');
        return null;
    }

    if (!apiKey) {
        console.error('❌ API key not set - please set your OpenRouter API key in the extension popup');
        throw new Error('API key not set');
    }

    const prompt = `Analyze the following text and rate it on a scale of 0 to 1 for different characteristics. Only respond with JSON in this exact format:
{
    "cynical": 0.0,
    "sarcastic": 0.0,
    "aggressive": 0.0,
    "threatening": 0.0
}

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
            max_tokens: 200,
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

        // Extract the response text and parse JSON
        const responseText = data?.choices?.[0]?.message?.content?.trim() || '';
        console.log('📥 Raw response text:', responseText);

        try {
            const scores = JSON.parse(responseText);
            
            // Ensure all scores are between 0 and 1
            Object.keys(scores).forEach(key => {
                scores[key] = Math.max(0, Math.min(1, parseFloat(scores[key]) || 0));
            });
            
            console.log('📊 Final content scores:', scores);
            return scores;
        } catch (error) {
            console.error('❌ Error parsing response JSON:', error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error during API call:', error);
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
        console.log('📨 Received analysis request from content script for text:', request.text);
        
        // Create an async wrapper function
        const handleAnalysis = async () => {
            try {
                const scores = await analyzeContentWithAI(request.text);
                console.log('📤 Sending scores back to content script:', scores);
                
                if (scores) {
                    const url = sender.tab?.url || '';
                    // We'll let the content script decide which filter type triggered the hide
                    await updateFilteredPosts(request.text, scores, null, url);
                    sendResponse({ success: true, scores });
                } else {
                    sendResponse({ success: false, error: 'Failed to analyze content' });
                }
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