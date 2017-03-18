var Sprite  = {};
Sprite.prototype = Object.create(HTMLElement.prototype);

Object.defineProperty(Sprite.prototype, "frameCount", {
	set:function(i) { this._frameCount = i ? Math.max(1, i) : 1; },
	get:function()  { return this._frameCount; }
});
Object.defineProperty(Sprite.prototype, "frameRate", {
	set:function(f) { 
		this._frameRate = f ? Math.max(0.0001, f) : 1.0; 
		this._frameTime = 1000.0/this._frameRate; 
	},
	get:function()  { return this._frameRate; }
});
Object.defineProperty(Sprite.prototype, "loop", {
	set:function(str) {
		if(str) {
			var s = str.toLowerCase();
			if(s == "once" || s=="forever" || s == "bounce" || s=="bounceonce") this._loop = s;
		}
	},
	get:function() { return this._loop; }
});

Sprite.prototype.init = function(desc) {
	//PARAMS
	this.frameCount = desc.frameCount;
	this.frameRate = desc.frameRate;

	this.loop = desc.loop ? desc.loop : "forever";
	this.spriteWidth = desc.width;
	this.spriteHeight = desc.height;
	
	this.canvasX = desc.x === undefined ? 0 : desc.x;
	this.canvasY = desc.y === undefined ? 0 : desc.y;

	//private
	this.loopFrame = 0;
	this.playFrame = 0;
	this.playOffset = 0;
	this.playRange = this.frameCount;
	this.drawFrame = 0;

	//DOM
	if(desc.canvas) {
		this.setCanvas(desc.canvas);
		console.debug("canvas by ID");
	} else {
		var canvas = document.createElement("canvas");
		canvas.style = {};
		canvas.style.imageRendering = "pixelated"; //css3
		canvas.width = canvas.style.width = desc.width;
		canvas.height = canvas.style.height = desc.height;
		document.body.appendChild(canvas);
		this.setCanvas(canvas);
	}
	
	if( desc.sheet ) {
			this.sheet = desc.sheet;
			console.debug("sheet by ID");
	}	
	else if( desc.url ) 	this.sheet = new Image();

	if( desc.sheet && this.sheet.complete ) {
		this.setSheet(this.sheet, desc.width, desc.height, desc.frameCount);
		this.play();
		this.dispatchEvent(new Event('complete'));
		console.debug("sheet image cached");
	} else {
		this.sheet.addEventListener("load", function(desc) {
			this.setSheet(this.sheet, desc.width, desc.height, desc.frameCount);
			this.play();
			this.dispatchEvent(new Event('load'));
			this.dispatchEvent(new Event('complete'));
		}.bind(this, desc));
	}
	if( desc.url ) {
		this.sheet.src = desc.url;
	}
}

Sprite.prototype.setCanvas = function(canvas) {
	this.canvas = canvas;
	this.context = this.canvas.getContext("2d");
}

Sprite.prototype.setSheet = function(sheet, spriteWidth, spriteHeight, frameCount) {
	this.sheet = sheet;
	this.spriteWidth  = spriteWidth  ? spriteWidth  : this.sheet.width;
	this.spriteHeight = spriteHeight ? spriteHeight : this.sheet.height;
	this.frameCount = frameCount;
	this.colCount = Math.floor(this.sheet.width / this.spriteWidth);
	this.rowCount = Math.floor(this.sheet.height / this.spriteHeight);
	this.playRange = this.frameCount;
}

Sprite.prototype.step = function(timestamp) {
	var repaint = false;
	if( !this.playTime ) {
		if(this.loop == "once") this.rewind();
		this.playTime = timestamp;
		repaint = true;
	}

	if( timestamp - this.playTime > this._frameTime ) {
		this.playTime = timestamp;
		this.loopFrame++;
		this.loopFrame %= (this.playRange * 2); //2x range for bounce looping
		repaint = true;
		
		if( this.loop == "once" && this.loopFrame >= this.playRange ) {
			this.pause();
			return;
		}
	}

	if( repaint ) {
		//bounce
		if( this.loop == "bounce" || this.loop == "bounceonce" ) {
			if( this.loopFrame < this.playRange )	this.playFrame = this.loopFrame;
			else 									this.playFrame = this.playRange - (this.loopFrame - this.playRange) - 1;
		}
		//forever & once
		else {
			this.playFrame = this.loopFrame % this.playRange;
		}

		this.drawFrame =  this.playFrame + this.playOffset;
		this.draw(this.drawFrame);

		if( this.loop == "bounceonce" ) {
			if( this.loopFrame == this.playRange * 2 - 1) this.pause();
		}

		//TODO: not sure if dispatching events at 60 hz is wise		
		var ev = new Event('frame');
		ev.frame = this.drawFrame;
		this.dispatchEvent(ev);	
	}
	
	this.requestID = window.requestAnimationFrame(this.step.bind(this));
}

