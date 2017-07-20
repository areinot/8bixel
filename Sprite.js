fancyMod=function(a,b) { return (a%b+b)%b; } //modulo that handles negative numbers properly, e.g. -1 % 4 = 3
fancyDefined=function(v) { return v !== undefined && v !== null; }
fancyBool=function(str) { 
	switch(str.toLowerCase()) {
		case "true": case "yes": case "1": return true;
		default: return false;
	};
}


class Sprite { //@@@ extends HTMLElement {
	constructor(desc) {
		//@@@ super(); 
		
		//Note: init is optionally separate from the constructor to better time when DOM creation and loading callbacks happen.
		//For example an oncomplete callback may want to reference "this" but constructors are run in a limbo state where "this"
		//is not yet defined.
		if(desc) this.init(desc);
	}

	/// accessors

	get frameCount() { return this._frameCount }
	set frameCount(i) { this._frameCount = i ? Math.max(1, i) : 1; }
	get frameRate() { return this._frameRate; }
	set frameRate(f) {
		this._frameRate = f ? Math.max(0.0001, f) : 1.0;
		this._frameTime = 1000.0/this._frameRate;
	}
	get loop() { return this._loop; }
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

	get pixelZoom() { return this._pixelZoom; };

	init(desc) {
		//VALIDATE
		var invalidErr = "Invalid <sprite-sheet> property: ";
		if( !desc.src && !desc.image ) console.error(invalidErr + "src [" + desc.src + "] must be a valid image url.");
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
		if( !fancyDefined(desc.parentElement) ) console.error(invalidErr + "parentElement must be a valid DOM element when configuring Sprites through javascript.");
		
		//PARAMS
		this.spriteWidth = desc.width;
		this.spriteHeight = desc.height;
		this.frameCount = desc.frameCount;	//Number of frames in the sprite sheet
		this.frameRate = desc.frameRate;	//Frames per second
		this.loop = desc.loop ? desc.loop : "forever"; //How time is converted into drawn frames
		
		this.loopDelay = desc.loopDelay !== undefined ? desc.loopDelay : 0;
		this.bounceDelay = desc.bounceDelay !== undefined ? desc.bounceDelay : 0;

		//sprite offset when drawing on a larger canvas
		this.canvasX = fancyDefined(desc.x) ? desc.x : 0;
		this.canvasY = fancyDefined(desc.y) ? desc.y : 0;

		this.drawFrame = 0;		//Last drawn sprite sheet frame [0-framecount). This is the frame currently displayed on canvas.
		this.playTick = 0; 		//Iterator for keeping track of the play loop, [0-playRange * 2)
								//Note: to implement bounce looping, playTick goes through 2x playRange frames before resetting to 0
		
		this.playOffset = fancyDefined(desc.playOffset) ? desc.playOffset : 0;	//Sprite sheet frame the play loop starts on
		this.playRange =  fancyDefined(desc.playRange)  ? desc.playRange : 0;	//Span of sprite sheet frames the play loop covers
																//Ex: A bounce loop with playRange 4 plays sheet frames 0,1,2,3,2,1
		var startPlaying = fancyDefined(desc.playing) ? desc.playing : true;
		this._playStamp = null; //private, paused if null
		this._requestID = null;
		this._playDelay = 0; //extra time to hang on this frame

		this.playOffset = Math.min(this.playOffset, this.frameCount - 1);
		this.playRange = Math.min(this.playOffset + this.playRange, this.frameCount - 1);
		this.playRange = Math.max(1, this.playRange - this.playOffset);

		//DOM
		this.element = desc.parentElement; //parent element if set through js or this if deriving from HTMLElement		
		if(desc.canvas) {
			this.canvas = desc.canvas;			
		} else {			
			var canvas = document.createElement("canvas");
			canvas.style = {};
			canvas.style.imageRendering = "pixelated"; //css3			
			canvas.width = canvas.style.width = desc.width;
			canvas.height = canvas.style.height = desc.height;

			//clipping div around canvas for the purposes of pixelated zoom
			var clip = document.createElement("div");
			clip.style = {};
			clip.style.width = canvas.width;
			clip.style.height = canvas.height;
			clip.style.overflow = "hidden";						
			clip.appendChild(canvas);

			this.element.appendChild(clip);
			canvas.clipElement = clip;			
			this.canvas = canvas;
			//this.canvas.style.mixBlendMode="darken";
		}

		//Zoom Frame		
		this._pixelZoom = { x:0, y:0, scale:1 };
		
		if( fancyDefined(desc.mouseOverZoom) && desc.mouseOverZoom > 1 ) {
			 this.addMouseOverZoom( desc.mouseOverZoom );
		}

		if( desc.image ) {
			this.sheet = desc.image;
		} 
		else if( desc.src ) {
			this.sheet = new Image();		
		}

		if( desc.image && this.sheet.complete ) { 
			//image already loaded
			this._setSheet(this.sheet, desc.width, desc.height, desc.frameCount);
			if( startPlaying )	this.play();
			else 				this.draw(this.playOffset);
			this.element.dispatchEvent(new Event('complete'));
			if(desc.oncomplete) desc.oncomplete();
		} else { 
			//image needs async onload callback
			this.sheet.addEventListener("load", function(desc) {
				this._setSheet(this.sheet, desc.width, desc.height, desc.frameCount);				
				if( startPlaying )	this.play();
				else 				this.draw(this.playOffset);
				this.element.dispatchEvent(new Event('load'));
				this.element.dispatchEvent(new Event('complete'));
				if(desc.onload) desc.onload();
				if(desc.oncomplete) desc.oncomplete();
			}.bind(this, desc));
		}
		if( desc.src ) {
			this.sheet.src = desc.src;
		}
		this.onframe = desc.onframe;
	}

