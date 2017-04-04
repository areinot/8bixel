if(!HTMLElement) var HTMLElement = {};

class Sprite extends HTMLElement {
	get frameCount()  { return this._frameCount }
	set frameCount(i) { this._frameCount = i ? Math.max(1, i) : 1; }

	get frameRate()  { return this._frameRate; }
	set frameRate(f) {
		this._frameRate = f ? Math.max(0.0001, f) : 1.0;
		this._frameTime = 1000.0/this._frameRate;
	}

	get loop()    { return this._loop; }
	set loop(str) {
		if(str) {
			var s = str.toLowerCase();
			if(s == "once" || s=="forever" || s == "bounce" || s=="bounceonce") this._loop = s;
		}
	}

	get canvas() { return this._canvas; }
	set canvas(canvas) {
		if(canvas) {
			this._canvas = canvas;
			this._context = this.canvas.getContext("2d");
		}
	}
	get context() { return this._context; }

	setSheet(image, spriteWidth, spriteHeight, frameCount) {
		this.sheet = image;
		this.spriteWidth  = spriteWidth  ? spriteWidth  : this.sheet.width;
		this.spriteHeight = spriteHeight ? spriteHeight : this.sheet.height;
		this.frameCount = frameCount;
		this.colCount = Math.floor(this.sheet.width / this.spriteWidth);
		this.rowCount = Math.floor(this.sheet.height / this.spriteHeight);
		this.playRange = this.frameCount;
	}

	constructor() {
		super();
	}

