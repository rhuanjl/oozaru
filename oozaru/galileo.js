/**
 *  Oozaru JavaScript game engine
 *  Copyright (c) 2015-2018, Fat Cerberus
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 *  * Neither the name of miniSphere nor the names of its contributors may be
 *    used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 *  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 *  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 *  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 *  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 *  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
**/

let
	defaultShader,
	gl = null,
	lastShader = null,
	screenCanvas;

export default
class Galileo extends null
{
	static async initialize(canvas)
	{
		screenCanvas = canvas;
		gl = screenCanvas.getContext('webgl');
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);

		let vertSource = await (await fetch('shaders/default.vert.glsl')).text();
		let fragSource = await (await fetch('shaders/default.frag.glsl')).text();
		defaultShader = new Shader(vertSource, fragSource);
	}
}

export
const ShapeType =
{
	Fan: 0,
	Lines: 1,
	LineLoop: 2,
	LineStrip: 3,
	Points: 4,
	Triangles: 5,
	TriStrip: 6,
};

export
class IBO
{
	constructor(indices)
	{
		let data = new Uint16Array(indices);
		let hwBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hwBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);

		this.hwBuffer = hwBuffer;
		this.length = indices.length;
	}
}

export
class Screen extends null
{
	static get height()
	{
		return screenCanvas.height;
	}

	static get width()
	{
		return screenCanvas.width;
	}

	static clear()
	{
		gl.clear(gl.COLOR_BUFFER_BIT
			| gl.DEPTH_BUFFER_BIT
			| gl.STENCIL_BUFFER_BIT);
	}

	static resize(width, height)
	{
		screenCanvas.width = width;
		screenCanvas.height = height;
		gl.viewport(0, 0, width, height);
	}
}

export
class Shader
{
	static get Default()
	{
		return defaultShader;
	}

