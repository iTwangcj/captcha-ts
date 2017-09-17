import { randomBytes } from 'crypto';
import { colors } from './colors';
import { lt } from './font';
import { SW } from './sw';

const SIZE = 5;
const NODES = 100;
const GIF_SIZE = 17646;
let LETTERS = 'abcdafahijklmnopqrstuvwxyz';

function setChars (chars: string) {
	LETTERS = chars.toString();
}

function uRandom (size) {
	return randomBytes(size);
}

function random (min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

function letter (n, pos, im, swr, s1, s2) {
	let l = im.length;
	let t = lt[n];
	let r = 200 * 16 + pos;
	let i = r;
	let sk1 = s1 + pos;
	let sk2 = s2 + pos;
	let mPos = pos;
	let row = 0;

	for (let j = 0, k = t.length; j < k; j++) {
		let p = t[j];
		if (p === -101) continue;

		if (p < 0) {
			if (p === -100) {
				r += 200;
				i = r;
				sk1 = s1 + pos;
				row++;
				continue;
			}
			i += -p;
			continue;
		}

		if (sk1 >= 200) sk1 = sk1 % 200;
		let skew = Math.floor(SW[sk1] / 16);
		sk1 += (swr[pos + i - r] & 0x1) + 1;

		if (sk2 >= 200) sk2 %= 200;
		let skeWh = Math.floor(SW[sk2] / 70);
		sk2 += swr[row] & 0x1;

		let x = i + skew * 200 + skeWh;
		mPos = Math.max(mPos, pos + i - r);

		if (x - l < 70 * 200) im[x] = p << 4;
		i++;
	}

	return mPos;
}

function line (im, swr, s1) {
	for (let x = 0, sk1 = s1; x < 199; x++) {
		if (sk1 >= 200) sk1 %= 200;
		let skew = Math.floor(SW[sk1] / 16);
		sk1 += (swr[x] & 0x3) + 1;
		let i = 200 * (45 + skew) + x;
		im[i] = 0;
		im[i + 1] = 0;
		im[i + 200] = 0;
		im[i + 201] = 0;
	}
}

function dots (im, dr) {
	for (let n = 0; n < NODES; n++) {
		let v = dr.readUInt32BE(n);
		let i = v % (200 * 67);
		im[i] = 0xff;
		im[i + 1] = 0xff;
		im[i + 2] = 0xff;
		im[i + 200] = 0xff;
		im[i + 201] = 0xff;
		im[i + 202] = 0xff;
	}
}

function blur (im) {
	for (let i = 0, y = 0; y < 68; y++) {
		for (let x = 0; x < 198; x++) {
			let c11 = im[i];
			let c12 = im[i + 1];
			let c21 = im[i + 200];
			let c22 = im[i + 201];
			im[i++] = Math.floor((c11 + c12 + c21 + c22) / 4);
		}
	}
}

function filter (im) {
	const om = Buffer.alloc(70 * 200).fill(0xff);
	let i = 0;
	let o = 0;

	for (let y = 0; y < 70; y++) {
		for (let x = 4; x < 200 - 4; x++) {
			if (im[i] > 0xf0 && im[i + 1] < 0xf0) {
				om[o] = 0;
				om[o + 1] = 0;
			} else if (im[i] < 0xf0 && im[i + 1] > 0xf0) {
				om[o] = 0;
				om[o + 1] = 0;
			}

			i++;
			o++;
		}
	}

	om.copy(im);
}

function trekCaptcha (size) {
	const rb = uRandom(size + 200 + 100 * 4 + 1 + 1);
	// const l = Buffer.alloc(size);
	let l = Buffer.alloc(size);
	const swr = Buffer.alloc(200);
	const dr = Buffer.alloc(100 * 4);
	let s1;
	let s2;

	rb.copy(l, 0, 0, size);
	rb.copy(swr, 0, size, size + 200);
	rb.copy(dr, 0, size + 200, size + 200 + 100 * 4);
	s1 = rb.readUInt8(size + 200 + 100 * 4);
	s2 = rb.readUInt8(size + 200 + 100 * 4 + 1);

	const im = Buffer.alloc(200 * 70).fill(0xff);

	s1 &= 0x7f;
	s2 &= 0x3f;

	let p = 30;

	for (let i = 0; i < size; i++) {
		l[i] %= 25;  // 求余数并赋值给l[i]
		p = letter(l[i], p, im, swr, s1, s2);
		l[i] = LETTERS.charCodeAt(l[i]);
	}

	line(im, swr, s1);
	dots(im, dr);
	// blur(im);
	// filter(im);

	return { im, l };
}

function makeGif (im, gif, style) {
	let r = style === -1 ? random(0, colors.length) : style;
	gif.fill(colors[r].replace(/\n/g, ''), 0, 13 + 48 + 10 + 1, 'ascii');

	let i = 0;
	let p = 13 + 48 + 10 + 1;
	for (let y = 0; y < 70; y++) {
		gif[p++] = 250; // Data length 5*50=250
		for (let x = 0; x < 50; x++) {
			let a = im[i] >> 4;
			let b = im[i + 1] >> 4;
			let c = im[i + 2] >> 4;
			let d = im[i + 3] >> 4;

			gif[p] = 16 | (a << 5); // bbb10000
			gif[p + 1] = (a >> 3) | 64 | (b << 7); // b10000xb
			gif[p + 2] = b >> 1; // 0000xbbb
			gif[p + 3] = 1 | (c << 1); // 00xbbbb1
			gif[p + 4] = 4 | (d << 3); // xbbbb100
			i += 4;
			p += 5;
		}
	}

	gif.fill('\x01\x11\x00;', GIF_SIZE - 4);
}

function captcha ({ size = SIZE, style = -1 } = {}) {
	const gif = Buffer.alloc(GIF_SIZE);
	const { im, l } = trekCaptcha(size);
	makeGif(im, gif, style);

	return {
		buffer: gif,
		token: l.toString()
	};
}

export {
	setChars,
	captcha
};