	init(desc) {
		//PARAMS
		this.frameCount = desc.frameCount;
		this.frameRate = desc.frameRate;

		this.loop = desc.loop ? desc.loop : "forever";
		this.spriteWidth = desc.width;
		this.spriteHeight = desc.height;
		
		this.canvasX = desc.x === undefined ? 0 : desc.x;
		this.canvasY = desc.y === undefined ? 0 : desc.y;

		//private
		this.playFrame = 0;
		this.playOffset = 0;
		this.playRange = this.frameCount;
		this.drawFrame = 0;

		//DOM
		if(desc.canvas) {
			this.canvas = desc.canvas;
		} else {
			var canvas = document.createElement("canvas");
			canvas.style = {};
			canvas.style.imageRendering = "pixelated"; //css3
			canvas.width = canvas.style.width = desc.width;
			canvas.height = canvas.style.height = desc.height;
			this.appendChild(canvas);
			this.canvas = canvas;
		}
		
		if( desc.image ) {
			this.sheet = desc.image;
		} 
		else if( desc.url ) {
			this.sheet = new Image();		
		}

		if( desc.image && this.sheet.complete ) { 
			//image already loaded
			this.setSheet(this.sheet, desc.width, desc.height, desc.frameCount);
			this.play();
			this.dispatchEvent(new Event('complete'));
		} else { 
			//image needs async onload callback
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

	step(timestamp) {
		var repaint = false;
		if( !this.playTime ) {
			if(this.loop == "once") this.playFrame = 0;
			this.playTime = timestamp;
			repaint = true;
		}

		if( timestamp - this.playTime > this._frameTime ) {
			this.playTime = timestamp;
			this.playFrame++;
			this.playFrame %= (this.playRange * 2); //2x range for bounce looping
			repaint = true;
		}

		if( repaint ) {
			var paintFrame;
			
			//interpret painted frame from play frame and looping
			if( this.loop == "bounce" || this.loop == "bounceonce" ) {
				//bounce
				if( this.playFrame < this.playRange )	paintFrame = this.playFrame;
				else 									paintFrame = this.playRange - (this.playFrame - this.playRange) - 1;
			} else { 
				//forever & once
				paintFrame = this.playFrame % this.playRange;
			}
			paintFrame += this.playOffset;
			this.draw(paintFrame);

			//TODO: not sure if dispatching events at 60 hz is wise or if a single callback would be cleaner
			var ev = new Event('frame');
			ev.frame = paintFrame;
			this.dispatchEvent(ev);	

			//pause play-once loop types
			if( this.loop == "once" ) {
				if(this.playFrame == this.playRange - 1) {
					this.pause();
					this.playFrame = 0;
					return;
				}
			}
			else if( this.loop == "bounceonce" ) {
				if(this.playFrame == this.playRange * 2 - 1) {
					this.pause();
					this.playFrame = 0;
					return;
				}
			}
		}
		this.requestID = window.requestAnimationFrame(this.step.bind(this));
	}

	draw(frame, context) {
		context = context || this.context;
		frame = frame % this.frameCount;
		var x = frame % this.colCount;
		var y = (frame - x) / this.colCount;
		x *= this.spriteWidth;
		y *= this.spriteHeight;
		context.clearRect(this.canvasX, this.canvasY, this.spriteWidth, this.canvas.height);
		context.drawImage(this.sheet, x, y, this.spriteWidth, this.spriteHeight, this.canvasX, this.canvasY, this.spriteWidth, this.canvas.height);
		this.drawFrame = frame;
	}

	play(start, range) {
		if( start !== undefined ) this.playOffset = start;
		if( range !== undefined ) this.playRange = range;
		this.step();
	}

	pause() {
		if( this.requestID ) {
			window.cancelAnimationFrame(this.requestID);
			this.requestID = null;
			this.playTime = null;
		}
	}

	rewind() {
		this.playTime = null;
		this.playFrame = 0;
		this.draw(this.playOffset);
	}

	lastFrame() {
		this.playTime = null;
		this.playFrame = this.playOffset + this.playRange - 1;;
		this.draw(this.playFrame);
	}

	isPlaying() {
		return this.requestID !== null && this.requestID !== undefined;
	}

	connectedCallback() {
		var desc = {
			url: this.getAttribute("src"),
			image: undefined,
			
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
		if(desc.canvas && desc.canvas.canvas) 	desc.canvas = desc.canvas.canvas;

		//error checking
		var invalidErr = "Invalid <sprite-sheet> property: ";
		if( !desc.url && !desc.image ) console.error(invalidErr + "src [" + desc.url + "] must be a valid image url.");
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
		if(this.getAttribute("element-click")) this.addClickPlayback();
		if(this.getAttribute("pixel-click"))   this.addPixelClickPlayback();
	}
	
	/// Playback GUI cruft
	addPixelClickPlayback() {
		this.selectionCanvas = document.createElement('canvas');
		this.selectionContext = this.selectionCanvas.getContext('2d');
		this.selectionCanvas.width = this.canvas.width;
		this.selectionCanvas.height = this.canvas.height;

		this.canvas.addEventListener("click", function(ev) {
			console.debug(ev.offsetX + "," + ev.offsetY);
			this.draw(this.drawFrame, this.selectionContext);
			var px = this.selectionContext.getImageData(ev.offsetX, ev.offsetY,1,1).data;
			ev.pixel = px;
			this.dispatchEvent("clickpixel", ev);

			if(px[3] > 0) {
				this.rewind();
				this.play();
				console.debug("play!");
			}
			console.debug(px);
		}.bind(this));
	}

	addClickPlayback() {
		this.canvas.style.boxShadow = "inset 0px 0px 0px 1px #0f5";
		this.canvas.addEventListener("contextmenu", function(e) { e.preventDefault(); } );
		this.canvas.addEventListener("mousedown", function(e) {
			if(e.button == 0) {
				if(this.isPlaying()) {
					this.pause();
					this.canvas.style.boxShadow = "inset 0px 0px 0px 1px #d00";
				} else {
	 				this.play();
	 				this.canvas.style.boxShadow = "inset 0px 0px 0px 1px #0f5";
	 			}
			} else if( e.button == 2) {
				this.rewind();
			}
		}.bind(this));
	}
}
var CE = customElements || customElementsRegistry;
CE.define('sprite-sheet', Sprite);
