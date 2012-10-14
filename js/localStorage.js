var PROFILE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;

// Simple wrapper for an abstract local storage provider (indexedDB)
// to provide a key based JSON storage.
function JSONStorage() {
  this._indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
  this._db = null;
  this._pendingRequests = [];
  if (!this._indexedDB)
    return; // No storage

  var dbRequest = this._indexedDB.open("cleopatra", 2);
  var self = this;
  dbRequest.onupgradeneeded = function(event) {
    PROFILERLOG("Upgrade cleopatra DB");
    var db = event.target.result;
    var store = db.createObjectStore("profiles", {keyPath: "storage_key"});
  }
  dbRequest.onsuccess = function(event) {
    PROFILERLOG("'cleopatra' database open");
    self._db = dbRequest.result;
    for (var i = 0; i < self._pendingRequests.length; i++) {
      self._pendingRequests[i]();
    }
    self._pendingRequests = [];
  };

}
JSONStorage.prototype = {
  setValue: function JSONStorage_setValue(key, value, callback) {
    if (!this._db) {
      var self = this;
      this._pendingRequests.push(function pendingSetValue() {
        self.setValue(key, value, callback);
      });
      return;
    }
    this._db.transaction("profiles", "readwrite").objectStore("profiles").put( {storage_key: key, value: value} );
    //PROFILERTRACE("JSONStorage['" + key + "'] set " + JSON.stringify(value));
    if (callback)
      callback();
  },

  getValue: function JSONStorage_getValue(key, callback) {
    if (!this._db) {
      var self = this;
      this._pendingRequests.push(function pendingGetValue() {
        self.getValue(key, callback);
      });
      return;
    }
    var transaction = this._db.transaction("profiles");
    var request = transaction.objectStore("profiles").get(key);
    request.onsuccess = function(event) {
      if (!callback)
        return;
      //PROFILERTRACE("JSONStorage['" + key + "'] get " + JSON.stringify(request.result));
      if (request.result) {
        callback(request.result.value);
      } else {
        callback(null);
      }
    }
    request.onerror = function() {
      PROFILERERROR("Error getting value from indexedDB");
    }
  },

  deleteValue: function JSONStorage_deleteValue(key, callback) {
    if (!this._db) {
      var self = this;
      this._pendingRequests.push(function pendingDeleteValue() {
        self.deleteValue(key, callback);
      });
      return;
    }
    var transaction = this._db.transaction("profiles", "readwrite");
    var request = transaction.objectStore("profiles").delete(key);
    request.onsuccess = function(event) {
      if (!callback)
        return;
      //PROFILERTRACE("JSONStorage['" + key + "'] get " + JSON.stringify(request.result));
      if (request.result) {
        callback(request.result.value);
      } else {
        callback(null);
      }
    }
    request.onerror = function() {
      PROFILERERROR("Error deleting value from indexedDB");
    }
  },

  clearStorage: function JSONStorage_clearStorage(callback) {
    if (!this._db) {
      var self = this;
      this._pendingRequests.push(function pendingSetValue() {
        self.clearStorage(callback);
      });
      return;
    }
    var transaction = this._db.transaction("profiles", "readwrite");
    var request = transaction.objectStore("profiles").clear();
    request.onsuccess = function() {
      PROFILERLOG("Cleared local profile storage");
      if (callback)
        callback();
    }
  },
}

function ProfileLocalStorage() {
  this._storage = new JSONStorage();
}
ProfileLocalStorage.prototype = {
  getProfileList: function ProfileLocalStorage_getProfileList(callback) {
    this._storage.getValue("profileList", function gotProfileList(profileList) {
      profileList = profileList || [];
      callback(profileList);
    });
  },

  storeLocalProfile: function ProfileLocalStorage_storeLocalProfile(profile, profileKey, callback) {
    var self = this;
    var date = new Date();
    var time = date.getTime();
    this.getProfileList(function got_profile(profileList) {
      if (profileList.length >= 5) {
        var profileToRemove = profileList[0].profileKey;
        self.deleteLocalProfile(profileList);
        profileList.shift();
      }
      profileKey = profileKey || "local_profile:" + time;
      for (var i = 0; i < profileList.length; i++) {
        if (profileList[i].profileKey == profileKey) {
          dump("Profile already exists\n");
          return;
        }
      }
      profileList.push( {profileKey: profileKey, key: profileKey, name: "Profile " + date, date: date.getTime(), expire: time + PROFILE_EXPIRE_TIME, storedTime: time} );
      self._storage.setValue(profileKey, profile);
      self._storage.setValue("profileList", profileList);
      if (callback)
        callback();
    });
  },

  getProfile: function ProfileLocalStorage_getProfile(profileKey, callback) {
     this._storage.getValue(profileKey, callback); 
  },

  deleteLocalProfile: function ProfileLocalStorage_deleteLocalProfile(profileKey, callback) {
     this._storage.deleteValue(profileKey, callback); 
  },

  clearStorage: function ProfileLocalStorage_clearStorage(callback) {
     this._storage.clearStorage(callback);
  },
};

var gLocalStorage = new ProfileLocalStorage();

function quickTest() {
  gLocalStorage.getProfileList(function(profileList) {
    gLocalStorage.storeLocalProfile({}, function() {
      gLocalStorage.clearStorage();
    });
  });
}
//quickTest();
