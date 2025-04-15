// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'timeWarning') {
    // Create and show the warning notification
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #f39c12;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
      animation: slideIn 0.5s ease-out;
    `;
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    // Format time remaining
    const minutes = Math.floor(request.timeLeft);
    const seconds = Math.floor((request.timeLeft % 1) * 60);
    const timeDisplay = minutes > 0 
      ? `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`
      : `${seconds} second${seconds !== 1 ? 's' : ''}`;
    
    warningDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">Time Warning</div>
      <div>You have ${timeDisplay} remaining on ${request.site}</div>
    `;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0 5px;
    `;
    closeButton.onclick = () => warningDiv.remove();
    warningDiv.appendChild(closeButton);
    
    // Add to page
    document.body.appendChild(warningDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (warningDiv.parentNode) {
        warningDiv.style.animation = 'slideOut 0.5s ease-in';
        setTimeout(() => warningDiv.remove(), 500);
      }
    }, 10000);
  }
}); 