	constructor(vertexSource, fragmentSource)
	{
		let hwShader = gl.createProgram();

		let vertShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertShader, vertexSource);
		gl.compileShader(vertShader);
		if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
			let message = gl.getShaderInfoLog(vertShader);
			throw new Error(`Couldn't compile vertex shader...\n${message}`);
		}

		let fragShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragShader, fragmentSource);
		gl.compileShader(fragShader);
		if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
			let message = gl.getShaderInfoLog(fragShader);
			throw new Error(`Couldn't compile fragment shader...\n${message}`);
		}

		gl.attachShader(hwShader, vertShader);
		gl.attachShader(hwShader, fragShader);
		gl.bindAttribLocation(hwShader, 0, 'al_pos');
		gl.bindAttribLocation(hwShader, 1, 'al_color');
		gl.bindAttribLocation(hwShader, 2, 'al_texcoord');
		gl.linkProgram(hwShader);
		if (!gl.getProgramParameter(hwShader, gl.LINK_STATUS)) {
			let message = gl.getProgramInfoLog(hwShader);
			throw new Error(`Couldn't link shader program...\n${message}`);
		}

		this.hwShader = hwShader;
		this.hasTextureLoc = gl.getUniformLocation(hwShader, 'al_use_tex');
		this.modelViewLoc = gl.getUniformLocation(hwShader, 'al_projview_matrix');
		this.textureLoc = gl.getUniformLocation(hwShader, 'al_tex');
	}

	draw(type, vbo, texture = null, transform = null)
	{
		if (this.hwShader !== lastShader) {
			gl.useProgram(this.hwShader);
			lastShader = this.hwShader;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo.hwBuffer);
		gl.enableVertexAttribArray(0);
		gl.enableVertexAttribArray(1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 40, 0);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 16);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 32);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture !== null ? texture.hwTexture : null);
		gl.uniform1i(this.hasTextureLoc, texture !== null ? 1 : 0);
		gl.uniform1i(this.textureLoc, 0);
		if (transform !== null) {
			gl.uniformMatrix4fv(this.modelViewLoc, false, transform.matrix);
		}
		else {
			let sX = 2 / screenCanvas.width;
			let sY = 2 / -screenCanvas.height;
			let sZ = -2 / (1.0 - -1.0);
			gl.uniformMatrix4fv(this.modelViewLoc, false, [
				sX,  0.0,  0.0, 0.0,
				0.0, sY,   0.0, 0.0,
				0.0, 0.0,  sZ,  0.0,
				-1.0, 1.0, 0.0, 1.0,
			]);
		}
		let drawMode = type === ShapeType.Fan ? gl.TRIANGLE_FAN
			: type === ShapeType.Lines ? gl.LINES
			: type === ShapeType.LineLoop ? gl.LINE_LOOP
			: type === ShapeType.LineStrip ? gl.LINE_STRIP
			: type === ShapeType.Points ? gl.POINTS
			: type === ShapeType.TriStrip ? gl.TRIANGLE_STRIP
			: gl.TRIANGLES;
		gl.drawArrays(drawMode, 0, vbo.length);
	}

	drawIndexed(type, vbo, ibo, texture = null, transform = null)
	{
		if (this.hwShader !== lastShader) {
			gl.useProgram(this.hwShader);
			lastShader = this.hwShader;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo.hwBuffer);
		gl.enableVertexAttribArray(0);
		gl.enableVertexAttribArray(1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 40, 0);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 16);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 32);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture !== null ? texture.hwTexture : null);
		gl.uniform1i(this.hasTextureLoc, texture !== null ? 1 : 0);
		gl.uniform1i(this.textureLoc, 0);
		if (transform !== null) {
			gl.uniformMatrix4fv(this.modelViewLoc, false, transform.matrix);
		}
		else {
			gl.uniformMatrix4fv(this.modelViewLoc, false, [
				1.0, 0.0, 0.0, 0.0,
				0.0, 1.0, 0.0, 0.0,
				0.0, 0.0, 1.0, 0.0,
				0.0, 0.0, 0.0, 1.0,
			]);
		}
		let drawMode = type === ShapeType.Fan ? gl.TRIANGLE_FAN
			: type === ShapeType.Lines ? gl.LINES
			: type === ShapeType.LineLoop ? gl.LINE_LOOP
			: type === ShapeType.LineStrip ? gl.LINE_STRIP
			: type === ShapeType.Points ? gl.POINTS
			: type === ShapeType.TriStrip ? gl.TRIANGLE_STRIP
			: gl.TRIANGLES;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo.hwBuffer);
		gl.drawElements(drawMode, ibo.length, gl.UNSIGNED_SHORT, 0);
	}
}

export
class Texture
{
	constructor(image)
	{
		let hwTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, hwTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		this.hwTexture = hwTexture;
		this.width = image.width;
		this.height = image.height;
	}
}

export
class Transform
{
	constructor()
	{
		this.matrix = new Float32Array(4 * 4);
		this.identity();
	}

	identity()
	{
		this.matrix.set([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0,
		]);
	}
}

export
class VBO
{
	constructor(vertices)
	{
		let data = new Float32Array(10 * vertices.length);
		for (let i = 0, len = vertices.length; i < len; ++i) {
			let vertex = vertices[i];
			if (vertex.x !== undefined)
				data[0 + i * 10] = vertex.x;
			if (vertex.y !== undefined)
				data[1 + i * 10] = vertex.y;
			data[2 + i * 10] = 0.0;
			data[3 + i * 10] = 1.0;
			if (vertex.color !== undefined) {
				data[4 + i * 10] = vertex.color.r;
				data[5 + i * 10] = vertex.color.g;
				data[6 + i * 10] = vertex.color.b;
				data[7 + i * 10] = vertex.color.a;
			}
			else {
				data[4 + i * 10] = 1.0;
				data[5 + i * 10] = 1.0;
				data[6 + i * 10] = 1.0;
				data[7 + i * 10] = 1.0;
			}
			if (vertex.u !== undefined && vertex.v !== undefined) {
				data[8 + i * 10] = vertex.u;
				data[9 + i * 10] = vertex.v;
			}
		}
		let hwBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, hwBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

		this.hwBuffer = hwBuffer;
		this.length = vertices.length;
	}
}
