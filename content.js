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
    } else if (message.action === 'updateBlurMode') {
        // Update existing filtered posts when blur mode changes
        const filteredPosts = document.querySelectorAll('.content-hidden, .content-blurred');
        filteredPosts.forEach(post => {
            if (message.blurMode) {
                post.classList.remove('content-hidden');
                post.classList.add('content-blurred');
                // Add click handler
                post.addEventListener('click', function(e) {
                    if (this.classList.contains('content-blurred')) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.classList.add('revealed');
                    }
                }, true);
            } else {
                post.classList.remove('content-blurred', 'revealed');
                post.classList.add('content-hidden');
            }
        });
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

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Get post ID based on platform
function getPostId(postElement, platform) {
    if (platform === 'x') {
        // For Twitter/X, try to get the tweet ID from the article
        const articleLink = postElement.querySelector('a[href*="/status/"]');
        if (articleLink) {
            const match = articleLink.href.match(/\/status\/(\d+)/);
            return match ? match[1] : null;
        }
    } else if (platform === 'reddit') {
        // For Reddit, use the comment ID
        return postElement.id;
    }
    return null;
}

// Check if a post is in cache
async function isPostCached(postId) {
    if (!postId) return false;
    
    const { processedPosts = {} } = await chrome.storage.local.get(['processedPosts']);
    const cachedPost = processedPosts[postId];
    
    if (!cachedPost) return false;
    
    // Check if cache has expired
    if (Date.now() - cachedPost.timestamp > CACHE_DURATION) {
        // Remove expired cache entry
        delete processedPosts[postId];
        await chrome.storage.local.set({ processedPosts });
        return false;
    }
    
    return true;
}

// Cache a processed post
async function cacheProcessedPost(postId) {
    if (!postId) return;
    
    const { processedPosts = {} } = await chrome.storage.local.get(['processedPosts']);
    
    // Add new post to cache
    processedPosts[postId] = {
        timestamp: Date.now()
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

// Process a single post
async function processPost(postElement, platform) {
    if (!isExtensionValid()) {
        console.log('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    const postId = getPostId(postElement, platform);
    
    // Skip if post is already in cache
    if (await isPostCached(postId)) {
        console.log('📦 Post found in cache, skipping analysis:', postId);
        return;
    }

    // Skip if we've already processed this post in this session
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
                console.log(`🚫 Post ${blurMode ? 'blurred' : 'hidden'} - ${filterType} score:`, scores[filterType]);
                
                if (blurMode) {
                    postElement.classList.add('content-blurred');
                    // Add click handler for revealing blurred content
                    postElement.addEventListener('click', function(e) {
                        if (this.classList.contains('content-blurred')) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.classList.add('revealed');
                        }
                    }, true);
                } else {
                    postElement.classList.add('content-hidden');
                }
                
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

        // Cache the processed post
        await cacheProcessedPost(postId);
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