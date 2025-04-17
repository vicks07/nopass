// Track active tabs and their start times
let activeTabs = {};
let notifiedTabs = new Set(); // Track tabs that have been notified
let currentActiveTabId = null; // Track the currently active tab

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
        // Check if we need to reset the time for this site
        const today = new Date().toDateString();
        if (sites[matchedSite].lastReset !== today) {
          console.log(`Resetting time for ${matchedSite} as it's a new day`);
          sites[matchedSite].timeSpent = 0;
          sites[matchedSite].lastReset = today;
          chrome.storage.sync.set({ sites: sites });
        }
        
        console.log(`Site ${matchedSite} is being tracked. Time spent: ${sites[matchedSite].timeSpent}, Limit: ${sites[matchedSite].timeLimit}`);
        
        if (sites[matchedSite].timeSpent >= sites[matchedSite].timeLimit) {
          // Block the site if time limit is reached
          blockSite(tabId, matchedSite);
        } else {
          // Only start tracking if not already tracking this tab
          if (!activeTabs[tabId]) {
            activeTabs[tabId] = {
              domain: matchedSite,
              startTime: Date.now(),
              lastUpdate: Date.now(),
              isActive: false // Initialize as inactive
            };
            console.log(`Started tracking time for ${matchedSite} at ${new Date().toISOString()}`);
          }
        }
      }
    });
  }
});

// Track tab activation changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  currentActiveTabId = tabId;
  
  // Mark the newly activated tab as active
  if (activeTabs[tabId]) {
    console.log(`Tab ${tabId} activated, marking as active`);
    activeTabs[tabId].isActive = true;
    activeTabs[tabId].lastUpdate = Date.now(); // Reset last update time
  }
  
  // Mark all other tabs as inactive
  Object.keys(activeTabs).forEach(id => {
    if (id != tabId && activeTabs[id].isActive) {
      console.log(`Tab ${id} deactivated, marking as inactive`);
      activeTabs[id].isActive = false;
      
      // Update the time spent for the deactivated tab
      updateTimeForTab(id);
    }
  });
});

// Function to update time for a specific tab
function updateTimeForTab(tabId) {
  if (!activeTabs[tabId]) return;
  
  const data = activeTabs[tabId];
  const now = Date.now();
  const timeSpentSinceLastUpdate = Math.floor((now - data.lastUpdate) / 60000);
  
  if (timeSpentSinceLastUpdate > 0 && data.isActive) {
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      
      if (sites[data.domain]) {
        const newTimeSpent = sites[data.domain].timeSpent + timeSpentSinceLastUpdate;
        console.log(`Updating time for ${data.domain}: ${newTimeSpent} minutes total (added ${timeSpentSinceLastUpdate} minutes)`);
        
        sites[data.domain].timeSpent = newTimeSpent;
        chrome.storage.sync.set({ sites: sites });
      }
    });
  }
  
  // Update the last update time
  activeTabs[tabId].lastUpdate = now;
}

// Track time spent on sites
setInterval(() => {
  const now = Date.now();
  const today = new Date().toDateString();
  
  // Only process the currently active tab
  if (currentActiveTabId && activeTabs[currentActiveTabId] && activeTabs[currentActiveTabId].isActive) {
    const tabId = currentActiveTabId;
    const data = activeTabs[tabId];
    
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      
      if (sites[data.domain]) {
        // Check if we need to reset for a new day
        if (sites[data.domain].lastReset !== today) {
          console.log(`Resetting time for ${data.domain} as it's a new day`);
          sites[data.domain].timeSpent = 0;
          sites[data.domain].lastReset = today;
          data.lastUpdate = now; // Reset the last update time as well
        }
        
        // Calculate time spent since last update in minutes
        const timeSpentSinceLastUpdate = Math.floor((now - data.lastUpdate) / 60000);
        
        if (timeSpentSinceLastUpdate > 0) {
          // Update the stored time by adding the new time spent
          const newTimeSpent = sites[data.domain].timeSpent + timeSpentSinceLastUpdate;
          console.log(`Updating time for ${data.domain}: ${newTimeSpent} minutes total (added ${timeSpentSinceLastUpdate} minutes)`);
          
          // Update the stored time
          sites[data.domain].timeSpent = newTimeSpent;
          data.lastUpdate = now;
          
          // Save the updated time
          chrome.storage.sync.set({ sites: sites }, function() {
            // Check if time limit is reached
            if (newTimeSpent >= sites[data.domain].timeLimit) {
              console.log(`Time limit reached for ${data.domain}: ${newTimeSpent} >= ${sites[data.domain].timeLimit}`);
              blockSite(parseInt(tabId), data.domain);
            } else {
              // Check for 10% time remaining
              const timeLimit = sites[data.domain].timeLimit;
              const timeLeft = timeLimit - newTimeSpent;
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
      }
    });
  }
}, 1000); // Check every second

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabs[tabId]) {
    // Update time for the removed tab before removing it
    updateTimeForTab(tabId);
    
    console.log(`Tab ${tabId} removed, stopping tracking for ${activeTabs[tabId].domain}`);
    delete activeTabs[tabId];
    notifiedTabs.delete(tabId);
    
    // If the removed tab was the active tab, clear the current active tab
    if (tabId === currentActiveTabId) {
      currentActiveTabId = null;
    }
  }
});

// Reset daily limits
function resetDailyLimits() {
  console.log('Resetting daily limits');
  const today = new Date().toDateString();
  
  chrome.storage.sync.get(['sites'], function(result) {
    const sites = result.sites || {};
    let needsUpdate = false;
    
    Object.keys(sites).forEach(site => {
      if (sites[site].lastReset !== today) {
        console.log(`Resetting time for ${site} (old reset: ${sites[site].lastReset}, new reset: ${today})`);
        sites[site].timeSpent = 0;
        sites[site].lastReset = today;
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      chrome.storage.sync.set({ sites: sites }, function() {
        console.log('Daily limits reset complete');
      });
    }
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
        // Clean up any active tabs tracking this site
        Object.entries(activeTabs).forEach(([tabId, data]) => {
          if (data.domain === request.site) {
            console.log(`Removing tracking for deleted site ${request.site} from tab ${tabId}`);
            delete activeTabs[tabId];
            notifiedTabs.delete(tabId);
          }
        });
        
        // Remove the site from storage
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
      const today = new Date().toDateString();
      
      if (sites[site]) {
        // Check if we need to reset for a new day
        if (sites[site].lastReset !== today) {
          console.log(`Resetting time for ${site} as it's a new day`);
          sites[site].timeSpent = 0;
          sites[site].lastReset = today;
          chrome.storage.sync.set({ sites: sites });
        }
        
        // Calculate additional time from active tabs
        let additionalTime = 0;
        Object.values(activeTabs).forEach(tabData => {
          if (tabData.domain === site && tabData.isActive) {
            const timeSpent = Math.floor((Date.now() - tabData.lastUpdate) / 60000);
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