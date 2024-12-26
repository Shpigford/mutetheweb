document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Popup initialized');
    const apiKeyInput = document.getElementById('apiKey');
    const enabledToggle = document.getElementById('enabled');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    chrome.storage.local.get(['apiKey', 'isEnabled'], (result) => {
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