document.addEventListener('DOMContentLoaded', async () => {
    const statsCards = document.getElementById('statsCards');
    const postsContainer = document.getElementById('postsContainer');

    // Get filtered posts from storage
    const { filteredPosts = [] } = await chrome.storage.local.get(['filteredPosts']);
    
    // Filter posts from the last 24 hours and ensure they were actually blocked
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentPosts = filteredPosts.filter(post => 
        post.timestamp > last24Hours && 
        post.filterType && // Must have a filter type (meaning it was blocked)
        post.scores && // Must have scores
        Object.entries(post.scores).some(([type, score]) => {
            // Check if the score that triggered the block was actually above threshold
            if (type === post.filterType) {
                return score >= 0.5; // Using the same threshold as in content.js
            }
            return false;
        })
    );

    // Calculate statistics
    const stats = {
        total: recentPosts.length,
        cynical: 0,
        sarcastic: 0,
        threatening: 0,
        politics: 0,
        racism: 0
    };

    // Count posts by type (only counting valid blocks)
    recentPosts.forEach(post => {
        if (post.filterType && post.scores && post.scores[post.filterType] >= 0.5) {
            stats[post.filterType]++;
        }
    });

    // Create stats cards
    Object.entries(stats).forEach(([key, value]) => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-number">${value}</div>
            <div class="stat-label">${key === 'total' ? 'Total Blocked' : `${key} Blocked`}</div>
        `;
        statsCards.appendChild(card);
    });

    // Display posts
    if (recentPosts.length === 0) {
        postsContainer.innerHTML = `
            <div class="no-posts">
                No posts have been blocked in the last 24 hours.
            </div>
        `;
    } else {
        // Sort posts by timestamp, most recent first
        recentPosts.sort((a, b) => b.timestamp - a.timestamp);
        
        recentPosts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'post';
            
            // Format timestamp
            const date = new Date(post.timestamp);
            const timeAgo = getTimeAgo(date);
            
            // Create scores display
            const scoresHtml = Object.entries(post.scores || {})
                .map(([key, value]) => `
                    <div class="score-item">
                        <span>${key}:</span>
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${value * 100}%"></div>
                        </div>
                        <span>${(value * 100).toFixed(0)}%</span>
                    </div>
                `).join('');

            postElement.innerHTML = `
                <div class="post-content">${escapeHtml(post.text)}</div>
                <div class="post-scores">${scoresHtml}</div>
            `;
            
            postsContainer.appendChild(postElement);
        });
    }
});

// Helper function to format time ago
function getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
        second: 1
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'just now';
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
} 