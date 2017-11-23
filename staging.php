<html>
<head>
	<title>Sprite Staging</title>
	<script src="Sprite.js"></script> 
</head>

<body>
<font face="arial">
<?php
function displayImage($file) {
	echo 
	"<p>".
	"<img src='uploads/".$file."' style='width:512px; height:512px'></img>".
	"</p>";
}

function displaySprite($file, $width, $height, $rate, $count, $loop) {
	echo "<sprite-sheet src='uploads/".$_GET["file"]."'";
	echo " width=".$width;
	echo " height=".$height;
	echo " frame-count=".$count;
	echo " frame-rate=".$rate;
	echo " loop=".$loop;
	echo "></sprite-sheet>";
}

function display() {		
	$file = $_GET["file"];
	displayImage($file);
	
	$width = 1;
	$height = 1;
	$framerate = 1;
	$framecount = 1;
	$loop = "forever";

	if(isset($_GET["width"])) 		$width = 		$_GET["width"];
	if(isset($_GET["height"])) 		$height = 		$_GET["height"];
	if(isset($_GET["framecount"])) 	$framecount =	$_GET["framecount"];
	if(isset($_GET["framerate"])) 	$framerate = 	$_GET["framerate"];
	if(isset($_GET["loop"])) 		$loop =			$_GET["loop"];
	
	echo "<p><form action='staging.php' method='get' enctype='application/x-www-form-urlencoded'>";
	echo "<input type='hidden' name='file' value=".$file.">";

	echo "<b>Width:</b> <input type='number' min='1' style='width:48px' 		name='width' value=".$width.">";
	echo " x ";
	echo "<b>Height:</b> <input type='number' min='1' style='width:48px' 		name='height' value=".$height.">";
	echo "<p>";

	echo "<b>Frame Count: </b>";
	echo "<input type='number' min='1' style='width:48px' 	name='framecount' value=".$framecount.">";
	echo "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
	echo "<b>Frame Rate: </b>";
	echo "<input type='number' min='1' style='width:48px' 	name='framerate' value=".$framerate.">";
	echo "<p>";

	echo "<b>Looping:<br></b>";
	echo "<input type='radio' name='loop' value='once'";		if($loop == "once") 		{echo "checked";}	 echo "> Once<br>";
	echo "<input type='radio' name='loop' value='forever'";		if($loop == "forever") 		{echo "checked";}	 echo "> Forever<br>";
	echo "<input type='radio' name='loop' value='bounce'";		if($loop == "bounce") 		{echo "checked";}	 echo "> Bounce<br>";
	echo "<input type='radio' name='loop' value='bounceonce'";	if($loop == "bounceonce")	{echo "checked";}	 echo "> Bounce Once<p>";

	echo "<input type=submit value='Apply'>";	
	echo "</form></p>";

	displaySprite($file, $width, $height, $framerate, $framecount, $loop);	
}
?>

<?php 
	display();
?>

<script>
	var sprites = [];
	Array.prototype.filter.call( document.getElementsByTagName("sprite-sheet"), function(el) {
		this.push(new Sprite(Sprite.createDescFromProperties(el)));
	}.bind(sprites));

	Array.prototype.filter.call( document.getElementsByClassName("sprite-sheet"), function(el) {
		this.push(new Sprite(Sprite.createDescFromProperties(el)));
	}.bind(sprites));
</script>
</font>
</body>
</html>

