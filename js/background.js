//Heavily relying upon CodeMirror. Even running a mock html display, a DOM, and implementing that into a javascript project for a Google ChromeOS build. Chromebook.
//this class had todo with this issue: Prevent same file from being opened multiple times #354 https://github.com/GoogleChromeLabs/text-app/issues/354
//I am running a developer mode, chrome extension that is a text-dev-app, I was able to change the textSize and see my alterations.

//The developer version, doesn't have the same problem as the release, it either opens the double clicked chosen text file or it opens a new text-app with 
//an "untitled 1 text-file" instead.

//now this bug only opens a text document twice
/**
 * @constructor
 */
function Background() {
  this.entriesToOpen_ = [];
  this.windows_ = [];
}

/**
 * @return {boolean}
 * True if the system window frame should be shown. It is on the systems where
 * borderless window can't be dragged or resized.
 */
Background.prototype.ifShowFrame_ = function() {
  var version = parseInt(navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10);
  var os = 'other';
  if (navigator.appVersion.indexOf('Linux') != -1) {
    os = 'linux';
  } else if (navigator.appVersion.indexOf('CrOS') != -1) {
    os = 'cros';
  } else if (navigator.appVersion.indexOf('Mac OS X') != -1) {
    os = 'mac';
  }

  return os === 'linux' && version < 27 ||
         os === 'mac' && version < 25;
};

/**
 * Opens and focuses a new window (in addition to any already open windows).
 */
Background.prototype.newWindow = function() {
  this.focusWindow(this.windows_.length);
}

/**
 * @param {number} windowId
 * Move focus to the window associated with the passed windowId. If this window
 * doesn't exist it will be created.
 */
Background.prototype.focusWindow = function(windowId) {
  const id = `appWindow${windowId}`;
  var options = {
    id,
    frame: (this.ifShowFrame_() ? 'chrome' : 'none'),
    minWidth: 400,
    minHeight: 400,
    width: 700,
    height: 700
  };


  chrome.app.window.create('index.html', options, function(win) {
    console.log('Window opened:', win);
    win.onClosed.addListener(this.onWindowClosed.bind(this, win));
  }.bind(this));
};

/**
 * @param {Object.<string, Object>} launchData
 * Handle onLaunch event.
 */
Background.prototype.launch = function(launchData) {
  var entries = [];
  chrome.storage.local.get('retainedEntryIds', function(data) {
    var retainedEntryIds = data['retainedEntryIds'] || [];
    for (var i = 0; i < retainedEntryIds.length; i++) {
      chrome.fileSystem.restoreEntry(retainedEntryIds[i], function(entry) {
        if (!chrome.runtime.lastError) {
          this.entriesToOpen_.push(entry);
        }
      }.bind(this));
    }
  }.bind(this));

  if (launchData && launchData['items']) {
    for (var i = 0; i < launchData['items'].length; i++) {
      entries.push(launchData['items'][i]['entry']);
    }
  }

  this.focusWindow(0);

  for (var i = 0; i < entries.length; i++) {
    chrome.fileSystem.getWritableEntry(
        entries[i],
        function(entry) {
          if (this.windows_.length > 0) {
            this.windows_[0].openTabs([entry]);
          } else if (!chrome.runtime.lastError) {
            this.entriesToOpen_.push(entry);
          }
        }.bind(this));
  }
};

/**
 * @param {Window} win
 * Handle onClosed.
 */
Background.prototype.onWindowClosed = function(win) {
  console.log('Window closed:', win);
  if (!win.contentWindow || !win.contentWindow.textApp) {
    console.warn('No TextApp object in the window being closed:',
                 win.contentWindow, win.contentWindow.textApp);
    return;
  }
  var textApp = win.contentWindow.textApp;
  for (var i = 0; i < this.windows_.length; i++) {
    if (textApp === this.windows_[i]) {
      this.windows_.splice(i, 1);
    }
  }

  var toRetain = textApp.getFilesToRetain();
  this.retainFiles_(toRetain);
};

/**
 * @param {Array.<FileEntry>} toRetain
 */
Background.prototype.retainFiles_ = function(toRetain) {
  console.log('Got ' + toRetain.length + ' files to retain:', toRetain);
  var toRetainEntryIds = [];
  for (var i = 0; i < toRetain.length; i++) {
    var entryId = chrome.fileSystem.retainEntry(toRetain[i]);
    toRetainEntryIds.push(entryId);
  }
  chrome.storage.local.set({'retainedEntryIds': toRetainEntryIds});
};

/**
 * @param {TextApp} textApp
 * Called by the TextApp object in the window when the window is ready.
 */
Background.prototype.onWindowReady = function(textApp) {
  this.windows_.push(textApp);
  textApp.setHasChromeFrame(this.ifShowFrame_());
  textApp.openTabs(this.entriesToOpen_);
  this.entriesToOpen_ = [];
};

/**
 * @param {FileEntry} entry
 * @param {function(FileEntry)} callback
 * Make a copy of a file entry.
 */
Background.prototype.copyFileEntry = function(entry, callback) {
  chrome.fileSystem.getWritableEntry(entry, callback);
};

var background = new Background();
chrome.app.runtime.onLaunched.addListener(background.launch.bind(background));


/* Exports */
window['background'] = background;
Background.prototype['copyFileEntry'] = Background.prototype.copyFileEntry;
Background.prototype['onWindowReady'] = Background.prototype.onWindowReady;
Background.prototype['newWindow'] = Background.prototype.newWindow;
