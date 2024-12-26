console.log('=== CYNIC FILTER CONTENT SCRIPT LOADED ===');

// Configuration
const CYNICISM_THRESHOLD = 0.5;

// Add styles to the page
const style = document.createElement('style');
style.textContent = `
    /* Base hiding styles */
    .cynic-hidden {
        display: none !important;
    }
    
    /* Reddit-specific hiding */
    shreddit-comment.cynic-hidden {
        opacity: 0.3 !important;
        pointer-events: none !important;
        filter: blur(3px) !important;
        transition: all 0.2s ease !important;
    }
    
    /* Show styles */
    .cynic-show-filtered .cynic-hidden {
        opacity: 1 !important;
        pointer-events: auto !important;
        filter: none !important;
        border: 2px solid #ff4444 !important;
        padding: 10px !important;
        margin: 10px 0 !important;
        border-radius: 4px !important;
    }
    
    /* Toggle button */
    #cynic-toggle {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        z-index: 10000 !important;
        padding: 10px 20px !important;
        border-radius: 20px !important;
        background: #333 !important;
        color: white !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
        border: none !important;
        cursor: pointer !important;
        font-weight: bold !important;
        transition: all 0.2s ease !important;
    }
    #cynic-toggle:hover {
        transform: scale(1.05) !important;
        background: #444 !important;
    }
`;
document.head.appendChild(style);

// Add toggle button
const toggleButton = document.createElement('button');
toggleButton.id = 'cynic-toggle';
toggleButton.textContent = 'Show Filtered Posts';
toggleButton.style.display = 'none';
document.body.appendChild(toggleButton);

let showFiltered = false;
toggleButton.addEventListener('click', () => {
    showFiltered = !showFiltered;
    toggleButton.textContent = showFiltered ? 'Hide Filtered Posts' : 'Show Filtered Posts';
    document.body.classList.toggle('cynic-show-filtered');
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

// Analyze post for cynicism
async function analyzeCynicism(text) {
    try {
        if (!isExtensionValid()) {
            console.log('🔄 Extension context invalid, reloading page...');
            window.location.reload();
            return 0;
        }

        console.log('🔄 Sending text for analysis:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'analyzeCynicism',
                text: text
            }, (response) => {
                console.log('📥 Received response:', response);
                
                if (response && response.success && typeof response.cynicismScore === 'number') {
                    console.log('📊 Valid cynicism score:', response.cynicismScore);
                    resolve(response.cynicismScore);
                } else {
                    if (response && response.error) {
                        console.error('❌ Analysis error:', response.error);
                    } else {
                        console.error('❌ Invalid response format:', response);
                    }
                    resolve(0);
                }
            });
        });
    } catch (error) {
        console.error('❌ Error in analyzeCynicism:', error);
        return 0;
    }
}

// Process a single post
async function processPost(postElement, platform) {
    if (!isExtensionValid()) {
        console.log('🔄 Extension context invalid, reloading page...');
        window.location.reload();
        return;
    }

    // Skip if we've already processed this post and it's hidden
    if (postElement.hasAttribute('data-cynicism-processed') && postElement.classList.contains('cynic-hidden')) {
        return;
    }

    const text = extractPostText(postElement, platform);
    if (!text) {
        console.log('⚠️ No text found in post, skipping...');
        return;
    }

    const cynicismScore = await analyzeCynicism(text);
    
    if (cynicismScore > CYNICISM_THRESHOLD) {
        console.log('🚫 Post hidden - score:', cynicismScore);
        postElement.classList.add('cynic-hidden');
        toggleButton.style.display = 'block';
        
        // Store the cynicism state in the element
        postElement.setAttribute('data-cynicism-score', cynicismScore);
    }
    
    // Mark as processed
    postElement.setAttribute('data-cynicism-processed', 'true');
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