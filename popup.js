document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Popup initialized');
    const apiKeyInput = document.getElementById('apiKey');
    const enabledToggle = document.getElementById('enabled');
    const statusDiv = document.getElementById('status');
    const filteredCountDiv = document.getElementById('filteredCount');
    const showFilteredButton = document.getElementById('showFiltered');

    // Filter toggles
    const filterToggles = {
        cynical: document.getElementById('filter-cynical'),
        sarcastic: document.getElementById('filter-sarcastic'),
        aggressive: document.getElementById('filter-aggressive'),
        threatening: document.getElementById('filter-threatening')
    };

    // Load saved settings and filtered count
    chrome.storage.local.get(['apiKey', 'isEnabled', 'filteredPosts', 'filterSettings'], (result) => {
        console.log('📥 Loading saved settings:', { 
            hasApiKey: !!result.apiKey,
            isEnabled: result.isEnabled 
        });
        
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (typeof result.isEnabled !== 'undefined') {
            enabledToggle.checked = result.isEnabled;
        }

        // Load filter settings
        const filterSettings = result.filterSettings || {
            cynical: true,
            sarcastic: false,
            aggressive: false,
            threatening: false
        };

        // Apply saved filter settings
        Object.entries(filterSettings).forEach(([key, value]) => {
            if (filterToggles[key]) {
                filterToggles[key].checked = value;
            }
        });
        
        // Update filtered posts count
        const filteredCount = result.filteredPosts?.length || 0;
        filteredCountDiv.textContent = filteredCount;
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
}); 