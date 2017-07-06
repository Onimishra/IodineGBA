'use strict';
(function() {
	var CLIENT_ID = '971475629778-la76i8ghv3u9h330fvlfar1nfjfo5113.apps.googleusercontent.com';
	var CLIENT_SECRET = 'nKFdhgzNKdAEUJYPb41AzrqX';
	var SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.appfolder'];
	var AUTH = null;

	var GDrive = {};
	var loaded = false;

	var initGapiToken = function() {
		gapi.auth.token = function(opt, callback) {
			var data = "";
			for (var i in opt) {
				data += "&" + i + "=" + encodeURIComponent(opt[i]);
			}
			

			fetch("https://www.googleapis.com/oauth2/v4/token",{
				method: "POST",
				headers: {  
			    "Content-type": "application/x-www-form-urlencoded; charset=UTF-8"  
			  },
				body: data.substring(1)
			}).then(function(d) {d.json().then(callback);});
		};
	};

	var auth = function(callback, userAccept) {
		if(gapi.auth.token == null) initGapiToken();

		// Load token
		var token = window.localStorage.getItem("refresh_token");
		if(token == null && !userAccept) {
			console.log("Not logged in and not authed");
			localforage.clear();
			document.getElementById("gdrive-connect").classList.add("show");
			if(callback != null) callback();
			return;
		} else if(token == null) {
			return generateRefreshToken(function(token) { 
				document.getElementById("gdrive-connect").classList.remove("show");
				auth(callback, userAccept); 
			});
		}

		// Use refresh token
		if(loaded) { callback(); return; }

		console.log("Logging in");

		gapi.auth.token({
			"refresh_token": token,
			"client_id": CLIENT_ID,
			"client_secret": CLIENT_SECRET,
			"grant_type": "refresh_token"
		}, function(json) {
			console.log("Logged in");
			console.log(json);
			AUTH = json;
			loaded = true;
			gapi.auth.setToken(json);
			gapi.client.load('drive', 'v2', callback);			
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

			gapi.auth.token({
				"code": auth.code,
				"client_id": CLIENT_ID,
				"client_secret": CLIENT_SECRET,
				"scope": SCOPES.join(' '),
				"redirect_uri": "postmessage",
				"grant_type": "authorization_code"
			}, function(json) {
				console.log(json);
				if(json.refresh_token != null) window.localStorage.setItem("refresh_token", json.refresh_token);
				if(callback != null) callback(json.refresh_token);
			});
			
		})
	}

	window.gauth = auth;

	var listAll = function(q, callback, updateCallback, agg, nextPage) {
	  agg = agg || [];
	  if(gapi.client.drive == null) return callback(agg);

	  var search = {
	  	'folderId': 'root',
	    'maxResults': 1000
	  };
	  search.q = "title = 'roms'"
	  if(nextPage != undefined) search.pageToken = nextPage;

	  var request = gapi.client.drive.children.list(search);
	  request.execute(function(resp) {
	  	if(resp.items == null) return callback([]);
	  	if(resp.items.length == 0) {
	  		alert("You do not have a folder called \"roms\" in you Google Drive");
	  		callback([]);
	  		return;
	  	}
	  	search.folderId = resp.items[0].id;
	  	search.q = q;
	  	gapi.client.drive.children.list(search).execute(function(sResp) {
	  		var count = sResp.items.length;
	  		var i = 0;
	  		updateCallback(count, i);

	  		if(count == 0) return callback(agg);
	  		var next = function() {
	  			gapi.client.drive.files.get({
	  				'fileId': sResp.items[i].id,
	    			'fields': "downloadUrl,fileExtension,kind,mimeType,originalFilename,fileSize"
	  			}).execute(function(file) {
	  				updateCallback(count, i+1);
	  				agg.push(file);
	  				if(agg.length == sResp.items.length) {
	  					console.log(agg);
	  					agg = agg.filter(function(value) { 
	  						return value.fileExtension.endsWith("gba") 
	  						|| value.fileExtension.endsWith("zip") 
	  						|| value.fileExtension.endsWith("bin"); 
	  					});
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
		localforage.getItem('knownFiles').then(function(oldFiles) {
			oldFiles = oldFiles || [];
			localforage.keys().then(function(keys) {
				oldFiles = oldFiles.filter(function(f) { return keys.includes(f.originalFilename); });
				var newFiles = union_arrays(oldFiles, files);
				localforage.setItem('knownFiles', newFiles)
				.then(callback)
				.catch(function(e) {
					alert("An error occoured when saving local stored games.");
			    console.log(e);
			    callback(newFiles);
			  });
			});

		});
	}

	function union_arrays (x, y) {
	  var obj = {};
	  for (var i = x.length-1; i >= 0; -- i)
	     obj[x[i].originalFilename] = x[i];
	  for (var i = y.length-1; i >= 0; -- i)
	     obj[y[i].originalFilename] = y[i];
	  var res = []
	  for (var k in obj) {
	    if (obj.hasOwnProperty(k))  // <-- optional
	      res.push(obj[k]);
	  }
	  return res;
	}

	var processDownload = function(parentObj, callback) {
    try {
        callback(new Uint8Array(parentObj.response));
    }
    catch (error) {
        var data = parentObj.responseText;
        var length = data.length;
        var dataArray = [];
        for (var index = 0; index < length; index++) {
            dataArray[index] = data.charCodeAt(index) & 0xFF;
        }
        callback(dataArray);
    }
	};

	GDrive.listFiles = function(callback) {
  	localforage.getItem('knownFiles')
  	.then(callback)
  	.catch(function(e) {
	    callback([]);
	  });
	};

	GDrive.uploadAppData = function(name, jsonData, callback, updateCallback) {
		updateCallback = updateCallback || function() {};
		callback = callback || function(file) { console.log(file) };

		auth(function() {
			gapi.client.drive.files.list({
		    'q': '\'appfolder\' in parents and trashed=false and title=\''+ name +'\''
		  }).then(function(e) {
	  		const method = e.result.items.length > 0 ? "PUT" : "POST";
	  		const fileId = e.result.items.length > 0 ? "/"+e.result.items[0].id : "";

			 	const boundary = '-------314159265358979323846';
			  const delimiter = "\r\n--" + boundary + "\r\n";
			  const close_delim = "\r\n--" + boundary + "--";

			  var contentType = 'text/plain';
			  var metadata = {
			    'title': name,
			    'mimeType': contentType,
			    'parents': [{'id': 'appfolder'}]
			  };

			  var encodedData = JSON.stringify(jsonData);
			  var multipartRequestBody =
			      delimiter +
			      'Content-Type: application/json\r\n\r\n' +
			      JSON.stringify(metadata) +
			      delimiter +
			      'Content-Type: ' + contentType + '\r\n' +
			      '\r\n' +
			      encodedData +
			      close_delim;

			  var request = gapi.client.request({
			      'path': '/upload/drive/v2/files' + fileId,
			      'method': method,
			      'params': {'uploadType': 'multipart'},
			      'headers': {
			        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
			      },
			      'body': multipartRequestBody});
			  request.execute(callback);
		  });
		});
	}

	GDrive.downloadAppData = function(name, callback, updateCallback) {
		updateCallback = updateCallback || function() {};

		auth(function() {
			gapi.client.drive.files.list({
		    'q': '\'appfolder\' in parents and trashed=false and title=\''+ name +'\''
		  }).then(function(response) {
		  	var file = response.result.items[0];
		  	if(file == null) return callback();

		  	var ajax = new XMLHttpRequest();
				ajax.addEventListener("progress", function(e) {
					updateCallback(e.loaded, e.total);
				});
			  ajax.onload = callback;
			  ajax.open("GET", file.downloadUrl, true);
			  ajax.responseType = "json";
			  ajax.setRequestHeader("Authorization", "Bearer " + AUTH.access_token);
			  ajax.send(null);
		  });			
		});
	}

	GDrive.download = function(file, callback, updateCallback) {
		var cache = function(res) {
			if(!file.fileExtension.endsWith("zip")) {
				processDownload(res.target, function(byteArr) {
					localforage.setItem(file.originalFilename, byteArr)
					.then(callback)
					.catch(function(e) {
						console.log("Unable to save byte array");
						console.log(e);
						callback(byteArr);
					});
				});
			} else {
				console.log("Unzipping");
				processDownload(res.target, function(zipByteArr) {
					var zip = new JSZip();
					zip.loadAsync(zipByteArr).then(function(unzipped) {
						console.log(unzipped);
						var fileArr = unzipped.file(/(\.|\/)(gba|rom|bin)$/i);
						fileArr[0].async("uint8array").then(function(byteArr) {
							console.log(byteArr);
							localforage.setItem(file.originalFilename, byteArr)
							.then(callback)
							.catch(function(e) {
								console.log("Unable to save byte array");
								console.log(e);
								callback(byteArr);
							});
						});
					});
				});
			}
		};

		localforage.getItem(file.originalFilename)
		.then(function(byteArr) {
			if(byteArr !== null) callback(byteArr);
			else {
				console.log("Downloading file");
				console.log(file);

				auth(function() {
					var ajax = new XMLHttpRequest();
					ajax.addEventListener("progress", function(e) {
						if(updateCallback != null) updateCallback(e.loaded, e.lengthComputable ? e.total : file.fileSize);
					});
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

	GDrive.clearCache = function() {
		localforage.clear();
	};

	GDrive.updateCache = function(update, callback) {
		auth(function() {
      listAll('trashed=false and (mimeType contains "application/")', function(files) {
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

	GDrive.logout = function() {
		localStorage.removeItem("refresh_token");
	}

	window.GDrive = GDrive;
})();