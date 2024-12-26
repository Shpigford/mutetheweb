console.log('=== CYNIC FILTER CONTENT SCRIPT LOADED ===');

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
    
    /* Reddit-specific hiding */
    shreddit-comment.content-hidden {
        opacity: 0.3 !important;
        pointer-events: none !important;
        filter: blur(3px) !important;
        transition: all 0.2s ease !important;
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
    }
});

// Selectors for different platforms
const SELECTORS = {
    x: {
        posts: 'article[data-testid="tweet"]',
        text: '[data-testid="tweetText"]'
    },
    reddit: {
        posts: 'shreddit-comment',
        text: '[id$="-comment-rtjson-content"] [id="-post-rtjson-content"]'
    }
};

// Get the current platform
function getCurrentPlatform() {
    if (window.location.hostname.includes('x.com')) return 'x';
    if (window.location.hostname.includes('reddit.com')) return 'reddit';
    return null;
}

// Extract text from a post element
function extractPostText(postElement, platform) {
    const textElement = postElement.querySelector(SELECTORS[platform].text);
    const text = textElement ? textElement.textContent.trim() : '';
    if (text) {
        console.log('📝 Found post text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
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
            console.log('🔄 Extension context invalid, reloading page...');
            window.location.reload();
            return null;
        }

        console.log('🔄 Sending text for analysis:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'analyzeContent',
                text: text
            }, (response) => {
                console.log('📥 Received response:', response);
                
                if (response && response.success) {
                    console.log('📊 Valid analysis scores:', response.scores);
                    resolve(response.scores);
                } else {
                    if (response && response.error) {
                        console.error('❌ Analysis error:', response.error);
                    } else {
                        console.error('❌ Invalid response format:', response);
                    }
                    resolve(null);
                }
            });
        });
    } catch (error) {
        console.error('❌ Error in analyzeContent:', error);
        return null;
    }
}

// Process a single post
async function processPost(postElement, platform) {
    if (!isExtensionValid()) {
        console.log('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    // Skip if we've already processed this post
    if (postElement.hasAttribute('data-content-processed')) {
        return;
    }

    const text = extractPostText(postElement, platform);
    if (!text) {
        console.log('⚠️ No text found in post, skipping...');
        return;
    }

    const scores = await analyzeContent(text);
    if (!scores) return;

    // Get current filter settings
    chrome.storage.local.get(['filterSettings'], async (result) => {
        const filterSettings = result.filterSettings || {
            cynical: true,
            sarcastic: false,
            aggressive: false,
            threatening: false
        };

        // Check each filter type
        for (const [filterType, isEnabled] of Object.entries(filterSettings)) {
            if (isEnabled && scores[filterType] > FILTER_THRESHOLDS[filterType]) {
                console.log(`🚫 Post hidden - ${filterType} score:`, scores[filterType]);
                postElement.classList.add('content-hidden');
                postElement.setAttribute('data-filter-type', filterType);
                
                // Store the filtered post in storage
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
                
                break; // Stop after first matching filter
            }
        }
    });
    
    // Mark as processed
    postElement.setAttribute('data-content-processed', 'true');
}

// Main function to process all posts
async function processPosts() {
    if (!isExtensionValid()) {
        console.log('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    const platform = getCurrentPlatform();
    if (!platform) {
        console.log('⚠️ Not on a supported platform');
        return;
    }

    console.log('🔍 Scanning for posts on platform:', platform);
    const posts = document.querySelectorAll(SELECTORS[platform].posts);
    console.log(`📑 Found ${posts.length} posts to process`);

    for (const post of posts) {
        if (!post.hasAttribute('data-cynicism-processed')) {
            post.setAttribute('data-cynicism-processed', 'true');
            await processPost(post, platform);
        }
    }
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

// Process posts with debouncing
const debouncedProcessPosts = debounce(processPosts, 1000);

// Observer to watch for new posts
const observer = new MutationObserver((mutations) => {
    if (!isExtensionValid()) {
        observer.disconnect();
        console.log('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    // Check if any of the mutations are relevant
    const hasRelevantChanges = mutations.some(mutation => {
        // Check if the mutation target or any added nodes match our selectors
        const platform = getCurrentPlatform();
        if (!platform) return false;

        // Check the mutation target
        if (mutation.target.matches && mutation.target.matches(SELECTORS[platform].posts)) {
            return true;
        }

        // Check added nodes
        if (mutation.addedNodes.length) {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.matches && node.matches(SELECTORS[platform].posts)) {
                    return true;
                }
                if (node.querySelector) {
                    return !!node.querySelector(SELECTORS[platform].posts);
                }
                return false;
            });
        }

        return false;
    });

    if (hasRelevantChanges) {
        console.log('👀 Relevant DOM changes detected, scheduling post processing...');
        debouncedProcessPosts();
    }
});

// Start observing with more specific configuration
console.log('🚀 Starting Cynic Filter...');
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true, // Enable attribute monitoring
    attributeFilter: ['style', 'class'], // Only watch for style and class changes
    characterData: false
});

// Initial processing
processPosts(); 