Sprite.prototype.draw = function(frame) {
	var x = frame % this.colCount;
	var y = (frame - x) / this.colCount;
	x *= this.spriteWidth;
	y *= this.spriteHeight;
	this.context.drawImage(this.sheet, x, y, this.spriteWidth, this.spriteHeight, this.canvasX, this.canvasY, this.spriteWidth, this.canvas.height);
}

Sprite.prototype.play = function(start, range) {
	if( start !== undefined ) this.playOffset = start;
	if( range !== undefined ) this.playRange = range;
	this.step();
}

Sprite.prototype.pause = function() {
	if( this.requestID ) {
		window.cancelAnimationFrame(this.requestID);
		this.requestID = null;
		this.playTime = null;
	}
}

Sprite.prototype.rewind = function() {
	this.playTime = null;
	this.loopFrame = 0;
	this.draw(0);
}

Sprite.prototype.isPlaying = function() {
	return this.requestID !== null && this.requestID !== undefined;
}

Sprite.prototype.createdCallback = function() {}
Sprite.prototype.attachedCallback = function() {
	var desc = {
		url: this.getAttribute("src"),
		sheet: document.getElementById(this.getAttribute("srcID")),
		
		x: this.getAttribute("canvasX"),
		y: this.getAttribute("canvasY"),
		canvas: document.getElementById(this.getAttribute("canvasID")),

		width: Number.parseInt(this.getAttribute("width")),
		height: Number.parseInt(this.getAttribute("height")),
		frameCount: Number.parseInt(this.getAttribute("frame-count")),
		frameRate: Number.parseFloat(this.getAttribute("frame-rate")),
		loop: this.getAttribute("loop") //once, forever, bounce
	};

	//Handle both <sprite-sheet> and <img> elements
	if(desc.sheet && desc.sheet.sheet)		desc.sheet = desc.sheet.sheet;
	if(desc.canvas && desc.canvas.canvas) 	desc.canvas = desc.canvas.canvas;

	//error checking
	var invalidErr = "Invalid <sprite-sheet> property: ";
	if( !desc.url && !desc.sheet ) console.error(invalidErr + "src [" + desc.url + "] must be a valid image url.");
	if( desc.width <= 0 || 		!Number.isInteger(desc.width) ) console.error(invalidErr + "width [" + desc.width + "] must be valid integer.");
	if( desc.height <= 0 || 	!Number.isInteger(desc.height) ) console.error(invalidErr + "height [" + desc.height + "] must be valid integer.");
	if( desc.frameCount <= 0 || !Number.isInteger(desc.frameCount) ) console.error(invalidErr + "frame-count [" + desc.frameCount + "] must be a valid integer.");
	if( desc.frameRate <= 0 ||	!Number.isFinite(desc.frameRate) ) console.error(invalidErr + "frame-rate [" + desc.frameRate + "] must be a valid float.");
	if( desc.loop ) {
		desc.loop = desc.loop.toLowerCase();
		if( desc.loop != "once" &&
			desc.loop != "forever" &&
			desc.loop != "bounce" &&
			desc.loop != "bounceonce" )
			console.error(invalidErr + "loop  [" + desc.loop + "] must be set to 'once', 'forever', 'bounce' or 'bounceonce'.");
	}
	
	this.init(desc);
	this.addEventListener("load", console.log("Loaded!"));
	this.addEventListener("complete", console.log("Completed!"));
	this.addEventListener("frame", console.log("Drawn!"));

	this.addPixelClickPlayback();
}
Sprite.prototype.detachedCallback = function() {}

document.registerElement('sprite-sheet', {prototype: Sprite.prototype});


Sprite.prototype.addPixelClickPlayback=function() {
	this.canvas.addEventListener("click", function(ev) {
		var x = this.drawFrame % this.colCount;
		var y = (this.drawFrame - x) / this.colCount;
		x *= this.spriteWidth;
		y *= this.spriteHeight;
		
		var px = this.context.getImageData(ev.clientX, ev.clientY, 1, 1).data;
		if(px[3] > 0) this.play();
	}.bind(this));
}

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