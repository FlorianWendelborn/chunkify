// configuration

var INPUT = 'sun.png';
var OUTPUT = 'output.png';
var THRESHOLD_R = 32;
var THRESHOLD_G = 32;
var THRESHOLD_B = 32;
var THRESHOLD_A = 255;
var OPACITY = 1;
var CELL_SIZE = 1;

// program

var fs = require('fs');
var PNG = require('png-coder').PNG;

// pixel functions

function getPixel (o, x, y) {
	var idx = (o.width * y + x) << 2;
	return [o.data[idx], o.data[idx+1], o.data[idx+2], o.data[idx+3]];
}

function setPixel (o, x, y, values) {
	var idx = (o.width * y + x) << 2;
	o.data[idx + 0] = values[0];
	o.data[idx + 1] = values[1];
	o.data[idx + 2] = values[2];
	o.data[idx + 3] = values[3];
}

// pixel field functions

function average (o, cX, cY) {
	var result = [0, 0, 0, 0];
	for (var x = 0; x < cellSize; x++) {
		for (var y = 0; y < cellSize; y++) {
			var pixel = getPixel(o, cX * cellSize + x, cY * cellSize + y);
			result[0] += pixel[0];
			result[1] += pixel[1];
			result[2] += pixel[2];
			result[3] += pixel[3];
		}
	}
	for (var i = 0; i < 4; i++) {
		result[i] = Math.floor(result[i] / (cellSize * cellSize));
	}
	return result;
}

function setCell (o, cX, cY, data) {
	for (var x = 0; x < cellSize; x++) {
		for (var y = 0; y < cellSize; y++) {
			var pixel = getPixel(o, cX * cellSize + x, cY * cellSize + y);
			pixel[0] = Math.floor(pixel[0] * (1 - OPACITY) + data[0] * OPACITY);
			pixel[1] = Math.floor(pixel[1] * (1 - OPACITY) + data[1] * OPACITY);
			pixel[2] = Math.floor(pixel[2] * (1 - OPACITY) + data[2] * OPACITY);
			pixel[3] = Math.floor(pixel[3] * (1 - OPACITY) + data[3] * OPACITY);
			setPixel(o, cX * cellSize + x, cY * cellSize + y, pixel);
		}
	}
}

// cell functions

function similar (a, b, c, d) {
	var minR = Math.min(a[0], b[0], c[0], d[0]);
	var maxR = Math.max(a[0], b[0], c[0], d[0]);
	var minG = Math.min(a[1], b[1], c[1], d[1]);
	var maxG = Math.max(a[1], b[1], c[1], d[1]);
	var minB = Math.min(a[2], b[2], c[2], d[2]);
	var maxB = Math.max(a[2], b[2], c[2], d[2]);
	var minA = Math.min(a[3], b[3], c[3], d[3]);
	var maxA = Math.max(a[3], b[3], c[3], d[3]);

	return maxR - minR < THRESHOLD_R && maxG - minG < THRESHOLD_G && maxB - minB < THRESHOLD_B && maxA - minA < THRESHOLD_A;
}

function cellAverage (a, b, c, d) {
	return [
		Math.floor((a[0] + b[0] + c[0] + d[0])/4),
		Math.floor((a[1] + b[1] + c[1] + d[1])/4),
		Math.floor((a[2] + b[2] + c[2] + d[2])/4),
		Math.floor((a[3] + b[3] + c[3] + d[3])/4)
	];
}

function possible (a, b, c, d) {
	return a && b && c && d;
}

// run

var cellSize;
fs.createReadStream(INPUT)
	.pipe(new PNG({
		filterType: 4
	}))
	.on('parsed', function () {
		console.log('image resolution ' + this.width + 'x' + this.height);

		var state, lastState;

		if (this.width === 4096) CELL_SIZE = Math.max(CELL_SIZE, 2);
		if (this.width === 8096) CELL_SIZE = Math.max(CELL_SIZE, 4);

		var i = 0;
		while (true) {
			// state transfer
			lastState = state;
			state = [];

			// calculate iteration cells
			cellSize = cellSize ? cellSize * 2 : CELL_SIZE;
			var countX = this.width / cellSize;
			var countY = this.height / cellSize;
			if (countX < 1 || countY < 1) break;

			// status
			console.log('cellSize ' + cellSize + ' resolution ' + countX + 'x' + countY);

			// iterate
			var hadPossible = false;
			for (var x = 0; x < countX; x++) {
				state[x] = [];
				for (var y = 0; y < countY; y++) {
					if (!i) {
						state[x][y] = average(this, x, y);
						setCell(this, x, y, state[x][y]);
					} else {

						// get last values

						var a = lastState[2 * x + 0][2 * y + 0];
						var b = lastState[2 * x + 0][2 * y + 1];
						var c = lastState[2 * x + 1][2 * y + 0];
						var d = lastState[2 * x + 1][2 * y + 1];

						// check similarity

						if (possible(a, b, c, d)) {
							hadPossible = true;
							if (similar(a, b, c, d)) {
								// draw merge
								state[x][y] = cellAverage(a, b, c, d);
								setCell(this, x, y, state[x][y]);
							} else {
								state[x][y] = false;
							}
						}
					}
				}
			}

			// increment iteration
			i++;
		}

		// write output
		this.pack().pipe(fs.createWriteStream(OUTPUT));
	}
);