	/// zoom
	setPixelZoom(x,y,scale) {
		// Zoom is handled through canvas CSS width and height (for proper pixelation),
		// a clipping div to contain the rendering, and a translation in draw().
		this._pixelZoom.x = x;
		this._pixelZoom.y = y;
		this._pixelZoom.scale = scale;
		this.canvas.style.width = this.canvas.width * scale;
		this.canvas.style.height = this.canvas.height * scale;
	}

	resetPixelZoom() {
		this._pixelZoom.x = 
		this._pixelZoom.y = 0;
		this._pixelZoom.scale = 1;
		this.canvas.style.width = this.canvas.width;
		this.canvas.style.height = this.canvas.height;
	}

	/// playback
	draw(frame, context) {
		context = context || this.context;
		frame = fancyMod(frame, this.frameCount);
		var x = frame % this.colCount;
		var y = (frame - x) / this.colCount;
		var w = this.spriteWidth;
		var h = this.spriteHeight;

		x *= this.spriteWidth;
		y *= this.spriteHeight;

		context.clearRect(
			this.canvasX, this.canvasY, 
			this.spriteWidth, this.canvas.height
		);

		context.translate(-this._pixelZoom.x, -this._pixelZoom.y);
		context.drawImage(
			this.bitmap ? this.bitmap : this.sheet,
			x, y, 
			w, h,
			this.canvasX, this.canvasY,
			this.spriteWidth, this.canvas.height);
		this.drawFrame = frame;
		context.setTransform(1, 0, 0, 1, 0, 0);
	}

	play(start, range) {
		if( start !== undefined ) this.playOffset = start;
		if( range !== undefined ) this.playRange = range;
		this._step();
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
		var df = this._frameFromTick(this.playTick);

		df = Math.max( this.drawFrame - 1, this.playOffset );
		this.draw(df);
	}

	nextFrame() {
		this.playTick = Math.min(this.playTick+1, this.playRange-1);
		var df = this._frameFromTick(this.playTick);
		
		df = Math.min( this.drawFrame + 1, this.playOffset + this.playRange - 1 );
		this.draw(df);
	}

