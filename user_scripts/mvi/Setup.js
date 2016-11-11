"use strict";

function disableZoom() {
  // Disable pinch
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });

  // Disable double tap
  var lastTouchEnd = 0;
  document.documentElement.addEventListener('touchend', function (event) {
    var now = (new Date()).getTime();
    if (now - lastTouchEnd <= 600) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
}

function bindGoogleDrive() {
  document.getElementById("gdrive-files-update").addEventListener("click", function() {
    console.log("Updating cache");
    GDrive.updateCache(function(files) {
      console.log(files);
      alert("Cache upate complete");
    });
  });

  document.getElementById("gdrive-files-update-games").addEventListener("click", function() {
    console.log("Updating cache");
    var clear = function(name) {
      localforage.removeItem(name)
      .then(function() {
        alert("Games cleared");
      })
      .catch(function(e) {
        alert("Not cleared");
        console.log(e);
      })
    };

    clear("Pokemon fire red.gba");
    clear("bios.gba");
  });

  document.getElementById("gdrive-files-load").addEventListener("click", function() {
    console.log("clicked");
    GDrive.listFiles(function(files) {
      files = files || [];
      console.log(files);

      var bios = files.filter(function(f) { return f.originalFilename == "bios.gba"; })[0];
      if(bios == null) alert("Unable to find bios. The file should be named bios.gba and be in your google drive.");

      var rom = files.filter(function(f) { return f.originalFilename == "Pokemon fire red.gba"; })[0];
      if(rom == null) alert("Unable to find game. The file should be named Pokemon fire red.gba and be in your google drive.");

      GDrive.download(bios, function(data) {
        console.log("Finished");
        attachBIOS(data);

        GDrive.download(rom, function(data) {
          console.log("Rom finished");
          attachROM(data);
          IodineGUI.Iodine.play();
        });
      });


    });
  });
}

function setup() {
  disableZoom();
  bindGoogleDrive();

  // Disable audio on iOS
  if (navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/iPad/i)) {
      console.log("disabling audio");
      IodineGUI.Iodine.disableAudio();
  }
};
window.addEventListener("load", setup);

