document.addEventListener('DOMContentLoaded', function() {
  const siteInput = document.getElementById('siteInput');
  const timeInput = document.getElementById('timeInput');
  const addButton = document.getElementById('addSite');
  const refreshButton = document.getElementById('refreshBtn');
  const siteList = document.getElementById('siteList');

  // Load existing sites
  loadSites();
  
  // Start timer to update remaining time
  setInterval(updateTimers, 1000);

  addButton.addEventListener('click', function() {
    const site = siteInput.value.trim();
    const time = parseInt(timeInput.value);

    if (site && time > 0) {
      // Remove http://, https://, and www. from the site
      const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '');
      addSite(cleanSite, time);
      siteInput.value = '';
      timeInput.value = '';
    }
  });
  
  refreshButton.addEventListener('click', function() {
    // Force reload all sites and their times
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      // Update each site's time from active tabs
      Object.keys(sites).forEach(site => {
        chrome.runtime.sendMessage({ action: 'getTimeSpent', site: site }, function(response) {
          if (response && response.timeSpent !== undefined) {
            sites[site].timeSpent = response.timeSpent;
          }
        });
      });
      // Save updated times and reload display
      chrome.storage.sync.set({ sites: sites }, function() {
        loadSites();
      });
    });
  });

  function addSite(site, timeLimit) {
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      sites[site] = {
        timeLimit: timeLimit,
        timeSpent: 0,
        lastReset: new Date().toDateString()
      };
      
      chrome.storage.sync.set({ sites: sites }, function() {
        loadSites();
        // Notify background script about the new site
        chrome.runtime.sendMessage({
          action: 'siteAdded',
          site: site,
          timeLimit: timeLimit
        });
      });
    });
  }

  function loadSites() {
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      siteList.innerHTML = '';
      
      if (Object.keys(sites).length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No sites added yet. Add a site to start tracking.';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.color = '#666';
        siteList.appendChild(emptyMessage);
        return;
      }
      
      Object.entries(sites).forEach(([site, data]) => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        
        const siteInfo = document.createElement('span');
        siteInfo.className = 'site-info';
        siteInfo.textContent = site;
        
        const timerSpan = document.createElement('span');
        timerSpan.className = 'timer';
        timerSpan.dataset.site = site;
        timerSpan.dataset.timeLimit = data.timeLimit;
        timerSpan.dataset.timeSpent = data.timeSpent;
        updateTimerDisplay(timerSpan);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function() {
          deleteSite(site);
        };
        
        siteItem.appendChild(siteInfo);
        siteItem.appendChild(timerSpan);
        siteItem.appendChild(deleteButton);
        siteList.appendChild(siteItem);
      });
    });
  }
  
  function updateTimers() {
    const timers = document.querySelectorAll('.timer');
    timers.forEach(updateTimerDisplay);
  }
  
  function updateTimerDisplay(timerElement) {
    const site = timerElement.dataset.site;
    const timeLimit = parseInt(timerElement.dataset.timeLimit);
    
    // Get current time spent from background script
    chrome.runtime.sendMessage({ action: 'getTimeSpent', site: site }, function(response) {
      if (response && response.timeSpent !== undefined) {
        timerElement.dataset.timeSpent = response.timeSpent;
        const timeLeft = Math.max(0, timeLimit - response.timeSpent);
        
        // Format time as HH:MM:SS
        const hours = Math.floor(timeLeft / 60);
        const minutes = Math.floor(timeLeft % 60);
        const seconds = Math.floor((timeLeft % 1) * 60);
        
        let timeDisplay = '';
        if (hours > 0) {
          timeDisplay = `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
          timeDisplay = `${minutes}m ${seconds}s`;
        } else {
          timeDisplay = `${seconds}s`;
        }
        
        timerElement.textContent = `(${timeDisplay} left)`;
        
        // Change color based on remaining time
        if (timeLeft < 5) {
          timerElement.style.color = '#e74c3c'; // Red for less than 5 minutes
        } else if (timeLeft < 15) {
          timerElement.style.color = '#f39c12'; // Orange for less than 15 minutes
        } else {
          timerElement.style.color = '#2ecc71'; // Green for more than 15 minutes
        }
      }
    });
  }

  function deleteSite(site) {
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      delete sites[site];
      
      chrome.storage.sync.set({ sites: sites }, function() {
        loadSites();
        // Notify background script about the deleted site
        chrome.runtime.sendMessage({
          action: 'siteDeleted',
          site: site
        });
      });
    });
  }
}); 