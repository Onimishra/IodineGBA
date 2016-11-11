(function() {
	var CLIENT_ID = '971475629778-la76i8ghv3u9h330fvlfar1nfjfo5113.apps.googleusercontent.com';
	var SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.appfolder'];
	var AUTH = null;

	var GDrive = {};
	var loaded = false;

	var auth = function(callback) {
		if(loaded) { callback(); return; }

		console.log("logging in");
		gapi.auth.authorize({
      'client_id': CLIENT_ID,
      'scope': SCOPES.join(' '),
      'immediate': true
    }, function(authResult) { 
    	console.log(authResult); 
    	AUTH = authResult; 
    	loaded = true; 
    	gapi.client.load('drive', 'v2', callback);
    });
	}

	var listAll = function(q, callback, agg, nextPage) {
	  agg = agg || [];

	  var search = {
	    'maxResults': 1000,
	    'fields': "items(downloadUrl,fileExtension,kind,mimeType,originalFilename),nextPageToken"
	  };
	  search.q = q;
	  if(nextPage != undefined) search.pageToken = nextPage;

	  var request = gapi.client.drive.files.list(search);
	  request.execute(function(resp) {
	  	console.log(resp);
	    agg = agg.concat(resp.items.filter(function(value) { return value.fileExtension.endsWith("gbc") || value.fileExtension.endsWith("gba"); }));
	    if(resp.nextPageToken != undefined)
	      listAll(q, callback, agg, resp.nextPageToken);
	    else
	      callback(agg);
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
			alert("An error occoured when retrieving local stored games.");
	    console.log(e);
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

	GDrive.updateCache = function(callback) {
		auth(function() {
      listAll('mimeType="application/octet-stream"', function(files) {
      	storeFiles(files, callback);
      });
    });
	}

	this.GDrive = GDrive;
})();