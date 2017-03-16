Sprite = function(desc) {
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
		this.draw(0);
		if( this.onload ) this.onload();
	}.bind(this));

	if( desc.url ) {
		this.sheet.src = desc.url;
	}
}

Sprite.prototype.step = function(timestamp) {
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
		this.draw( paintFrame + this.playOffset) ;
		if(this.onframe) this.onframe(paintFrame + this.playOffset);
	}
	
	this.requestID = window.requestAnimationFrame(this.step.bind(this));
}

Sprite.prototype.draw = function(frame) {
	frame = frame % this.frameCount;
	var x = frame % this.colCount;
	var y = (frame - x) / this.colCount;
	x *= this.spriteWidth;
	y *= this.spriteHeight;
	this.context.drawImage(this.sheet, x, y, this.spriteWidth, this.spriteHeight, 0, 0, this.element.width, this.element.height);
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
	this.playFrame = 0;
	this.draw(0);
}

Sprite.prototype.isPlaying = function() {
	return this.requestID !== null && this.requestID !== undefined;
}



