// Track active tabs and their start times
let activeTabs = {};
let notifiedTabs = new Set(); // Track tabs that have been notified

// Check and reset daily limits
chrome.alarms.create('dailyReset', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    resetDailyLimits();
  }
});

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    console.error('Error parsing URL:', e);
    return null;
  }
}

// Helper function to check if a domain matches a tracked site
function findMatchingSite(domain, trackedSites) {
  // First try exact match
  if (trackedSites[domain]) {
    return domain;
  }
  
  // Then try to find a site that is included in the domain
  for (const site of Object.keys(trackedSites)) {
    if (domain.includes(site)) {
      return site;
    }
  }
  
  return null;
}

// Function to block a site
function blockSite(tabId, site) {
  console.log(`Blocking ${site} for tab ${tabId}`);
  try {
    chrome.tabs.update(parseInt(tabId), {
      url: chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site)
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('Error blocking site:', chrome.runtime.lastError);
      } else {
        console.log(`Successfully blocked ${site} for tab ${tabId}`);
      }
    });
    delete activeTabs[tabId];
    notifiedTabs.delete(tabId);
  } catch (e) {
    console.error('Exception when blocking site:', e);
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const domain = extractDomain(tab.url);
    if (!domain) return;
    
    console.log(`Tab updated: ${tab.url}, domain: ${domain}`);
    
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      console.log('Tracked sites:', Object.keys(sites));
      
      // Check if this domain matches any of our tracked sites
      const matchedSite = findMatchingSite(domain, sites);
      console.log(`Matched site: ${matchedSite}`);
      
      if (matchedSite) {
        console.log(`Site ${matchedSite} is being tracked. Time spent: ${sites[matchedSite].timeSpent}, Limit: ${sites[matchedSite].timeLimit}`);
        
        if (sites[matchedSite].timeSpent >= sites[matchedSite].timeLimit) {
          // Block the site if time limit is reached
          blockSite(tabId, matchedSite);
        } else {
          // Start tracking time for this tab
          activeTabs[tabId] = {
            domain: matchedSite,
            startTime: Date.now()
          };
          console.log(`Started tracking time for ${matchedSite} at ${new Date().toISOString()}`);
        }
      }
    });
  }
});

// Track time spent on sites
setInterval(() => {
  const now = Date.now();
  
  Object.entries(activeTabs).forEach(([tabId, data]) => {
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      
      if (sites[data.domain]) {
        // Calculate time spent in minutes
        const timeSpent = Math.floor((now - data.startTime) / 60000);
        console.log(`Updating time for ${data.domain}: ${timeSpent} minutes spent`);
        
        // Update the stored time
        sites[data.domain].timeSpent = timeSpent;
        
        // Save the updated time
        chrome.storage.sync.set({ sites: sites }, function() {
          // Check if time limit is reached
          if (timeSpent >= sites[data.domain].timeLimit) {
            console.log(`Time limit reached for ${data.domain}: ${timeSpent} >= ${sites[data.domain].timeLimit}`);
            blockSite(parseInt(tabId), data.domain);
          } else {
            // Check for 10% time remaining
            const timeLimit = sites[data.domain].timeLimit;
            const timeLeft = timeLimit - timeSpent;
            const tenPercentTime = timeLimit * 0.1;
            
            if (timeLeft <= tenPercentTime && !notifiedTabs.has(tabId)) {
              console.log(`10% time remaining for ${data.domain}`);
              // Show notification
              chrome.tabs.sendMessage(parseInt(tabId), {
                action: 'timeWarning',
                timeLeft: timeLeft,
                site: data.domain
              });
              notifiedTabs.add(tabId);
            }
          }
        });
      }
    });
  });
}, 1000); // Check every second

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabs[tabId]) {
    console.log(`Tab ${tabId} removed, stopping tracking for ${activeTabs[tabId].domain}`);
    delete activeTabs[tabId];
    notifiedTabs.delete(tabId);
  }
});

// Reset daily limits
function resetDailyLimits() {
  console.log('Resetting daily limits');
  chrome.storage.sync.get(['sites'], function(result) {
    const sites = result.sites || {};
    const today = new Date().toDateString();
    
    Object.keys(sites).forEach(site => {
      if (sites[site].lastReset !== today) {
        sites[site].timeSpent = 0;
        sites[site].lastReset = today;
        console.log(`Reset time for ${site}`);
      }
    });
    
    chrome.storage.sync.set({ sites: sites });
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'siteAdded' || request.action === 'siteDeleted') {
    // Update tracking for the site
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      if (request.action === 'siteAdded') {
        sites[request.site] = {
          timeLimit: request.timeLimit,
          timeSpent: 0,
          lastReset: new Date().toDateString()
        };
        console.log(`Added site: ${request.site} with limit: ${request.timeLimit} minutes`);
      } else if (request.action === 'siteDeleted') {
        delete sites[request.site];
        console.log(`Deleted site: ${request.site}`);
      }
      chrome.storage.sync.set({ sites: sites });
    });
  } else if (request.action === 'getTimeSpent') {
    // Return current time spent for a site
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      const site = request.site;
      
      if (sites[site]) {
        // Calculate additional time from active tabs
        let additionalTime = 0;
        Object.values(activeTabs).forEach(tabData => {
          if (tabData.domain === site) {
            const timeSpent = Math.floor((Date.now() - tabData.startTime) / 60000);
            additionalTime = Math.max(additionalTime, timeSpent);
          }
        });
        
        const totalTimeSpent = sites[site].timeSpent + additionalTime;
        console.log(`Time spent for ${site}: ${totalTimeSpent} minutes (stored: ${sites[site].timeSpent}, active: ${additionalTime})`);
        
        // Return the stored time plus any additional time from active tabs
        sendResponse({ timeSpent: totalTimeSpent });
      } else {
        console.log(`No tracking data for ${site}`);
        sendResponse({ timeSpent: 0 });
      }
    });
    return true; // Required for async response
  }
}); 