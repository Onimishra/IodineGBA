"use strict";

function disableZoom() {
  // Disable pinch
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });

  // Disable double tap
  var lastTouchEnd = 0;
  document.body.addEventListener('touchstart', function (event) {
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

function bindGoogleDrive() {
  // Update cache
  var updating = false;
  document.getElementById("gdrive-files-update").addEventListener("click", function() {
    if(updating) return;
    updating = true;
    var count = 0;

    var loadingElem = document.getElementById("full-loading");
    loadingElem.innerHTML = count + " packages searched";
    loadingElem.className += " show";

    GDrive.updateCache(function() { // Update
      count++;
      loadingElem.innerHTML = count + " packages searched";
    },function(files) { // Complete
      console.log(files);
      writeRedTemporaryText("Cache upate complete");
      loadingElem.className = loadingElem.className.slice(0, -(" show".length));
      updating = false;
    });
  });
}

function bindDrawer() {
  var BIOS = null;
  var toggleDrawer = function() {
    var e = document.getElementById("expander").parentElement;
    if(e.className.includes("open"))
      e.className = e.className.slice(0, -(" open").length);
    else
      e.className += " open";
  };

  document.getElementById("expander").addEventListener("click", toggleDrawer);
  document.getElementById("game-list").addEventListener("click", function(event) {
    if(event.target.data == null) return;
    var file = event.target.data;

    GDrive.download(BIOS, function(data) {
      console.log("Finished");
      attachBIOS(data);

      GDrive.download(file, function(data) {
        console.log("Rom finished");
        attachROM(data);
        IodineGUI.Iodine.play();
        toggleDrawer();
      });
    });
  });

  document.getElementById("options").addEventListener("click", function() {
    var e = document.getElementById("menu");
    e.style.display = e.style.display == "block" ? "none" : "block";
  });

  // BUILD DRAWER
  GDrive.listFiles(function(files) {
    var e = document.getElementById("game-list");
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if(file.originalFilename == "bios.gba") { BIOS = file; continue; }
      var li = document.createElement("li");
      li.data = file;
      li.innerHTML = file.originalFilename.slice(0, -4);
      e.appendChild(li);
    }
  });
}

function bindBetterVirtualControls() {
  var releaseTouch = function(t) {
    if(t == null) return;
    var elem = lastElemTouched.get(t.identifier);
    if(elem == null) return;
    var event = document.createEvent("TouchEvent");
    event.initUIEvent('touchend', true, true);
    elem.dispatchEvent(event);
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

  var lastElemTouched = new Map();
  document.getElementById("container").addEventListener("touchmove", pushTouch, false);
  document.getElementById("container").addEventListener("touchstart", pushTouch, false);

  document.getElementById("container").addEventListener("touchend", function(e){
    var tList = e.touches; // get list of all touches
    var t = e.changedTouches[0];
    releaseTouch(t);
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

};
window.addEventListener("load", setup);

