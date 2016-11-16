var currentClass = "";
svg = document.getElementsByTagName('svg')[0];
color = document.getElementsByClassName('color');
for (var i = 0; i < color.length; i++) {
	color[i].addEventListener('mouseover', function(){
		svg.className.baseVal = this.classList[1];
	},false)
	color[i].addEventListener('mouseout', function(){
		svg.className.baseVal = currentClass;
	},false)
	color[i].addEventListener('click', function(){
		currentClass = this.classList[1];
		if (document.getElementsByClassName('active')[0]) document.getElementsByClassName('active')[0].classList.remove("active");
		this.classList.add("active");
	},false)
};
onkeydown = onkeyup = function(e){
	e = e || event;
	k = e.keyCode || e.charCode;
	b = keyPress(k);
	switch(keyPress(k)) {
		case "a" :
		case "b":
		case "start":
		case "select":
		document.getElementById('button_'+b).style.strokeWidth = (e.type == 'keydown') ? "2" : "0";
		break;
		case "r":
		case "l":
		document.getElementById('button_'+b).style.transform = "translateY("+((e.type == 'keydown') ? "3" : "0")+"px)";
		break;
		case "up":
		case "right":
		case "bottom":
		case "left":
		document.getElementById('pad').style.strokeWidth = (e.type == 'keydown') ? "2" : "0";
		document.getElementById('pad').style.stroke = "url(#shadow_"+b+")";
		break;
	} 
}
function keyPress(k) {
	var i = ["a", "b", "r", "l", "start", "select", "up", "right", "bottom", "left"];
	var j = [75, 74, 73, 85, 89, 72, 38, 39, 40, 37];
	return (j.indexOf(k) !== -1) ? i[j.indexOf(k)] : false;
}