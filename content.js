// Debug logging wrapper
let debugMode = false;

// Initialize debug mode
chrome.storage.local.get(['debugMode'], (result) => {
    debugMode = result.debugMode || false;
});

// Listen for debug mode changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateDebugMode') {
        debugMode = message.debugMode;
        sendResponse({ success: true });
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

debugLog('=== CYNIC FILTER CONTENT SCRIPT LOADED ===');

// Configuration
const FILTER_THRESHOLDS = {
    cynical: 0.5,
    sarcastic: 0.5,
    aggressive: 0.5,
    threatening: 0.5
};

// Add styles to the page
const style = document.createElement('style');
style.textContent = `
    /* Base hiding styles */
    .content-hidden {
        display: none !important;
    }
    
    /* Blur mode styles */
    .content-blurred {
        filter: blur(10px) !important;
        user-select: none !important;
        cursor: pointer !important;
        transition: filter 0.3s ease !important;
    }

    .content-blurred:hover {
        filter: blur(8px) !important;
    }

    .content-blurred.revealed {
        filter: none !important;
        user-select: auto !important;
    }
    
    /* Show styles */
    .show-filtered .content-hidden {
        opacity: 1 !important;
        pointer-events: auto !important;
        filter: none !important;
        border: 2px solid #ff4444 !important;
        padding: 10px !important;
        margin: 10px 0 !important;
        border-radius: 4px !important;
    }

    /* Filter type indicators */
    .content-hidden[data-filter-type]::before {
        display: block;
        padding: 4px 8px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        color: white;
        background: #ff4444;
    }
    .content-hidden[data-filter-type="cynical"]::before {
        content: "Filtered: Cynical";
    }
    .content-hidden[data-filter-type="sarcastic"]::before {
        content: "Filtered: Sarcastic";
    }
    .content-hidden[data-filter-type="aggressive"]::before {
        content: "Filtered: Aggressive";
    }
    .content-hidden[data-filter-type="threatening"]::before {
        content: "Filtered: Threatening";
    }
`;
document.head.appendChild(style);

let showFiltered = false;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showFilteredPosts') {
        showFiltered = !showFiltered;
        document.body.classList.toggle('cynic-show-filtered');
        sendResponse({ success: true });
    } else if (message.action === 'updateBlurMode') {
        // Update existing filtered posts when blur mode changes
        const filteredPosts = document.querySelectorAll('.content-hidden, .content-blurred');
        filteredPosts.forEach(post => {
            // Remove all existing filter-related classes first
            post.classList.remove('content-hidden', 'content-blurred', 'revealed');
            
            if (message.blurMode) {
                post.classList.add('content-blurred');
                // Add click handler
                const clickHandler = function(e) {
                    if (this.classList.contains('content-blurred')) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.classList.add('revealed');
                    }
                };
                // Remove existing handler if any
                post.removeEventListener('click', clickHandler, true);
                post.addEventListener('click', clickHandler, true);
            } else {
                post.classList.add('content-hidden');
            }
        });
        sendResponse({ success: true });
    }
});

// X.com selectors
const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const TWEET_TEXT_SELECTOR = '[data-testid="tweetText"]';

// Check if we're on X.com
function isOnXPlatform() {
    return window.location.hostname.includes('x.com');
}

// Extract text from a tweet element
function extractTweetText(tweetElement) {
    const textElement = tweetElement.querySelector(TWEET_TEXT_SELECTOR);
    const text = textElement ? textElement.textContent.trim() : '';
    if (text) {
        debugLog('📝 Found tweet text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
    return text;
}

// Check if extension context is valid
function isExtensionValid() {
    try {
        return chrome.runtime && !!chrome.runtime.getManifest();
    } catch (e) {
        return false;
    }
}

// Analyze post content
async function analyzeContent(text) {
    try {
        if (!isExtensionValid()) {
            debugLog('🔄 Extension context invalid, reloading page...');
            window.location.reload();
            return null;
        }

        debugLog('🔄 Sending text for analysis:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'analyzeContent',
                text: text
            }, (response) => {
                debugLog('📥 Received response:', response);
                
                if (response && response.success) {
                    debugLog('📊 Valid analysis scores:', response.scores);
                    resolve(response.scores);
                } else {
                    if (response && response.error) {
                        debugError('❌ Analysis error:', response.error);
                    } else {
                        debugError('❌ Invalid response format:', response);
                    }
                    resolve(null);
                }
            });
        });
    } catch (error) {
        debugError('❌ Error in analyzeContent:', error);
        return null;
    }
}

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Get tweet ID from tweet element
function getTweetId(tweetElement) {
    const articleLink = tweetElement.querySelector('a[href*="/status/"]');
    if (articleLink) {
        const match = articleLink.href.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
    }
    return null;
}

// Check if a tweet is in cache
async function isPostCached(tweetId) {
    if (!tweetId) return false;
    
    const { processedPosts = {} } = await chrome.storage.local.get(['processedPosts']);
    const cachedPost = processedPosts[tweetId];
    
    if (!cachedPost) return false;
    
    // Check if cache has expired
    if (Date.now() - cachedPost.timestamp > CACHE_DURATION) {
        // Remove expired cache entry
        delete processedPosts[tweetId];
        await chrome.storage.local.set({ processedPosts });
        return false;
    }
    
    return true;
}

