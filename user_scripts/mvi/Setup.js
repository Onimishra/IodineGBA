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
    if (now - lastTouchEnd <= 600 && event.cancelable) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Scroll
  document.getElementById("container").addEventListener('touchmove', function(event) {
    if(event.cancelable)
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
    cacheBios(function() {
      loading(false);
      updating = false;
      buildDrawer();
    });

  });
};

function bindGoogleDrive() {
  // Update cache
  document.getElementById("gdrive-connect").addEventListener("click", function() {
    ga("send", "event", "gdrive", "Connection Attempted");
    GDrive.connect(function() {
      updateCache();
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
  document.getElementById("gdrive-upload-saves").addEventListener("click", function(e) {
    ga("send", "event", "gdrive", "Upload saves");
    IodineGUI.Iodine.exportSave();

    var saves = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if(key.includes("SAVE")) {
        var code = key.substring(key.lastIndexOf("_")+1);
        if(!saves.hasOwnProperty(code))
          saves[code] = {};
        if(key.includes("TYPE"))
          saves[code].type = localStorage.getItem(key);
        else
          saves[code].data = localStorage.getItem(key);
      }
    }
    console.log(saves);

    GDrive.uploadAppData("savedata.json", saves, function() {
      e.target.parentElement.parentElement.classList.remove("open");
      console.log("Upload complete");
    });
  });  
  document.getElementById("gdrive-download-saves").addEventListener("click", function(e) {
    ga("send", "event", "gdrive", "Download saves");
    var answer = confirm("This may override savegames you already have on your device. Are you sure you want to continue?");
    if(!answer) return;
    GDrive.downloadAppData("savedata.json", function(progress) {
      e.target.parentElement.parentElement.classList.remove("open");
      if(progress == null) return;
      for(var key in progress.target.response) {
        console.log(key);
        var save = progress.target.response[key];
        console.log(save);
        var dataKey = "IodineGBA_SAVE_GUID_" + key;
        var typeKey = "IodineGBA_SAVE_TYPE_GUID_" + key;
        localStorage.setItem(dataKey, save.data);
        localStorage.setItem(typeKey, save.type);
      }
      IodineGUI.Iodine.importSave();
    });
  });
  
  // console.log(document.querySelectorAll(".menu > li"));
  var menuItems = document.querySelectorAll(".menu > li");
  for(var i = 0; i < menuItems.length; i++) {
    var item = menuItems[i];
    item.addEventListener("click", function(e) {
      e.toElement.classList.add("open");
    });
  }
}

function toggleDrawer() {
  var e = document.getElementById("expander").parentElement;
  if(e.classList.contains("open")) {
    e.classList.remove("open");
    document.querySelectorAll(".menu li").forEach(function(e) { e.classList.remove("open"); });
    document.getElementById("menu-container").classList.remove("visible");
    IodineGUI.Iodine.play();
  } else {
    e.classList.add("open");
    updateCache();
    IodineGUI.Iodine.pause();
  }
};

function closeDrawer() {
    var e = document.getElementById("expander").parentElement;
    e.classList.remove("open");
    document.getElementById("menu-container").classList.remove("visible");
    document.querySelectorAll(".menu li").forEach(function(e) { e.classList.remove("open"); });
}

function bindDrawer() {
  document.getElementById("expander").addEventListener("click", toggleDrawer);
  document.getElementById("game-list").addEventListener("click", function(event) {
    if(event.target.data == null) return;
    var file = event.target.data;

    localforage.setItem("lastPlayed", file);

    loading(true);
    startGame(file);
  });

  document.getElementById("options").addEventListener("click", function() {
    var e = document.getElementById("menu-container");
    e.classList.toggle("visible");
    document.querySelectorAll(".menu li").forEach(function(e) { e.classList.remove("open"); });
  });

  buildDrawer();
}

function startGame(file, forceStateLoad) {
  if(!file) { console.log("No file supplied"); return; }

  localforage.getItem("bios").then(function(bios) {
    attachBIOS(bios);
    GDrive.download(file, function(game) {
      console.log("Rom finished");
      attachROM(game);

      
        closeDrawer();
        loading(false);
        setTimeout(function() {
            IodineGUI.Iodine.play();

            var gameName = IodineGUI.Iodine.getGameName();
            if(forceStateLoad) {
              console.log("Looking for state for " + gameName);
              localforage.getItem("ss_" + gameName).then(function(state) {
                if(state != null) {
                  console.log("State found");
                  loadState(state);
                  return;
                  // setTimeout(function() {
                  //   IodineGUI.Iodine.pause();
                  //   setTimeout(function() {
                  //     loadState(state);
                  //     IodineGUI.Iodine.play();
                  //   }, 300);
                  // }, 300);
                }
              });
            }
        }, 400);
    }, function(progress, total) {
      loading(true, progress/total);
    });
  });
}

function cacheBios(callback) {
  GDrive.listFiles(function(files) {
    var bios = files.find(function(file) { return file.originalFilename.includes("bios"); });
    var saveBios = function(biosData) { localforage.setItem("bios", biosData); callback(); };

    if(!bios) {
      localforage.getItem("bios").then(function(bios) {
        if(!bios) {
          console.log("Downloading open bios");
          downloadFile("IodineGBA/gba_bios.bin", function(res) { processDownload(res.target, saveBios); });
        } else {
          callback();
        }
      });      
    } else {
      console.log("Downloading owner's bios");
      GDrive.download(bios, saveBios);
    }
  }); 
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
      if(file.originalFilename.includes("bios")) continue;
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
    if(elem.classList.contains("dpad-button")) {
      elem.parentElement.classList.remove(elem.id);
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
          if(elementTouching.classList.contains("dpad-button")) {
            elementTouching.parentElement.classList.add(elementTouching.id);
          }
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

function toggleFullscreen() {
  console.log("Toggling fullscreen");
  var elem = document.getElementById("settings-fullscreen");
  var body = document.getElementById("body");
  var isFullscreen = elem.classList.contains("active");
  if(isFullscreen) {
    elem.classList.remove("active");
    body.classList.remove("fullscreen");
    resizeCanvasFunc();
  } else {
    elem.classList.add("active");
    body.classList.add("fullscreen");
    resizeCanvasFunc();
  }

  localforage.getItem("i53_settings", function(settings) {
    console.log(settings);
    settings = settings || {};
    settings.fullscreen = !isFullscreen;
    localforage.setItem("i53_settings", settings);
  });
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
  IodineGUI.Iodine.disableAudio();

  var speedElem = document.getElementById("touch-speed");
  var speed = 0;
  speedElem.addEventListener("touchstart", function() {
    if(speedElem.classList.contains("active")) {
      IodineGUI.Iodine.setSpeed(speed);
    } else {
      speed = IodineGUI.Iodine.getSpeed();
      IodineGUI.Iodine.setSpeed(2);
    }
    speedElem.classList.toggle("active");
  })

  localforage.getItem("lastPlayed").then(function(rom) {
    startGame(rom, true);
  });

  var key = "news-"+news.version;
  localforage.getItem(key).then(function(d) {
    if(d) return;
    news.render();  
    localforage.setItem(key, true);
  });

  localforage.getItem("i53_settings").then(function(settings) {
    // console.log(settings);
    settings = settings || {fullscreen: false, smoothing: true};
    if(settings.fullscreen) toggleFullscreen();
    if(settings.smoothing) document.getElementById("settings-smoothing").classList.add("active");
    document.getElementById("splash").classList.add("invisible");
  });
  document.getElementById("settings-fullscreen").addEventListener("click", toggleFullscreen);


  // // Called every time running state changes
  // IodineGUI.Iodine.attachSaveExportHandler(function(arg1, arg2, arg3) {
  //   console.log(arg1);
  //   console.log(arg2);
  //   console.log(arg3);
  // });

  var speedContainer = document.getElementById("speed-percentage");
  IodineGUI.Iodine.attachSpeedHandler(function(e) {
    speedContainer.innerHTML = Math.round(e * 100) / 100;
  });
};
window.addEventListener("load", setup);

window.addEventListener("keyup", function(e) {
  if(e.which == 32) IodineGUI.Iodine.setSpeed(1);
});

var copyInto = function(src, dist) {
  var i = src.length;
  while(i--) dist[i] = src[i];
};

var serializeObj = function(obj) {
  var data = {};
  for(var s in obj) {
    if(typeof obj[s] == "number" ||
      (typeof obj[s] == "object" && obj[s].length != undefined && !(obj[s] instanceof Array))) {
      data[s] = obj[s];
    }
  }
  return data;
}

var deserializeInto = function(data, obj) {
  for(var s in data) {
    if(typeof data[s] == "number") {
      obj[s] = data[s];
    } else if(typeof data[s] == "object" && obj[s].length != undefined) {
      copyInto(data[s], obj[s]);
    }
  }
}

var saveState = function() {
  var state = {};

  var core = IodineGUI.Iodine.IOCore;
  state.core = serializeObj(core);
  state.dma = serializeObj(core.dma);
  state.dmaChannel0 = serializeObj(core.dmaChannel0);
  state.dmaChannel1 = serializeObj(core.dmaChannel1);
  state.dmaChannel2 = serializeObj(core.dmaChannel2);
  state.dmaChannel3 = serializeObj(core.dmaChannel3);
  state.memory = serializeObj(core.memory);
  state.cpu = serializeObj(core.cpu);
  state.timer = serializeObj(core.timer);
  state.gfxState = serializeObj(core.gfxState);
  state.gfxRenderer = serializeObj(core.gfxRenderer);
  state.renderer = serializeObj(core.gfxRenderer.renderer);

  state.irq = serializeObj(core.irq);
  state.wait = serializeObj(core.wait);

  state.compositor = serializeObj(core.gfxRenderer.renderer.compositor);
  state.bg0Renderer = serializeObj(core.gfxRenderer.renderer.bg0Renderer);
  state.bg1Renderer = serializeObj(core.gfxRenderer.renderer.bg1Renderer);
  state.bg2TextRenderer = serializeObj(core.gfxRenderer.renderer.bg2TextRenderer);
  state.bg3TextRenderer = serializeObj(core.gfxRenderer.renderer.bg3TextRenderer);
  state.bgAffineRenderer0 = serializeObj(core.gfxRenderer.renderer.bgAffineRenderer0);
  state.bgAffineRenderer1 = serializeObj(core.gfxRenderer.renderer.bgAffineRenderer1);
  state.bg2MatrixRenderer = serializeObj(core.gfxRenderer.renderer.bg2MatrixRenderer);
  state.bg3MatrixRenderer = serializeObj(core.gfxRenderer.renderer.bg3MatrixRenderer);
  state.bg2FrameBufferRenderer = serializeObj(core.gfxRenderer.renderer.bg2FrameBufferRenderer);
  state.objRenderer = serializeObj(core.gfxRenderer.renderer.objRenderer);
  state.window0Renderer = serializeObj(core.gfxRenderer.renderer.window0Renderer);
  state.window1Renderer = serializeObj(core.gfxRenderer.renderer.window1Renderer);
  state.objWindowRenderer = serializeObj(core.gfxRenderer.renderer.objWindowRenderer);

  var gameName = IodineGUI.Iodine.getGameName();
  localforage.setItem("ss_" + gameName, state);
  console.log("state saved for " + gameName);
}

var loadState = function(state) {
  // localforage.getItem("ss").then(function(state) {
    console.log("state loaded");

    var core = IodineGUI.Iodine.IOCore;
    deserializeInto(state.core, core);
    deserializeInto(state.dma, core.dma);
    deserializeInto(state.dmaChannel0, core.dmaChannel0);
    deserializeInto(state.dmaChannel1, core.dmaChannel1);
    deserializeInto(state.dmaChannel2, core.dmaChannel2);
    deserializeInto(state.dmaChannel3, core.dmaChannel3);
    deserializeInto(state.memory, core.memory);
    deserializeInto(state.cpu, core.cpu);
    deserializeInto(state.timer, core.timer);
    deserializeInto(state.gfxState, core.gfxState);
    deserializeInto(state.gfxRenderer, core.gfxRenderer);
    deserializeInto(state.renderer, core.gfxRenderer.renderer);

    deserializeInto(state.irq, core.irq);
    deserializeInto(state.wait, core.wait);

    deserializeInto(state.compositor ,core.gfxRenderer.renderer.compositor);
    deserializeInto(state.bg0Renderer ,core.gfxRenderer.renderer.bg0Renderer);
    deserializeInto(state.bg1Renderer ,core.gfxRenderer.renderer.bg1Renderer);
    deserializeInto(state.bg2TextRenderer ,core.gfxRenderer.renderer.bg2TextRenderer);
    deserializeInto(state.bg3TextRenderer ,core.gfxRenderer.renderer.bg3TextRenderer);
    deserializeInto(state.bgAffineRenderer0 ,core.gfxRenderer.renderer.bgAffineRenderer0);
    deserializeInto(state.bgAffineRenderer1 ,core.gfxRenderer.renderer.bgAffineRenderer1);
    deserializeInto(state.bg2MatrixRenderer ,core.gfxRenderer.renderer.bg2MatrixRenderer);
    deserializeInto(state.bg3MatrixRenderer ,core.gfxRenderer.renderer.bg3MatrixRenderer);
    deserializeInto(state.bg2FrameBufferRenderer ,core.gfxRenderer.renderer.bg2FrameBufferRenderer);
    deserializeInto(state.objRenderer ,core.gfxRenderer.renderer.objRenderer);
    deserializeInto(state.window0Renderer ,core.gfxRenderer.renderer.window0Renderer);
    deserializeInto(state.window1Renderer ,core.gfxRenderer.renderer.window1Renderer);
    deserializeInto(state.objWindowRenderer ,core.gfxRenderer.renderer.objWindowRenderer);
  // });
}

window.addEventListener("keydown", function(e) {
  if(e.which == 32) {
    IodineGUI.Iodine.setSpeed(8);
  }

  if(e.which == 76) {
    saveState();
  } else if(e.which == 68) {
    console.log("ss_" + IodineGUI.Iodine.getGameName());
    localforage.getItem("ss_" + IodineGUI.Iodine.getGameName()).then(function(state) {
      if(state != null) {
        loadState(state);
      } else {
        console.log("No state");
      }
    });
  }
});

window.addEventListener("beforeunload", function() {
  var t = +(new Date().getTime()) - IodineGUI.startTime;
  console.log(t);
  if(t > 5000) {
    saveState();
  } else {
    console.log("No state saved");
  }
});

