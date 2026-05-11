var CAPABILITY_SCORE_CACHE_KEY = 'capability_score_me';

function clearTryToolMeDataCache(callback) {
  chrome.storage.local.get(null, function (all) {
    if (chrome.runtime.lastError) {
      callback(null, chrome.runtime.lastError.message || 'Storage error');
      return;
    }
    var keys = Object.keys(all || {}).filter(function (k) {
      return k.startsWith('room_dates_') || k.startsWith('profile_public_') || k.startsWith('profile_yearly_');
    });
    if (!keys.length) {
      callback(0);
      return;
    }
    chrome.storage.local.remove(keys, function () {
      if (chrome.runtime.lastError) {
        callback(null, chrome.runtime.lastError.message || 'Storage error');
        return;
      }
      callback(keys.length);
    });
  });
}

function clearCapabilityScoreCache(callback) {
  chrome.storage.local.remove([CAPABILITY_SCORE_CACHE_KEY], function () {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message || 'Storage error');
      return;
    }
    callback(null);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const cacheDurationInput = document.getElementById('cache-duration');
  const cacheCapabilityHoursInput = document.getElementById('cache-capability-hours');
  const saveButton = document.getElementById('save-button');
  const clearCacheButton = document.getElementById('clear-cache-button');
  const clearCapabilityCacheButton = document.getElementById('clear-capability-cache-button');
  const statusMessage = document.getElementById('status-message');

  chrome.storage.local.get(['cacheDurationDays', 'cacheCapabilityScoreHours'], (result) => {
    if (cacheDurationInput) {
      cacheDurationInput.value = result.cacheDurationDays != null ? result.cacheDurationDays : 1;
    }
    if (cacheCapabilityHoursInput) {
      cacheCapabilityHoursInput.value = result.cacheCapabilityScoreHours != null ? result.cacheCapabilityScoreHours : 24;
    }
  });

  if (cacheCapabilityHoursInput) {
    cacheCapabilityHoursInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 2) v = v.slice(0, 2);
      e.target.value = v;
    });
  }

  saveButton.addEventListener('click', () => {
    const days = parseInt(cacheDurationInput.value, 10);
    const hours = parseInt(cacheCapabilityHoursInput && cacheCapabilityHoursInput.value, 10);

    if (isNaN(days) || days < 1 || days > 7) {
      statusMessage.textContent = 'Room/profile cache: enter a number between 1 and 7 (days).';
      statusMessage.className = 'status-message error';
      return;
    }
    if (isNaN(hours) || hours < 1 || hours > 72) {
      statusMessage.textContent = 'Capability score cache: enter a number between 1 and 72 (hours).';
      statusMessage.className = 'status-message error';
      return;
    }

    chrome.storage.local.set({ cacheDurationDays: days, cacheCapabilityScoreHours: hours }, () => {
      statusMessage.textContent = 'Settings saved successfully!';
      statusMessage.className = 'status-message success';

      setTimeout(() => {
        statusMessage.className = 'status-message';
      }, 3000);
    });
  });

  if (clearCacheButton) {
    clearCacheButton.addEventListener('click', () => {
      clearTryToolMeDataCache(function (n, err) {
        if (err) {
          statusMessage.textContent = err;
          statusMessage.className = 'status-message error';
          return;
        }
        statusMessage.textContent = n === 0
          ? 'Room and profile cache was already empty.'
          : ('Removed ' + n + ' cached entr' + (n === 1 ? 'y' : 'ies') + '. Fresh data will load next time.');
        statusMessage.className = 'status-message success';
        setTimeout(() => {
          statusMessage.className = 'status-message';
        }, 4000);
      });
    });
  }

  if (clearCapabilityCacheButton) {
    clearCapabilityCacheButton.addEventListener('click', () => {
      clearCapabilityScoreCache(function (err) {
        if (err) {
          statusMessage.textContent = err;
          statusMessage.className = 'status-message error';
          return;
        }
        statusMessage.textContent = 'Capability score cache cleared.';
        statusMessage.className = 'status-message success';
        setTimeout(() => {
          statusMessage.className = 'status-message';
        }, 4000);
      });
    });
  }
});
