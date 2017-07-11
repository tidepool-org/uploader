/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 schroffl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const lzo = require('./lzo1x.js')();

// Module interface taken from the Node LZO library
// https://github.com/schroffl/node-lzo/blob/master/index.js
const errCodes = {
  '-1': 'LZO_E_ERROR',
  '-2': 'LZO_E_OUT_OF_MEMORY',
  '-3': 'LZO_E_NOT_COMPRESSIBLE',
  '-4': 'LZO_E_INPUT_OVERRUN',
  '-5': 'LZO_E_OUTPUT_OVERRUN',
  '-6': 'LZO_E_LOOKBEHIND_OVERRUN',
  '-7': 'LZO_E_EOF_NOT_FOUND',
  '-8': 'LZO_E_INPUT_NOT_CONSUMED',
  '-9': 'LZO_E_NOT_YET_IMPLEMENTED',
  '-10': 'LZO_E_INVALID_ARGUMENT',
  '-11': 'LZO_E_INVALID_ALIGNMENT',
  '-12': 'LZO_E_OUTPUT_NOT_CONSUMED',
  '-99': 'LZO_E_INTERNAL_ERROR',
  // Custom error, since LZO doesn't have a predefined one...
  '-128': 'ERR_LZO_INIT_FAILED - lzo_init() failed',
};

module.exports = {
  /**
   * Compress data with the lzo compression algorithm
   *
   * @param {Buffer} input - If the parameter is not a buffer, the function will try to convert via
   * `Buffer.from`
   *
   * @return {Buffer} The compressed data
   */
  compress: (input, length) => {
    let inputBuffer = input;
    if (!Buffer.isBuffer(input)) {
      inputBuffer = Buffer.from(input);
    }

    const state = {
      inputBuffer,
      outputBuffer: null,
    };
    const result = lzo.compress(state);
    const output = Buffer.from(state.outputBuffer);

    if (result !== 0) {
      throw new Error(`Compression failed with code: ${errCodes[result.err]}`);
    } else {
      return output.slice(0, length || (input.length + (input.length / 16) + 64 + 3));
    }
  },

  /**
   * Decompress lzo-compressed data
   *
   * @param {Buffer} input - If the parameter is not a buffer, the function will try to convert via
   * `Buffer.from`
   *
   * @return {Buffer} The decompressed data
   */
  decompress: (input, length) => {
    let inputBuffer = input;
    if (!Buffer.isBuffer(input)) {
      inputBuffer = Buffer.from(input);
    }

    const state = {
      inputBuffer,
      outputBuffer: null,
    };
    const result = lzo.decompress(state);
    const output = Buffer.from(state.outputBuffer);

    if (result !== 0) {
      throw new Error(`Decompression failed with code: ${errCodes[result.err]}`);
    } else {
      return output.slice(0, length || (input.length * 3));
    }
  },
  errors: errCodes,
};
