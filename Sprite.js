var SpriteProto = Object.create(HTMLElement.prototype);
SpriteProto.init = function(desc) {
	//PARAMS
	this.frameRate =  desc.frameRate  ? Math.max(0.001, desc.frameRate) : 1.0;
	this.frameCount = desc.frameCount ? Math.max(1, desc.frameCount) : 1;
	this.playFrame = 0;
	this.playOffset = 0;
	this.playRange = this.frameCount;
	
	this.loop = desc.loop ? desc.loop : "forever";
	this.spriteWidth = desc.width;
	this.spriteHeight = desc.height;
	
	//CALLBACKS
	this.onframe = undefined; //function(frame)
	this.onload = undefined; //function()

	if( desc.sheetImage )	this.sheet = desc.sheetImage;
	else if( desc.url ) 	this.sheet = new Image();

	this.sheet.addEventListener("load", function() {
		//DOM
		this.element = document.createElement("canvas");
		this.element.style = {};
		this.element.style.imageRendering = "pixelated";	//css3
		this.context = this.element.getContext("2d");
		this.spriteWidth  = this.element.width  = this.element.style.width  = this.spriteWidth  ? this.spriteWidth  : this.sheet.width;
		this.spriteHeight = this.element.height = this.element.style.height = this.spriteHeight ? this.spriteHeight : this.sheet.height;
		this.colCount = Math.floor(this.sheet.width / this.spriteWidth);
		this.rowCount = Math.floor(this.sheet.height / this.spriteHeight);
		document.body.appendChild(this.element);

		//CALLBACK		
		this.play();
		this.dispatchEvent(new Event('load'));

		//if( this.onload ) this.onload();
	}.bind(this));

	if( desc.url ) {
		this.sheet.src = desc.url;
	}
}

SpriteProto.step = function(timestamp) {
	var repaint = false;
	if( !this.playTime ) {
		if(this.loop == "once") this.rewind();
		this.playTime = timestamp;
		repaint = true;
	}

	if( timestamp - this.playTime > 1000.0 / this.frameRate ) {
		this.playTime = timestamp;
		this.playFrame++;
		this.playFrame %= (this.playRange * 2); //2x range for bounce looping
		repaint = true;
		
		if( this.loop == "once" && this.playFrame >= this.playRange ) {
			this.pause();
			return;
		}
	}

	if( repaint ) {
		var paintFrame;
		//bounce
		if( this.loop == "bounce") {
			if( this.playFrame < this.playRange )	paintFrame = this.playFrame;
			else 									paintFrame = this.playRange - (this.playFrame - this.playRange) - 1;
		}
		//forever & once
		else {
			paintFrame = this.playFrame % this.playRange;
		}

		var f =  paintFrame + this.playOffset;
		this.draw(f);

		//TODO: not sure if dispatching events at 60 hz is wise		
		var ev = new Event('frame');
		ev.frame = f;
		this.dispatchEvent(ev);
		//if(this.onframe) this.onframe(paintFrame + this.playOffset);		
	}
	
	this.requestID = window.requestAnimationFrame(this.step.bind(this));
}

SpriteProto.draw = function(frame) {
	frame = frame % this.frameCount;
	var x = frame % this.colCount;
	var y = (frame - x) / this.colCount;
	x *= this.spriteWidth;
	y *= this.spriteHeight;
	this.context.drawImage(this.sheet, x, y, this.spriteWidth, this.spriteHeight, 0, 0, this.element.width, this.element.height);
}

SpriteProto.play = function(start, range) {
	if( start !== undefined ) this.playOffset = start;
	if( range !== undefined ) this.playRange = range;
	this.step();
}

SpriteProto.pause = function() {
	if( this.requestID ) {
		window.cancelAnimationFrame(this.requestID);
		this.requestID = null;
		this.playTime = null;
	}
}

SpriteProto.rewind = function() {
	this.playTime = null;
	this.playFrame = 0;
	this.draw(0);
}

SpriteProto.isPlaying = function() {
	return this.requestID !== null && this.requestID !== undefined;
}

SpriteProto.createdCallback = function() {}
SpriteProto.attachedCallback = function() {
	var desc = {
		url: this.getAttribute("src"),
		width: Number.parseInt(this.getAttribute("width")),
		height: Number.parseInt(this.getAttribute("height")),
		frameCount: Number.parseInt(this.getAttribute("frame-count")),
		frameRate: Number.parseFloat(this.getAttribute("frame-rate")),
		loop: this.getAttribute("loop") //once, forever, bounce
	};

	//error checking
	var invalidErr = "Invalid <sprite-sheet> property: ";
	if( !desc.url ) console.error(invalidErr + "src [" + desc.url + "] must be a valid image url.");
	if( desc.width <= 0 || 		!Number.isInteger(desc.width) ) console.error(invalidErr + "width [" + desc.width + "] must be valid integer.");
	if( desc.height <= 0 || 	!Number.isInteger(desc.height) ) console.error(invalidErr + "height [" + desc.height + "] must be valid integer.");
	if( desc.frameCount <= 0 || !Number.isInteger(desc.frameCount) ) console.error(invalidErr + "frame-count [" + desc.frameCount + "] must be a valid integer.");
	if( desc.frameRate <= 0 ||	!Number.isFinite(desc.frameRate) ) console.error(invalidErr + "frame-rate [" + desc.frameRate + "] must be a valid float.");
	if( desc.loop ) {
		desc.loop = desc.loop.toLowerCase();
		if( desc.loop != "once" && desc.loop != "forever" && desc.loop != "bounce" ) console.error(invalidErr + "loop  [" + desc.loop + "] must be set to 'once', 'forever', or 'bounce'.");
	}
	
	this.init(desc);
	this.addEventListener("load", console.log("Loaded!"));
	this.addEventListener("frame", console.log("Drawn!"));
}
SpriteProto.detachedCallback = function() {}

/*
Object.defineProperty(SpriteProto, "_width", 		{value: 256, 			writable: true});
Object.defineProperty(SpriteProto, "_height", 		{value: 256, 			writable: true});
Object.defineProperty(SpriteProto, "_frameCount", 	{value: 1, 				writable: true});
Object.defineProperty(SpriteProto, "_frameRate", 	{value: 1, 				writable: true});
Object.defineProperty(SpriteProto, "_loop", 		{value: "forever", 		writable: true});
*/

document.registerElement('sprite-sheet', {prototype: SpriteProto});



/*
	//some play pause feature cruft

	var sprite = document.body.getElementsByTagName("sprite-sheet")[0];
	sprite.addEventListener("load", function() {
		this.element.style.border = "1px solid #0f5";
		this.element.addEventListener("contextmenu", function(e) { e.preventDefault(); } );
		this.element.addEventListener("mousedown", function(e) {
			if(e.button == 0) {
				if(this.isPlaying()) {
					this.pause();
					this.element.style.border = "1px solid #d00";
				} else {
	 				this.play();
	 				this.element.style.border = "1px solid #0f5";
	 			}
			} else if( e.button == 2) {
				this.rewind();
			}
		}.bind(this));
	}.bind(sprite));
*/