// Cache a processed tweet
async function cacheProcessedPost(tweetId, scores) {
    if (!tweetId) return;
    
    const { processedPosts = {} } = await chrome.storage.local.get(['processedPosts']);
    
    // Add new tweet to cache with scores
    processedPosts[tweetId] = {
        timestamp: Date.now(),
        scores: scores
    };
    
    // Clean up old entries
    const now = Date.now();
    Object.entries(processedPosts).forEach(([id, data]) => {
        if (now - data.timestamp > CACHE_DURATION) {
            delete processedPosts[id];
        }
    });
    
    await chrome.storage.local.set({ processedPosts });
}

// Process a single tweet
async function processTweet(tweetElement) {
    if (!isExtensionValid()) {
        debugLog('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    const tweetId = getTweetId(tweetElement);
    
    // Skip if we've already processed this tweet in this session
    if (tweetElement.hasAttribute('data-content-processed')) {
        return;
    }

    const text = extractTweetText(tweetElement);
    if (!text) {
        debugLog('⚠️ No text found in tweet, skipping...');
        return;
    }

    // Check for cached scores
    const { processedPosts = {} } = await chrome.storage.local.get(['processedPosts']);
    const cachedPost = processedPosts[tweetId];
    
    let scores;
    if (cachedPost && cachedPost.scores && Date.now() - cachedPost.timestamp <= CACHE_DURATION) {
        debugLog('📦 Using cached scores for tweet:', tweetId);
        scores = cachedPost.scores;
    } else {
        scores = await analyzeContent(text);
        if (scores) {
            await cacheProcessedPost(tweetId, scores);
        }
    }

    if (!scores) return;

    chrome.storage.local.get(['filterSettings', 'blurMode'], async (result) => {
        const filterSettings = result.filterSettings || {
            cynical: true,
            sarcastic: false,
            aggressive: false,
            threatening: false
        };

        const blurMode = result.blurMode || false;

        // Check each filter type
        for (const [filterType, isEnabled] of Object.entries(filterSettings)) {
            if (isEnabled && scores[filterType] > FILTER_THRESHOLDS[filterType]) {
                debugLog(`🚫 Tweet ${blurMode ? 'blurred' : 'hidden'} - ${filterType} score:`, scores[filterType]);
                
                if (blurMode) {
                    tweetElement.classList.add('content-blurred');
                    // Add click handler for revealing blurred content
                    tweetElement.addEventListener('click', function(e) {
                        if (this.classList.contains('content-blurred')) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.classList.add('revealed');
                        }
                    }, true);
                } else {
                    tweetElement.classList.add('content-hidden');
                }
                
                tweetElement.setAttribute('data-filter-type', filterType);
                
                // Store the filtered tweet in storage
                chrome.storage.local.get(['filteredPosts'], (result) => {
                    const filteredPosts = result.filteredPosts || [];
                    const newPost = {
                        text: text,
                        scores: scores,
                        filterType: filterType,
                        url: window.location.href,
                        timestamp: Date.now()
                    };
                    const updatedPosts = [newPost, ...filteredPosts].slice(0, 100);
                    chrome.storage.local.set({ filteredPosts: updatedPosts });
                });
                break;
            }
        }

        // Mark as processed
        tweetElement.setAttribute('data-content-processed', 'true');
    });
}

// Main function to process all tweets
async function processTweets() {
    if (!isExtensionValid()) {
        debugLog('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    if (!isOnXPlatform()) {
        debugLog('⚠️ Not on X.com platform');
        return;
    }

    debugLog('🔍 Scanning for tweets');
    const tweets = document.querySelectorAll(TWEET_SELECTOR);
    debugLog(`📑 Found ${tweets.length} tweets to process`);

    // Process tweets in parallel with Promise.all
    const promises = Array.from(tweets)
        .filter(tweet => !tweet.hasAttribute('data-cynicism-processed'))
        .map(tweet => {
            tweet.setAttribute('data-cynicism-processed', 'true');
            return processTweet(tweet);
        });

    await Promise.all(promises);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Process tweets with reduced debounce delay
const debouncedProcessTweets = debounce(processTweets, 250);

// Observer to watch for new tweets
const observer = new MutationObserver((mutations) => {
    if (!isExtensionValid()) {
        observer.disconnect();
        debugLog('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    // Check if any of the mutations are relevant
    const hasRelevantChanges = mutations.some(mutation => {
        // Check if the mutation target or any added nodes match our tweet selector
        if (mutation.target.matches && mutation.target.matches(TWEET_SELECTOR)) {
            return true;
        }

        // Check added nodes
        if (mutation.addedNodes.length) {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.matches && node.matches(TWEET_SELECTOR)) {
                    return true;
                }
                if (node.querySelector) {
                    return !!node.querySelector(TWEET_SELECTOR);
                }
                return false;
            });
        }

        return false;
    });

    if (hasRelevantChanges) {
        debugLog('👀 New tweets detected, scheduling processing...');
        debouncedProcessTweets();
    }
});

// Start observing with more specific configuration
debugLog('🚀 Starting Cynic Filter...');
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
    characterData: false
});

// Initial processing
processTweets(); 