// parser.js

const osPatterns = [
    // Fixed: Added specific devices and tokens for iOS/Apple TV/HomePod
    // Checking 'ios', 'darwin', 'cfnetwork' helps catch non-standard apps.
    // Order matters: 'iphone' etc. are specific. 'darwin' is a fallback for this dataset.
    { regex: /iphone|ipad|ipod|tvos|appletv|apple\s*tv|homepod|ios|darwin|cfnetwork/i, name: 'ios' },
    // Fixed: Added winnt, win95, win98 for older Windows support
    { regex: /windows|winnt|win95|win98/i, name: 'windows' },
    // Fixed: Added mac_powerpc
    { regex: /macintosh|mac os x|mac_powerpc/i, name: 'mac os' },
    { regex: /cros/i, name: 'chromium os' },
    { regex: /ubuntu/i, name: 'ubuntu' },
    { regex: /android/i, name: 'android' },
    { regex: /linux/i, name: 'linux' }
  ];
  
  const browserPatterns = [
    // --- Specific In-App / Niche Browsers (Check these first) ---
    { regex: /fban|fbav/i, name: 'facebook' },
    { regex: /instagram/i, name: 'instagram' },
    { regex: /gsa/i, name: 'gsa' },
    { regex: /samsungbrowser/i, name: 'samsung browser' },
    { regex: /miuibrowser/i, name: 'miui browser' },
    { regex: /whale/i, name: 'whale' },
    { regex: /silk/i, name: 'silk' },
    // Fixed: Added ubrowser and ucweb
    { regex: /ucbrowser|ubrowser|ucweb/i, name: 'ucbrowser' },
    // Fixed: Added yaapp and yowser
    { regex: /yabrowser|yowser|yaapp/i, name: 'yandex' },
    { regex: /avast/i, name: 'avast secure browser' },
    { regex: /avg/i, name: 'avg secure browser' },
    { regex: /opr|opera/i, name: 'opera' },
    { regex: /edg/i, name: 'edge' },
    { regex: /firefox|fxios/i, name: 'firefox' },
    
    // --- Chrome & Variants ---
    { regex: /chrome.+wv|wv.+chrome/i, name: 'chrome webview' },
    
    // --- Android Browser (Legacy/Stock) ---
    // Fixed: Moved ABOVE Chrome. 
    // We use a stricter regex (Android + Version/) to distinguish it from Chrome or generic WebViews.
    { regex: /android.+version\/[\d.]+/i, name: 'android browser' },
  
    // --- Chrome (Generic) ---
    // Fixed: Added crmo for old mobile chrome
    { regex: /chrome|crios|crmo/i, name: 'chrome' },
  
    // --- Safari & Fallbacks ---
    { regex: /safari.*mobile|mobile.*safari/i, name: 'mobile safari' },
    { regex: /safari/i, name: 'safari' },
    { regex: /applewebkit/i, name: 'webkit' }
  ];
  
  /**
   * Parses a user agent string to extract the OS and Browser.
   * Only detects high-volume items (count >= 100).
   *
   * @param {string} userAgent
   * @returns {{ operatingSystem: string|null, browser: string|null }}
   */
  export const parseUserAgent = (userAgent) => {
    if (!userAgent) {
      return { operatingSystem: null, browser: null };
    }
  
    const uaString = String(userAgent);
    
    let operatingSystem = null;
    // Detect OS
    for (const { regex, name } of osPatterns) {
      if (regex.test(uaString)) {
        operatingSystem = name;
        break;
      }
    }
  
    let browser = null;
    // Detect Browser
    for (const { regex, name } of browserPatterns) {
      if (regex.test(uaString)) {
        // Special logic: The 'android browser' regex is now stricter, 
        // but if we matched it, we still want to ensure we don't accidentally 
        // label Chrome as "Android Browser" if the order was somehow mixed up.
        // (Though with 'chrome' checked earlier, this is safer now).
        if (name === 'android browser' && /chrome|crios|crmo/i.test(uaString)) {
           // However, in this dataset, Android Browser OFTEN has "Chrome/" in the string.
           // So we DO NOT skip if it matches the specific "Version/" pattern.
           // We only skip if it matched the *fallback* "android" regex (which I removed in favor of the strict one).
           // So this check is actually redundant/harmful with the new strict regex.
           // I will keep it simple: if it matched the strict regex, it IS Android Browser.
           browser = name;
           break;
        }
        
        browser = name;
        break;
      }
    }
  
    return { operatingSystem, browser };
  };