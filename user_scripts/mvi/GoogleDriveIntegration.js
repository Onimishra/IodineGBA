(function() {
	var CLIENT_ID = '971475629778-la76i8ghv3u9h330fvlfar1nfjfo5113.apps.googleusercontent.com';
	var SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.appfolder'];
	var AUTH = null;

	var GDrive = {};
	var loaded = false;

	var auth = function(callback, userAccept) {
		if(loaded) { callback(); return; }

		console.log("logging in");
		console.log(callback);
		gapi.auth.authorize({
      'client_id': CLIENT_ID,
      'scope': SCOPES.join(' '),
      'immediate': (userAccept ? false : true)
    }, function(authResult) { 
    	console.log(authResult); 
    	console.log(callback);
    	if(authResult.error != null) {
    		document.getElementById("gdrive-connect").classList.add("show");
    		return;
    	}
    	document.getElementById("gdrive-connect").classList.remove("show");
    	console.log("login success");
    	console.log(callback);
    	AUTH = authResult; 
    	loaded = true; 
    	gapi.client.load('drive', 'v2', callback);
    });
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