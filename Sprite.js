if(!HTMLElement) var HTMLElement = {};


fancyMod=function(a,b) { return (a%b+b)%b; } //modulo that handles negative numbers properly, e.g. -1 % 4 = 3
fancyDefined=function(v) { return v !== undefined && v !== null; }
fancyBool=function(str) { 
	switch(str.toLowerCase()) {
		case "true": case "yes": case "1": return true;
		default: return false;
	};
}


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
		//VALIDATE
		var invalidErr = "Invalid <sprite-sheet> property: ";
		if( !desc.url && !desc.image ) console.error(invalidErr + "src [" + desc.url + "] must be a valid image url.");
		if( !fancyDefined(desc.width) || 	desc.width <= 0 || 		!Number.isInteger(desc.width) )		console.error(invalidErr + "width [" + desc.width + "] must be positive integer.");
		if( !fancyDefined(desc.height) || 	desc.height <= 0 || 	!Number.isInteger(desc.height) )	console.error(invalidErr + "height [" + desc.height + "] must be positive integer.");
		if( !fancyDefined(desc.frameCount)|| desc.frameCount <= 0|| !Number.isInteger(desc.frameCount))	console.error(invalidErr + "frame-count [" + desc.frameCount + "] must be a positive integer.");
		if( !fancyDefined(desc.frameRate) || desc.frameRate <= 0 ||	!Number.isFinite(desc.frameRate) )	console.error(invalidErr + "frame-rate [" + desc.frameRate + "] must be a positive float.");
		if( fancyDefined(desc.loop) ) {
			var loopstr = desc.loop.toLowerCase();
			if( loopstr != "once" &&
				loopstr != "forever" &&
				loopstr != "bounce" &&
				loopstr != "bounceonce" )
				console.error(invalidErr + "loop  [" + desc.loop + "] must be set to 'once', 'forever', 'bounce' or 'bounceonce'.");
		}
		
		//PARAMS
		this.spriteWidth = desc.width;
		this.spriteHeight = desc.height;
		this.frameCount = desc.frameCount;	//Number of frames in the sprite sheet
		this.frameRate = desc.frameRate;	//Frames per second
		this.loop = desc.loop ? desc.loop : "forever"; //How time is converted into drawn frames

		//sprite offset when drawing on a larger canvas
		this.canvasX = fancyDefined(desc.x) ? 0 : desc.x;
		this.canvasY = fancyDefined(desc.y) ? 0 : desc.y;

		this.drawFrame = 0;		//Last drawn sprite sheet frame [0-framecount). This is the frame currently displayed on canvas.
		this.playTick = 0; 	//Iterator for keeping track of the play loop, [0-playRange * 2)
								//Note: to implement bounce looping, playTick goes through 2x playRange frames before resetting to 0
		
		this.playOffset = fancyDefined(desc.playOffset) ? 0 : desc.playOffset;	//Sprite sheet frame the play loop starts on
		this.playRange =  fancyDefined(desc.playRange)  ? 0 : desc.playRange;	//Span of sprite sheet frames the play loop covers
																//Ex: A bounce loop with playRange 4 plays sheet frames 0,1,2,3,2,1
		var startPlaying = fancyDefined(desc.playing) ? fancyBool(desc.playing) : true;
		this._playStamp = null; //private, paused if null
		this._requestID = null;

		this.playOffset = Math.min(desc.playOffset, this.frameCount - 1);
		this.playRange = Math.min(this.playOffset + desc.playRange, this.frameCount - 1);
		this.playRange = Math.max(1, this.playRange - this.playOffset);

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
			if( startPlaying )	this.play();
			else 				this.draw(this.playOffset);
			this.dispatchEvent(new Event('complete'));
		} else { 
			//image needs async onload callback
			this.sheet.addEventListener("load", function(desc) {
				this.setSheet(this.sheet, desc.width, desc.height, desc.frameCount);
				if( startPlaying )	this.play();
				else 				this.draw(this.playOffset);
				this.dispatchEvent(new Event('load'));
				this.dispatchEvent(new Event('complete'));
			}.bind(this, desc));
		}
		if( desc.url ) {
			this.sheet.src = desc.url;
		}
	}

	//interpret painted frame from play tick and looping
	computeDrawFrame(tick) {
		var paintFrame;
		if( this.loop == "bounce" || this.loop == "bounceonce" ) {
			//bounce
			tick %= this.playRange * 2;
			if( tick < this.playRange )	paintFrame = tick;
			else 						paintFrame = this.playRange - (tick - this.playRange) - 1;
		} else { 
			//forever & once
			paintFrame = tick % this.playRange;
		}
		return paintFrame + this.playOffset;
	}

	//constrain playTick to playRange*2, skip any duplicate frames during bounces
	boundPlayTick(tick) {
		tick = fancyMod(tick, this.playRange * 2); 
		if( this.loop == "bounce" || this.loop == "bounceonce" ) {
			// skip far bounce frame
			if(tick == this.playRange) { 
				tick++;
			}
			// skip 0 bounce frame if looping bounce
			if(this.loop == "bounce" && tick == this.playRange*2-1) { 
				tick++;
			}
			tick %= this.playRange * 2;
		}
		return tick;
	}

	step(timestamp) {
		var repaint = false;
		if( !this._playStamp ) {
			if(this.loop == "once") this.playTick = 0;
			this._playStamp = timestamp;
			repaint = true;
		}

		if( timestamp - this._playStamp > this._frameTime ) {
			this._playStamp = timestamp;
			this.playTick++;
			this.playTick = this.boundPlayTick(this.playTick);
			repaint = true;
		}

		if( repaint ) {
			var paintFrame = this.computeDrawFrame( this.playTick );
			this.draw(paintFrame);
				
			//TODO: not sure if dispatching events at 60 hz is wise or if a single callback would be cleaner
			var ev = new Event('frame');
			ev.frame = paintFrame;
			this.dispatchEvent(ev);	

			//pause play-once loop types
			if( this.loop == "once" ) {
				if(this.playTick == this.playRange - 1) {
					this.pause();
					this.playTick = 0;
					return;
				}
			}
			else if( this.loop == "bounceonce" ) {
				if(this.playTick == this.playRange * 2 - 1) {
					this.pause();
					this.playTick = 0;
					return;
				}
			}
		}
		this._requestID = window.requestAnimationFrame(this.step.bind(this));
	}

	draw(frame, context) {
		context = context || this.context;
		frame = fancyMod(frame, this.frameCount);
		var x = frame % this.colCount;
		var y = (frame - x) / this.colCount;
		x *= this.spriteWidth;
		y *= this.spriteHeight;
		context.clearRect(
			this.canvasX, this.canvasY, 
			this.spriteWidth, this.canvas.height
		);
		context.drawImage(
			this.sheet,
			x, y, 
			this.spriteWidth, this.spriteHeight,
			this.canvasX, this.canvasY,
			this.spriteWidth, this.canvas.height);
		this.drawFrame = frame;
	}

	play(start, range) {
		if( start !== undefined ) this.playOffset = start;
		if( range !== undefined ) this.playRange = range;
		this.step();
	}

	pause() {
		if( this._requestID ) {
			window.cancelAnimationFrame(this._requestID);
			this._requestID = null;
			this._playStamp = null;
		}
	}

	firstFrame() {
		this.playTick = 0;
		this.draw(this.playOffset);
	}

	previousFrame() {
		this.playTick = Math.max(0.0, this.playTick-1);
		this.playTick = Math.min(this.playTick, this.playRange-1);
		var df = this.computeDrawFrame(this.playTick);
		this.draw(df);
	}

	nextFrame() {
		this.playTick = Math.min(this.playTick+1, this.playRange-1);
		var df = this.computeDrawFrame(this.playTick);
		this.draw(df);
	}

	lastFrame() {
		this.playTick = this.playRange - 1;
		this.draw(this.playOffset + this.playTick);
	}

	isPlaying() {
		return this._requestID !== null && this._requestID !== undefined;
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
			
			loop: this.getAttribute("loop"), //once, forever, bounce, default: forever
			playOffset: this.getAttribute("play-offset"),
			playRange: this.getAttribute("play-range"),
			playing: this.getAttribute("playing"), //default: true
		};

		//Handle both <sprite-sheet> and <canvas> elements
		if(desc.canvas && desc.canvas.canvas) desc.canvas = desc.canvas.canvas;
		
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
				this.firstFrame();
				this.play();
				console.debug("pixel click play!");
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
	 				console.debug("sprite click play!");
	 				this.canvas.style.boxShadow = "inset 0px 0px 0px 1px #0f5";
	 			}
			} else if(e.button == 2) {
				this.firstFrame();
			}
		}.bind(this));
	}
}
var CE = customElements || customElementsRegistry;
CE.define('sprite-sheet', Sprite);