	lastFrame() {
		this.playTick = this.playRange - 1;
		this.draw(this.playOffset + this.playTick);
	}

	isPlaying() {
		return this._requestID !== null && this._requestID !== undefined;
	}

	/// private

	_setSheet(image, spriteWidth, spriteHeight, frameCount) {
		this.sheet = image;
		this.spriteWidth  = spriteWidth  ? spriteWidth  : this.sheet.width;
		this.spriteHeight = spriteHeight ? spriteHeight : this.sheet.height;
		this.frameCount = frameCount;
		this.colCount = Math.floor(this.sheet.width / this.spriteWidth);
		this.rowCount = Math.floor(this.sheet.height / this.spriteHeight);
		this.playRange = this.frameCount;
		this.bitmap = undefined;
		
		//TODO: createImageBitmap is not supported in Safari or Edge. 
		/*
		createImageBitmap(this.sheet, 0, 0, this.sheet.width, this.sheet.height, {premultiplyAlpha:"default"}).then( function(response) { this.bitmap = response; }.bind(this));
		*/
	}

	//interpret painted frame from play tick and looping
	_frameFromTick(tick) {
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
	_boundTick(tick, flags) {
		flags.bounced = false;
		flags.looped = false;
		
		var unboundTick = tick;

		tick = fancyMod(tick, this.playRange * 2);
		if( this.loop == "bounce" || this.loop == "bounceonce" ) {
			// skip far bounce frame
			if(tick == this.playRange) { 
				flags.bounced = true;
				tick++;
			}
			// skip 0 bounce frame if looping bounce
			if(this.loop == "bounce" && tick == this.playRange*2-1) { 
				flags.looped = true;
				tick++;
			}
			tick %= this.playRange * 2;
		} 
		else {			
			flags.looped = unboundTick != 0 && fancyMod(unboundTick , this.playRange) == (this.playRange - 1);
		}
		return tick;
	}

	_step(timestamp) {
		var repaint = false;

		if( !this._playStamp ) {
			if(this.loop == "once") this.playTick = 0;
			this._playStamp = timestamp;
			repaint = true;
		}

		var loopFlags = {
			bounced:false, 
			looped:false
		};

		if( timestamp - this._playDelay - this._playStamp > this._frameTime ) {
			this._playStamp = timestamp;
			this.playTick++;
			this.playTick = this._boundTick(this.playTick, loopFlags);
			repaint = true;
		}

		if( repaint ) {
			var paintFrame = this._frameFromTick(this.playTick,);
			this.draw(paintFrame);

			//TODO: not sure if dispatching events at 60 hz is wise or if a single callback would be cleaner
			var ev = new Event('frame');
			ev.frame = paintFrame;
			this.element.dispatchEvent(ev);	
			if(this.onframe) this.onframe(paintFrame);

			// introduce delays during various looping and bouncing stages
			if( loopFlags.bounced )		this._playDelay = this.bounceDelay;
			else if( loopFlags.looped ) this._playDelay = this.loopDelay;
			else this._playDelay = 0;

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
		this._requestID = window.requestAnimationFrame(this._step.bind(this));
	}

	static createDescFromProperties(element) {
		var desc = {
			parentElement: element, //we are our own HTML Element!
			src: element.getAttribute("src"),
			image: null,
			
			x: element.getAttribute("canvasX"),
			y: element.getAttribute("canvasY"),
			canvas: document.getElementById(element.getAttribute("canvasID")),

			width: Number.parseInt(element.getAttribute("width")),
			height: Number.parseInt(element.getAttribute("height")),
			frameCount: Number.parseInt(element.getAttribute("frame-count")),
			frameRate: Number.parseFloat(element.getAttribute("frame-rate")),
			
			loop: element.getAttribute("loop"), //once, forever, bounce, default: forever
			playOffset: element.getAttribute("play-offset"),
			playRange: element.getAttribute("play-range"),
			playing: element.getAttribute("playing"), //default: true
			loopDelay: element.getAttribute("loop-delay"),
			bounceDelay : element.getAttribute("bounce-delay"),

			//callbacks
			oncomplete: null,	//function() {}
			onload: null,		//function() {}
			onframe: null,		//function(frame) {}

			mouseOverZoom : element.getAttribute("mouse-over-zoom"),
		};

		//convert to actual bool
		desc.playing = fancyDefined(desc.playing) ? fancyBool(desc.playing) : null;
		
		//Handle both <sprite-sheet> and <canvas> elements
		if(desc.canvas && desc.canvas.canvas) desc.canvas = desc.canvas.canvas;

		return desc;
	}

	//@@@ only run when we're HTML element
	connectedCallback() {		
		var desc = Sprite.createDescFromProperties(this);
		this.init(desc);
		//this.addEventListener("load", console.log("Loaded!"));
		//this.addEventListener("complete", console.log("Completed!"));
		//this.addEventListener("frame", console.log("Drawn!"));
		if(this.getAttribute("element-click")) this.addClickPlayback();
		if(this.getAttribute("pixel-click"))   this.addPixelClickPlayback();
	}

	/// DEBUG: Playback GUI cruft
	addPixelClickPlayback() {
		this.selectionCanvas = document.createElement('canvas');
		this.selectionContext = this.selectionCanvas.getContext('2d');
		this.selectionCanvas.width = this.canvas.width;
		this.selectionCanvas.height = this.canvas.height;

		//TODO: should these be this.canvas or this.element listeners?
		this.canvas.addEventListener("click", function(ev) {
			console.debug(ev.offsetX + "," + ev.offsetY);
			this.draw(this.drawFrame, this.selectionContext);
			var px = this.selectionContext.getImageData(ev.offsetX, ev.offsetY,1,1).data;
			ev.pixel = px;
			this.element.dispatchEvent("clickpixel", ev);

			if(px[3] > 0) {
				this.firstFrame();
				this.play();
				console.debug("pixel click play!");
			}
			console.debug(px);
		}.bind(this));
	}

	addClickPlayback() {
		//TODO: should these be this.canvas or this.element listeners and styles?
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

	addMouseOverZoom(scale) {
		var moveFunc = function(e) {			
			var invScale = 1.0/scale;
			
			var rect = this.canvas.getBoundingClientRect();			
			var sw = this.spriteWidth;
			var sh = this.spriteHeight;
			var sx = e.clientX - rect.left;
			var sy = e.clientY - rect.top;

			sx -= invScale * sw * 0.5;
			sy -= invScale * sh * 0.5;

			sx = Math.max(0, sx);
			sx = Math.min(sx, sw - invScale * sw);
			
			sy = Math.max(0, sy);
			sy = Math.min(sy, sh - invScale * sh);

			sx = Math.floor(0.5 + sx);
			sy = Math.floor(0.5 + sy);
		
			this.setPixelZoom(sx, sy, scale);			
			this.draw(this.drawFrame);
		}.bind(this);
		this.canvas.addEventListener("mousemove", moveFunc,{passive:true});
		this.canvas.addEventListener("touchmove", moveFunc,{passive:true});

		this.canvas.addEventListener("mouseleave", function(e) {
			this.resetPixelZoom();
			this.draw(this.drawFrame);
		}.bind(this));
	}
}

Sprite.initDOM = function() {
	var sprites = [];
	Array.prototype.filter.call( document.getElementsByTagName("sprite-sheet"), function(el) {
		this.push(new Sprite(Sprite.createDescFromProperties(el)));
	}.bind(sprites));

	Array.prototype.filter.call( document.getElementsByClassName("sprite-sheet"), function(el) {
		this.push(new Sprite(Sprite.createDescFromProperties(el)));
	}.bind(sprites));

	return sprites;
}


/*
//@@@ 
if(fancyDefined(customElements)) {
	class SpriteSheetTag extends Sprite {
		constructor() {
			super();
		}
	}
	var CE = customElements || customElementRegistry;
	CE.define('sprite-sheet', SpriteSheetTag);
}
*/
