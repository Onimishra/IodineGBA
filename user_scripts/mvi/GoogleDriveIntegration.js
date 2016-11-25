(function() {
	var CLIENT_ID = '971475629778-la76i8ghv3u9h330fvlfar1nfjfo5113.apps.googleusercontent.com';
	var CLIENT_SECRET = 'nKFdhgzNKdAEUJYPb41AzrqX';
	var SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.appfolder'];
	var AUTH = null;

	var GDrive = {};
	var loaded = false;

	// var auth = function(callback, userAccept) {
	// 	if(loaded) { callback(); return; }

	// 	console.log("logging in");
	// 	console.log(callback);
	// 	var req = {
 //      'client_id': CLIENT_ID,
 //      'scope': SCOPES.join(' '),
 //      'immediate': (userAccept ? false : true)
 //    };
 //    if(AUTH != null) req.code = AUTH.code;
 //    if(userAccept) {
 //    	req.access_type = "offline";
 //    	req.response_type = "code";
 //    }
	// 	gapi.auth.authorize(req, function(authResult) { 
 //    	console.log(authResult); 
 //    	console.log(callback);
 //    	if(authResult.error != null) {
 //    		document.getElementById("gdrive-connect").classList.add("show");
 //    		return;
 //    	}
 //    	document.getElementById("gdrive-connect").classList.remove("show");
 //    	console.log("login success");
 //    	console.log(callback);
 //    	AUTH = authResult; 
 //    	loaded = true; 
 //    	gapi.client.load('drive', 'v2', callback);
 //    });
	// }

	var auth = function(callback, userAccept) {
		// Load token
		var token = window.localStorage.getItem("refresh_token");
		if(token == null && !userAccept) {
			console.log("Not logged in and not authed");
			document.getElementById("gdrive-connect").classList.add("show");
			return;
		} else if(token == null) {
			return generateRefreshToken(function(token) { 
				document.getElementById("gdrive-connect").classList.remove("show");
				auth(callback, userAccept); 
			});
		}

		console.log("Authed - proceeding");
		console.log(token);

		// Use refresh token
		if(loaded) { callback(); return; }

		console.log("Logging in");
		var data = new URLSearchParams();
			data.set("refresh_token", token);
			data.set("client_id", CLIENT_ID);
			data.set("client_secret", CLIENT_SECRET);
			data.set("grant_type", "refresh_token");
			fetch("https://www.googleapis.com/oauth2/v4/token", {
				method: "POST",
				body: data
			}).then(function(d) {
				d.json().then(function(json) {
					console.log("Logged in");
					console.log(json);
					AUTH = json;
					loaded = true;
					gapi.auth.setToken(json);
					gapi.client.load('drive', 'v2', callback);
					
				});
			});
	}

	var generateRefreshToken = function(callback) {
		gapi.auth.authorize({
			'client_id': CLIENT_ID,
			'scope': SCOPES.join(' '),
			'access_type': "offline",
			'response_type': "code",
			'prompt': "consent"
		}, function(auth) {
			console.log(auth);

			var data = new URLSearchParams();
			data.set("code", auth.code);
			data.set("client_id", CLIENT_ID);
			data.set("client_secret", CLIENT_SECRET);
			data.set("scope", SCOPES.join(' '));
			// data.set("redirect_uri", "http://localhost:8887/");
			data.set("redirect_uri", "postmessage");
			data.set("grant_type", "authorization_code");
			fetch("https://www.googleapis.com/oauth2/v4/token", {
				method: "POST",
				body: data
			}).then(function(d) {
				d.json().then(function(json) {
					console.log(json);
					if(json.refresh_token != null) window.localStorage.setItem("refresh_token", json.refresh_token);
					if(callback != null) callback(json.refresh_token);
				});
			}, function(e) { // error
				console.log(e);
			});
			
		})
	}

	window.gauth = auth;

	var listAll = function(q, callback, updateCallback, agg, nextPage) {
	  agg = agg || [];

	  var search = {
	  	'folderId': 'root',
	    'maxResults': 1000
	  };
	  search.q = "title = 'roms'"
	  if(nextPage != undefined) search.pageToken = nextPage;

	  var request = gapi.client.drive.children.list(search);
	  request.execute(function(resp) {
	  	if(resp.items.length == 0) {
	  		alert("You do not have a folder called \"roms\" in you Google Drive");
	  		callback([]);
	  		return;
	  	}
	  	search.folderId = resp.items[0].id;
	  	search.q = q;
	  	gapi.client.drive.children.list(search).execute(function(sResp) {
	  		var i = 0;
	  		var next = function() {
	  			gapi.client.drive.files.get({
	  				'fileId': sResp.items[i].id,
	    			'fields': "downloadUrl,fileExtension,kind,mimeType,originalFilename"
	  			}).execute(function(file) {
	  				updateCallback();
	  				agg.push(file);
	  				if(agg.length == sResp.items.length) {
	  					agg = agg.filter(function(value) { return value.fileExtension.endsWith("gba"); });
	  					callback(agg);
	  				} else {
	  					next(++i);
	  				}
	  			});
	  		}
	  		next(i);
	  	});
	  })
	}

	var storeFiles = function(files, callback) {
		localforage.setItem('knownFiles', files)
		.then(callback)
		.catch(function(e) {
			alert("An error occoured when saving local stored games.");
	    console.log(e);
	    callback(files);
	  });
	}

	var processDownload = function(parentObj, attachHandler) {
    try {
        attachHandler(new Uint8Array(parentObj.response));
    }
    catch (error) {
        var data = parentObj.responseText;
        var length = data.length;
        var dataArray = [];
        for (var index = 0; index < length; index++) {
            dataArray[index] = data.charCodeAt(index) & 0xFF;
        }
        attachHandler(dataArray);
    }
	};

	GDrive.listFiles = function(callback) {
  	localforage.getItem('knownFiles')
  	.then(callback)
  	.catch(function(e) {
	    callback([]);
	  });
	};

	GDrive.download = function(file, callback) {
		var cache = function(res) {
			processDownload(res.target, function(byteArr) {
				// callback(byteArr);
				localforage.setItem(file.originalFilename, byteArr)
				.then(callback)
				.catch(function(e) {
					console.log("Unable to save byte array");
					console.log(e);
					callback(byteArr);
				});
			});
		};

		localforage.getItem(file.originalFilename)
		.then(function(byteArr) {
			if(byteArr !== null) callback(byteArr);
			else {
				console.log("Downloading file");

				auth(function() {
					var ajax = new XMLHttpRequest();
				  ajax.onload = cache;
				  ajax.open("GET", file.downloadUrl, true);
				  ajax.responseType = "arraybuffer";
				  ajax.overrideMimeType("text/plain; charset=x-user-defined");
				  ajax.setRequestHeader("Authorization", "Bearer " + AUTH.access_token);
				  ajax.send(null);
				});
			}
		})
		.catch(function(e) {
			alert("Unable to handle file");
			console.log(e);
		});
		
	}

	GDrive.updateCache = function(update, callback) {
		auth(function() {
      listAll('trashed=false and mimeType="application/octet-stream"', function(files) {
      	storeFiles(files, callback);
      }, update);
    });
	}

	GDrive.isLoggedIn = function() {
		return AUTH != null;
	};

	GDrive.connect = function(callback) {
		auth(callback, true);
	};

	this.GDrive = GDrive;
})();