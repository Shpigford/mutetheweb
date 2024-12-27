document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Popup initialized');
    const apiKeyInput = document.getElementById('apiKey');
    const enabledToggle = document.getElementById('enabled');
    const statusDiv = document.getElementById('status');
    const filteredCountDiv = document.getElementById('filteredCount');
    const showFilteredButton = document.getElementById('showFiltered');
    const blurModeToggle = document.getElementById('blur-mode');
    const debugToggle = document.getElementById('debug-mode');
    let isDebugMode = false;

    // Filter toggles
    const filterToggles = {
        cynical: document.getElementById('filter-cynical'),
        sarcastic: document.getElementById('filter-sarcastic'),
        threatening: document.getElementById('filter-threatening'),
        politics: document.getElementById('filter-politics'),
        racism: document.getElementById('filter-racism')
    };

    // Override console methods for debug mode
    const originalConsole = {
        log: console.log,
        error: console.error
    };

    function updateConsoleLogging(debugEnabled) {
        if (debugEnabled) {
            console.log = originalConsole.log;
            console.error = originalConsole.error;
        } else {
            console.log = () => {};
            console.error = () => {};
        }
    }

    // Load debug mode setting
    chrome.storage.local.get(['debugMode'], (result) => {
        isDebugMode = result.debugMode || false;
        debugToggle.checked = isDebugMode;
        updateConsoleLogging(isDebugMode);
    });

    // Debug mode toggle handler
    debugToggle.addEventListener('change', () => {
        isDebugMode = debugToggle.checked;
        chrome.storage.local.set({ debugMode: isDebugMode }, () => {
            updateConsoleLogging(isDebugMode);
            showStatus(`Debug mode ${isDebugMode ? 'enabled' : 'disabled'}!`, 'success');
            
            // Notify content scripts of the debug mode change
            chrome.tabs.query({}, function(tabs) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: 'updateDebugMode',
                        debugMode: isDebugMode
                    }).catch(() => {
                        // Ignore errors for inactive tabs
                    });
                });
            });
        });
    });

    // Load saved settings and filtered count
    chrome.storage.local.get(['apiKey', 'isEnabled', 'filteredPosts', 'filterSettings', 'blurMode', 'processedPosts'], (result) => {
        console.log('📥 Loading saved settings:', { 
            hasApiKey: !!result.apiKey,
            isEnabled: result.isEnabled,
            blurMode: result.blurMode,
            cachedPostsCount: Object.keys(result.processedPosts || {}).length
        });
        
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (typeof result.isEnabled !== 'undefined') {
            enabledToggle.checked = result.isEnabled;
        }
        if (typeof result.blurMode !== 'undefined') {
            blurModeToggle.checked = result.blurMode;
        }

        // Load filter settings
        const filterSettings = result.filterSettings || {
            cynical: true,
            sarcastic: false,
            threatening: false,
            politics: false,
            racism: false
        };

        // Apply saved filter settings
        Object.entries(filterSettings).forEach(([key, value]) => {
            if (filterToggles[key]) {
                filterToggles[key].checked = value;
            }
        });
        
        // Update stats
        const filteredCount = result.filteredPosts?.length || 0;
        const cachedCount = Object.keys(result.processedPosts || {}).length;
        filteredCountDiv.textContent = `${filteredCount} (${cachedCount} cached)`;
        showFilteredButton.style.display = filteredCount > 0 ? 'block' : 'none';
    });

    // Save filter settings when changed
    Object.entries(filterToggles).forEach(([key, toggle]) => {
        toggle.addEventListener('change', () => {
            chrome.storage.local.get(['filterSettings'], (result) => {
                const currentSettings = result.filterSettings || {};
                const newSettings = {
                    ...currentSettings,
                    [key]: toggle.checked
                };

                chrome.storage.local.set({ filterSettings: newSettings }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Error saving filter settings:', chrome.runtime.lastError);
                        showStatus('Error saving filter settings!', 'error');
                    } else {
                        console.log('✅ Filter settings saved:', newSettings);
                        showStatus(`${key} filter ${toggle.checked ? 'enabled' : 'disabled'}!`, 'success');
                    }
                });
            });
        });
    });

    // Show filtered posts
    showFilteredButton.addEventListener('click', async () => {
        console.log('🔍 Showing filtered posts');
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to content script to show filtered posts
        chrome.tabs.sendMessage(tab.id, { action: 'showFilteredPosts' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Error showing filtered posts:', chrome.runtime.lastError);
                showStatus('Error showing filtered posts!', 'error');
            } else {
                console.log('✅ Showing filtered posts');
                showStatus('Showing filtered posts!', 'success');
            }
        });
    });

    // Save API key when changed
    apiKeyInput.addEventListener('input', () => {
        const apiKey = apiKeyInput.value.trim();
        console.log('💾 Saving API key:', apiKey ? '(key provided)' : '(empty)');
        
        chrome.storage.local.set({ apiKey }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Error saving API key:', chrome.runtime.lastError);
                showStatus('Error saving API key!', 'error');
            } else {
                console.log('✅ API key saved successfully');
                showStatus('API key saved!', 'success');
            }
        });
    });

    // Toggle extension
    enabledToggle.addEventListener('change', () => {
        const isEnabled = enabledToggle.checked;
        console.log('🔄 Toggling extension:', isEnabled ? 'enabled' : 'disabled');
        
        chrome.storage.local.set({ isEnabled }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Error saving toggle state:', chrome.runtime.lastError);
                showStatus('Error saving settings!', 'error');
            } else {
                console.log('✅ Toggle state saved successfully');
                showStatus(
                    isEnabled ? 'Filter enabled!' : 'Filter disabled!',
                    'success'
                );
            }
        });
    });

    // Save blur mode setting when changed
    blurModeToggle.addEventListener('change', () => {
        chrome.storage.local.set({ blurMode: blurModeToggle.checked }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Error saving blur mode setting:', chrome.runtime.lastError);
                showStatus('Error saving blur mode setting!', 'error');
            } else {
                console.log('✅ Blur mode setting saved:', blurModeToggle.checked);
                showStatus(`Blur mode ${blurModeToggle.checked ? 'enabled' : 'disabled'}!`, 'success');
                
                // Notify content script of the change
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { 
                            action: 'updateBlurMode',
                            blurMode: blurModeToggle.checked
                        });
                    }
                });
            }
        });
    });

    // Helper function to show status messages
    function showStatus(message, type) {
        console.log(`📢 Status message (${type}):`, message);
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    // Clear cache function
    function clearCache() {
        chrome.storage.local.set({ processedPosts: {} }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Error clearing cache:', chrome.runtime.lastError);
                showStatus('Error clearing cache!', 'error');
            } else {
                console.log('✅ Cache cleared');
                showStatus('Cache cleared!', 'success');
                // Update stats
                chrome.storage.local.get(['filteredPosts', 'processedPosts'], (result) => {
                    const filteredCount = result.filteredPosts?.length || 0;
                    const cachedCount = Object.keys(result.processedPosts || {}).length;
                    filteredCountDiv.textContent = `${filteredCount} (${cachedCount} cached)`;
                });
            }
        });
    }

    // Add clear cache button event listener
    const clearCacheButton = document.getElementById('clearCache');
    if (clearCacheButton) {
        clearCacheButton.addEventListener('click', clearCache);
    }

    // Add view stats button event listener
    const viewStatsButton = document.getElementById('viewStats');
    if (viewStatsButton) {
        viewStatsButton.addEventListener('click', () => {
            chrome.tabs.create({ url: 'stats.html' });
        });
    }
}); 