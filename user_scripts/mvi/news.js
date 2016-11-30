var news = (function() {
	var module = {};
	var elem = null;
	var items = [];
	var index = 0;

	var info = [
		{
			"img": "user_img/download.png",
			"heading": "It's here!",
			"body": "We are finally ready to let you, dear user, try out the I53 GBA emulator. As this is still the early days of this emulator in public use, feedback is very welcome!"
		},
		{
			"img": "user_img/gdrive.png",
			"heading": "Let's begin",
			"body": "To keep the experience consistent across pc, smartphone and tablet, we are using your own Google Drive to distribute your games. Upload to Google Drive once, enjoy on all your devices."
		},
		{
			"img": "user_img/gdrive-folders.png",
			"heading": "Games, more games!",
			"body": "When connecting with your Google Drive, we will scan for a folder called 'roms' that should contain your games and a bios file. All GBA games must end with either a .gba or .zip extension."
		},
		{
			"img": "user_img/gdrive-folders.png",
			"heading": "¡Important!",
			"body": "You must have a bios file in the 'roms' directory and it must be called contain the word 'bios' somewhere in it's filename."
		},
		{
			"img": "user_img/Zip-File.png",
			"heading": "Zip support",
			"body": "If space saving is a concern, we also support your games being stored in a zip file. We'll look for a file ending with .gba inside your zip file. "
		},
		{
			"img": "user_img/download.png",
			"heading": "Let the gaming commence!",
			"body": "Connect to Google Drive by pressing the button in the Games Drawer, and let us find your games for you. We hope you enjoy I53!"
		}
	];

	module.version = JSON.stringify(info).hashCode();

	module.render = function() {
		elem = document.getElementById("info");
		var container = document.createElement("div");
		var listElem = document.createElement("ol");
		for (var i = 0; i < info.length; i++) {
			var itemElem = createListItem(info[i]);
			items.push(itemElem);
			if(i == 0) itemElem.classList.add("active");
			listElem.appendChild(itemElem);
		}

		elem.addEventListener("click", hide);

		container.appendChild(listElem);
		container.appendChild(createNextButton());
		container.appendChild(document.createElement("br"));
		elem.appendChild(container);
		elem.style.display = "block";
	}

	var hide = function(event) {
		if(event.target != elem) return;
		elem.style.display = "none";
	};

	var createNextButton = function() {
		var button = document.createElement("div");

		button.classList.add("button");
		button.innerHTML = "Next";

		button.addEventListener("click", next);

		return button;
	};

	var next = function(event) {
		if(index+1 == items.length) { elem.style.display = "none"; return; }

		items[index].classList.remove("active");
		index++;
		items[index].classList.add("active");
	};

	var createListItem = function(item) {
		var li = document.createElement("li");
		var img = document.createElement("div");
		var heading = document.createElement("h3");
		var text = document.createElement("p");

		li.appendChild(img);
		li.appendChild(heading);
		li.appendChild(text);

		img.classList.add("image");
		img.style.backgroundImage = "url('"+item.img+"')";
		heading.innerHTML = item.heading;
		text.innerHTML = item.body;

		return li;
	};

	return module;
})();