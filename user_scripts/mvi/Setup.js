"use strict";

function disableZoom() {
  // Disable pinch
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });

  // Disable double tap
  var lastTouchEnd = 0;
  document.getElementById("container").addEventListener('touchstart', function (event) {
    var now = (new Date()).getTime();
    if (now - lastTouchEnd <= 600) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Scroll
  document.getElementById("container").addEventListener('touchmove', function(event) {
      event.preventDefault();
  }, false);

  // Random
  function prevent(e) { e.preventDefault() }
  // you could target also another nested DOM element
  document.body.addEventListener('gesturechange', prevent)
  document.body.addEventListener('gesturestart', prevent)
  document.body.addEventListener('gestureend', prevent)
}


var updating = false;
function updateCache() {
  if(updating) return;
  updating = true;
  var count = 0;

  loading(true);

  GDrive.updateCache(function(max, current) { // Update
    loading(true, current/max);
  },function(files) { // Complete
    loading(false);
    updating = false;
    buildDrawer();
  });
};

function bindGoogleDrive() {
  // Update cache
  document.getElementById("gdrive-files-update").addEventListener("click", updateCache);
  document.getElementById("gdrive-connect").addEventListener("click", function() {
    GDrive.connect(function() {
      updateCache(function() {}, buildDrawer);
    });
  });
  document.getElementById("gdrive-files-update-games").addEventListener("click", function() {
    GDrive.clearCache();
    buildDrawer();
  });
  document.getElementById("gdrive-logout").addEventListener("click", function() {
    GDrive.logout();
    window.location.reload();
  });
}

var BIOS = null;
function bindDrawer() {
  var toggleDrawer = function() {
    var e = document.getElementById("expander").parentElement;
    if(e.classList.contains("open")) {
      e.classList.remove("open");
      IodineGUI.Iodine.play();
    } else {
      e.classList.add("open");
      updateCache();
      IodineGUI.Iodine.pause();
    }
  };

  setTimeout(function() {
    if(IodineGUI.Iodine.emulatorStatus != 5)
      toggleDrawer();
  }, 800);

  document.getElementById("expander").addEventListener("click", toggleDrawer);
  document.getElementById("game-list").addEventListener("click", function(event) {
    if(event.target.data == null) return;
    var file = event.target.data;

    localforage.setItem("lastPlayed", file);

    loading(true);
    GDrive.download(BIOS, function(data) {
      console.log("Finished");
      attachBIOS(data);

      GDrive.download(file, function(data) {
        console.log("Rom finished");
        toggleDrawer();
        attachROM(data);
        loading(false);
        setTimeout(function() {
          IodineGUI.Iodine.play();
        }, 400);
      });
    });  
  });

  document.getElementById("options").addEventListener("click", function() {
    var e = document.getElementById("menu");
    e.style.display = e.style.display == "block" ? "none" : "block";
  });

  buildDrawer();
}

function loading(state, progress) {
  var elem = document.getElementById("loading");
  if(state)
    elem.classList.add("visible");
  else
    elem.classList.remove("visible");

  if(progress == null)
    elem.classList.add("no-animation");
  else {
    elem.classList.remove("no-animation"); 
    elem.childNodes[0].style.width = (100*progress) + "%";
  }
}

function buildDrawer() {
  var list = document.getElementById("game-list");
  while(list.firstChild) list.removeChild(list.firstChild);
  // BUILD DRAWER
  GDrive.listFiles(function(files) {
    var e = document.getElementById("game-list");
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if(file.originalFilename.includes("bios")) { BIOS = file; continue; }
      var li = document.createElement("li");
      li.data = file;
      li.innerHTML = file.originalFilename.slice(0, -4);
      e.appendChild(li);
    }
  });
}

function bindBetterVirtualControls() {
  var lastElemTouched = new Map();
  var releaseTouch = function(t) {
    if(t == null) return;
    var elem = lastElemTouched.get(t.identifier);
    if(elem == null) return;
    elem.classList.remove("pressed");

    if(elem.dataset.input != null) {
      IodineGUI.Iodine.keyUp(elem.dataset.input);
    }

    lastElemTouched.delete(t.identifier);
  };

  var pushTouch = function(e){
    var tList = e.touches; // get list of all touches
    for (var i = 0; i < tList.length; i++) {
        var t = tList[i]; // not 100% sure about this
        var elementTouching = document.elementFromPoint( 
            t.clientX, 
            t.clientY
        );
        var lastElem = lastElemTouched.get(t.identifier);
        if (lastElem == undefined || elementTouching.id != lastElem.id) {
          if(lastElem != undefined) {
            releaseTouch(t);
          }
          lastElemTouched.set(t.identifier, elementTouching);
          elementTouching.classList.add("pressed");
          if(elementTouching.dataset.input != null) {
            IodineGUI.Iodine.keyDown(elementTouching.dataset.input);
          }
        }
    }
  };

  document.getElementById("container").addEventListener("touchmove", pushTouch, false);
  document.getElementById("container").addEventListener("touchstart", pushTouch, false);

  document.getElementById("container").addEventListener("touchend", function(e){
    var tList = e.touches; // get list of all touches
    var t = e.changedTouches[0];
    releaseTouch(t);
    e.preventDefault();
  }, false);
} 

function setup() {
  disableZoom();
  bindGoogleDrive();
  bindDrawer();
  bindBetterVirtualControls();

  // Disable audio on iOS
  if (navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/iPad/i)) {
      console.log("disabling audio");
      IodineGUI.Iodine.disableAudio();
  }

  var speedElem = document.getElementById("touch-speed");
  var speed = 0;
  speedElem.addEventListener("touchstart", function() {
    speed = IodineGUI.Iodine.getSpeed();
    IodineGUI.Iodine.setSpeed(2);
  })
  speedElem.addEventListener("touchend", function() {
    IodineGUI.Iodine.setSpeed(speed);
  });

  localforage.keys().then(function(keys) {
      var biosKey = keys.filter(function(entry) { return entry.includes("bios"); });
      if(biosKey.length == 0) return;
      localforage.getItem("lastPlayed").then(function(gbaFile) {
        if(gbaFile == null) return;
        localforage.getItem(biosKey[0]).then(function(bios) {
          if(bios == null) return;
          attachBIOS(bios);
          console.log("Resuming game");
          GDrive.download(gbaFile, function(data) {
            console.log("Rom finished");
            attachROM(data);
            IodineGUI.Iodine.play();
          });
        }); 
    });
  });

  // news.render();  
  var key = "news-"+news.version;
  localforage.getItem(key).then(function(d) {
    if(d) return;
    news.render();  
    localforage.setItem(key, true);
  });
};
window.addEventListener("load", setup);

