// Copyright (c) 2025 delfineonx
// Copyright (c) 2025 hansdiewurst
// This product includes "Schematic Manager" created by delfineonx.
// Licensed under the Apache License, Version 2.0 (the "License").

{

const T = {
  HEX_NIBBLE: {
    "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
    "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "a": 10, "b": 11, "c": 12, "d": 13, "e": 14, "f": 15,
    "A": 10, "B": 11, "C": 12, "D": 13, "E": 14, "F": 15
  },

  HEX_CHAR: "0123456789ABCDEF",
};

const S = {
  tasks: {},

  state: null,
  source: null,
  output: null,

  dispatcher: {
    decoder: {
      get 1() {
        const HEX_NIBBLE = T.HEX_NIBBLE;
        const state = S.state;
        const source = S.source;
        const output = S.output;

        output.name = null;
        const chunkOrigin = output.chunkOrigin = [null, null, null];
        const size = output.size = [null, null, null];
        output.chunks = [];
        output.blockdatas = [];
        output.globalOrigin = [null, null, null];

        // 4 bytes (fixed header)
        let position = state.cursor = 4;

        let byte, uint32, shift;

        // 1 byte varint: nameLength <= 63 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        position++;
        const nameEndPosition = position + ((uint32 >>> 1) ^ -(uint32 & 1));
        output.name = source.slice(position << 1, nameEndPosition << 1);
        position = nameEndPosition;

        // 1 byte varint: chunkOriginX <= 31 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        chunkOrigin[0] = (uint32 >>> 1) ^ -(uint32 & 1);
        position++;

        // 1 byte varint: chunkOriginY <= 31 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        chunkOrigin[1] = (uint32 >>> 1) ^ -(uint32 & 1);
        position++;

        // 1 byte varint: chunkOriginZ <= 31 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        chunkOrigin[2] = (uint32 >>> 1) ^ -(uint32 & 1);
        position++;

        // max: 2 bytes varint: sizeX <= 64*32 = 2048 (-> [-8192, 8191])
        uint32 = 0;
        byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
        uint32 |= (byte & 0x7F);
        position++;
        if (byte & 0x80) {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << 7;
          position++;
        }
        size[0] = (uint32 >>> 1) ^ -(uint32 & 1);

        // max: 2 bytes varint: sizeY <= 64*32 = 2048 (-> [-8192, 8191])
        uint32 = 0;
        byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
        uint32 |= (byte & 0x7F);
        position++;
        if (byte & 0x80) {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << 7;
          position++;
        }
        size[1] = (uint32 >>> 1) ^ -(uint32 & 1);

        // max: 2 bytes varint: sizeZ <= 64*32 = 2048 (-> [-8192, 8191])
        uint32 = 0;
        byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
        uint32 |= (byte & 0x7F);
        position++;
        if (byte & 0x80) {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << 7;
          position++;
        }
        size[2] = (uint32 >>> 1) ^ -(uint32 & 1);

        // max: 3 bytes varint: chunksCount <= 64^3 = 262144 (-> [-1048576, 1048575])
        uint32 = 0;
        shift = 0;
        do {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << shift;
          shift += 7;
          position++;
        } while (byte & 0x80);
        state.count = (uint32 >>> 1) ^ -(uint32 & 1);
        state.index = 0;

        state.cursor = position;

        state.subphase = 3;
        state.phase = 2;
        this[state.phase];
      },

      get 2() {
        const state = S.state;

        if (state.index < state.count) {
          do {
            this[state.subphase];
            state.index++;
          } while (state.index < state.count);
        }

        // 1 byte (end of chunks array)
        state.cursor++;

        state.phase = 5;
        this[state.phase];
      },

      get 3() {
        const HEX_NIBBLE = T.HEX_NIBBLE;
        const state = S.state;
        const source = S.source;

        let chunk = S.output.chunks[state.index];
        if (!chunk) {
          chunk = S.output.chunks[state.index] = new Int16Array(32771);
        }

        let position = state.cursor;
        let byte, uint32, shift;

        // 1 byte varint: chunkOffsetX <= 63 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        chunk[32768] = (uint32 >>> 1) ^ -(uint32 & 1);
        position++;

        // 1 byte varint: chunkOffsetY <= 63 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        chunk[32769] = (uint32 >>> 1) ^ -(uint32 & 1);
        position++;

        // 1 byte varint: chunkOffsetZ <= 63 (-> [-64, 63])
        uint32 = ((HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]]) & 0x7F;
        chunk[32770] = (uint32 >>> 1) ^ -(uint32 & 1);
        position++;

        // max: 3 bytes varint: chunkBytesCount <= (1+2)*(32^3) = 98304 (-> [-1048576, 1048575])
        uint32 = 0;
        shift = 0;
        do {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << shift;
          shift += 7;
          position++;
        } while (byte & 0x80);
        state.bytesEndPosition = position + ((uint32 >>> 1) ^ -(uint32 & 1));
        state.caret = 0;

        state.cursor = position;

        state.subphase = 4;
        this[state.subphase];
      },

      get 4() {
        const HEX_NIBBLE = T.HEX_NIBBLE;
        const state = S.state;
        const source = S.source;

        const chunk = S.output.chunks[state.index];
        const chunkEndPosition = state.bytesEndPosition;
        
        let position = state.cursor;
        let byte, shift, amount, blockId;

        if (position < chunkEndPosition) {
          do {
            // max: 3 bytes unsigned varint: amount <= 32768 (-> [0, 2097152])
            amount = 0;
            shift = 0;
            do {
              byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
              amount |= (byte & 0x7F) << shift;
              shift += 7;
              position++;
            } while (byte & 0x80);

            // max: 2 bytes unsigned varint: blockId <= 2624 (-> [0, 16384])
            blockId = 0;
            byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
            blockId |= (byte & 0x7F);
            position++;
            if (byte & 0x80) {
              byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
              blockId |= (byte & 0x7F) << 7;
              position++;
            }

            // Int16Array
            chunk.fill(blockId, state.caret, state.caret + amount);

            state.cursor = position;
            state.caret += amount;
          } while (position < chunkEndPosition);
        }

        state.subphase = 3;
      },

      get 5() {
        const HEX_NIBBLE = T.HEX_NIBBLE;
        const state = S.state;
        const source = S.source;

        let position = state.cursor;
        let byte, uint32, shift;

        // max: 3 bytes varint: blockdatasCount <= 2^20-1 (-> [-1048576, 1048575])
        uint32 = 0;
        shift = 0;
        do {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << shift;
          shift += 7;
          position++;
        } while (byte & 0x80);
        state.count = (uint32 >>> 1) ^ -(uint32 & 1);
        state.index = 0;

        state.cursor = position;

        state.subphase = 0;
        state.phase = 6;
        this[state.phase];
      },

      get 6() {
        const HEX_NIBBLE = T.HEX_NIBBLE;
        const state = S.state;
        const source = S.source;

        const blockdatas = S.output.blockdatas;
        let blockData, dataEndPosition;

        let position = state.cursor;
        let byte, uint32, shift;

        if (state.index < state.count) {
          do {
            blockData = [null, null, null, null];

            // max: 2 bytes varint: blockOffsetX <= 2047 (-> [-8192, 8191])
            uint32 = 0;
            byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
            uint32 |= (byte & 0x7F);
            position++;
            if (byte & 0x80) {
              byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
              uint32 |= (byte & 0x7F) << 7;
              position++;
            }
            blockData[0] = (uint32 >>> 1) ^ -(uint32 & 1);

            // max: 2 bytes varint: blockOffsetY <= 2047 (-> [-8192, 8191])
            uint32 = 0;
            byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
            uint32 |= (byte & 0x7F);
            position++;
            if (byte & 0x80) {
              byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
              uint32 |= (byte & 0x7F) << 7;
              position++;
            }
            blockData[1] = (uint32 >>> 1) ^ -(uint32 & 1);

            // max: 2 bytes varint: blockOffsetZ <= 2047 (-> [-8192, 8191])
            uint32 = 0;
            byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
            uint32 |= (byte & 0x7F);
            position++;
            if (byte & 0x80) {
              byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
              uint32 |= (byte & 0x7F) << 7;
              position++;
            }
            blockData[2] = (uint32 >>> 1) ^ -(uint32 & 1);

            // max: 3 bytes varint: dataBytesCount <= 2^20-1 (-> [-1048576, 1048575])
            uint32 = 0;
            shift = 0;
            do {
              byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
              uint32 |= (byte & 0x7F) << shift;
              shift += 7;
              position++;
            } while (byte & 0x80);
            dataEndPosition = position + ((uint32 >>> 1) ^ -(uint32 & 1));

            blockData[3] = source.slice(position << 1, dataEndPosition << 1);

            blockdatas[state.index] = blockData;

            state.cursor = position = dataEndPosition;
            state.index++;
          } while (state.index < state.count);
        }

        // 1 byte (end of blockdatas array)
        state.cursor += !!state.count;

        state.phase = 7;
        this[state.phase];
      },

      get 7() {
        const HEX_NIBBLE = T.HEX_NIBBLE;
        const state = S.state;
        const source = S.source;

        const globalOrigin = S.output.globalOrigin;

        let position = state.cursor;
        let byte, uint32, shift;

        // max: 3 bytes varint: abs(globalOriginX) <= 400000 (-> [-1048576, 1048575])
        uint32 = 0;
        shift = 0;
        do {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << shift;
          shift += 7;
          position++;
        } while (byte & 0x80);
        globalOrigin[0] = (uint32 >>> 1) ^ -(uint32 & 1);

        // max: 3 bytes varint: abs(globalOriginY) <= 400000 (-> [-1048576, 1048575])
        uint32 = 0;
        shift = 0;
        do {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << shift;
          shift += 7;
          position++;
        } while (byte & 0x80);
        globalOrigin[1] = (uint32 >>> 1) ^ -(uint32 & 1);

        // max: 3 bytes varint: abs(globalOriginZ) <= 400000 (-> [-1048576, 1048575])
        uint32 = 0;
        shift = 0;
        do {
          byte = (HEX_NIBBLE[source[position << 1]] << 4) | HEX_NIBBLE[source[(position << 1) + 1]];
          uint32 |= (byte & 0x7F) << shift;
          shift += 7;
          position++;
        } while (byte & 0x80);
        globalOrigin[2] = (uint32 >>> 1) ^ -(uint32 & 1);

        // 2 bytes (fixed tail)
        state.cursor = position + 2;

        state.phase = 0;
        state.finished = true;
      },
    },

    encoder: {
      get 1() {
        const HEX_CHAR = T.HEX_CHAR;
        const state = S.state;
        const source = S.source;

        const nameHex = source.name;
        const nameLengthBytes = nameHex.length >> 1;
        const chunkOrigin = source.chunkOrigin;
        const size = source.size;
        const chunksCount = source.chunks.length;

        // 4 bytes (fixed header)
        let hex = "04000000"; 

        let int32, varintByte;


        // 1 byte varint: nameLength <= 63 (-> [-64, 63])
        int32 = ((nameLengthBytes << 1) ^ (nameLengthBytes >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];
        hex += nameHex;

        // 1 byte varint: chunkOriginX <= 31 (-> [-64, 63])
        int32 = ((chunkOrigin[0] << 1) ^ (chunkOrigin[0] >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // 1 byte varint: chunkOriginY <= 31 (-> [-64, 63])
        int32 = ((chunkOrigin[1] << 1) ^ (chunkOrigin[1] >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // 1 byte varint: chunkOriginZ <= 31 (-> [-64, 63])
        int32 = ((chunkOrigin[2] << 1) ^ (chunkOrigin[2] >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // max: 2 bytes varint: sizeX <= 64*32 = 2048 (-> [-8192, 8191])
        int32 = ((size[0] << 1) ^ (size[0] >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // max: 2 bytes varint: sizeY <= 64*32 = 2048 (-> [-8192, 8191])
        int32 = ((size[1] << 1) ^ (size[1] >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // max: 2 bytes varint: sizeZ <= 64*32 = 2048 (-> [-8192, 8191])
        int32 = ((size[2] << 1) ^ (size[2] >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // max: 3 bytes varint: chunksCount <= 64^3 = 262144 (-> [-1048576, 1048575])
        int32 = ((chunksCount << 1) ^ (chunksCount >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        state.index = 0;

        S.output.hex = hex;

        state.subphase = 3;
        state.phase = 2;
        this[state.phase];
      },

      get 2() {
        const state = S.state;

        const chunksCount = S.source.chunks.length;

        if (state.index < chunksCount) {
          do {
            this[state.subphase];
            state.index++;
          } while (state.index < chunksCount);
        }

        // 1 byte (end of chunks array)
        S.output.hex += "00";

        state.phase = 5;
        this[state.phase];
      },

      get 3() {
        const HEX_CHAR = T.HEX_CHAR;
        const state = S.state;

        const chunk = S.source.chunks[state.index];

        let hex = "";
        let int32, varintByte;

        // 1 byte varint: chunkOffsetX <= 63 (-> [-64, 63])
        int32 = ((chunk[32768] << 1) ^ (chunk[32768] >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // 1 byte varint: chunkOffsetY <= 63 (-> [-64, 63])
        int32 = ((chunk[32769] << 1) ^ (chunk[32769] >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // 1 byte varint: chunkOffsetZ <= 63 (-> [-64, 63])
        int32 = ((chunk[32770] << 1) ^ (chunk[32770] >> 31)) >>> 0;
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        state.chunkHex = "";
        state.caret = 1;

        state.amount = 1;
        state.blockId = chunk[0];

        S.output.hex += hex;

        state.subphase = 4;
        this[state.subphase];
      },

      get 4() {
        const HEX_CHAR = T.HEX_CHAR;
        const state = S.state;
        
        const chunk = S.source.chunks[state.index];
        let chunkHex = state.chunkHex;

        let amount = state.amount;
        let blockId = state.blockId;
        let varintByte;

        if (state.caret < 32768) {
          do {
            if (chunk[state.caret] !== blockId) {
              // max: 3 bytes unsigned varint: amount <= 32768 (-> [0, 2097152])
              if (amount & 0xFFFFFF80) {
                varintByte = (amount & 0x7F) | 0x80;
                amount >>>= 7;
                chunkHex += HEX_CHAR[varintByte >>> 4];
                chunkHex += HEX_CHAR[varintByte & 0xF];
              }
              if (amount & 0xFFFFFF80) {
                varintByte = (amount & 0x7F) | 0x80;
                amount >>>= 7;
                chunkHex += HEX_CHAR[varintByte >>> 4];
                chunkHex += HEX_CHAR[varintByte & 0xF];
              }
              varintByte = (amount & 0x7F);
              chunkHex += HEX_CHAR[varintByte >>> 4];
              chunkHex += HEX_CHAR[varintByte & 0xF];
    
              // max: 2 bytes unsigned varint: blockId <= 2624 (-> [0, 16384])
              if (blockId & 0xFFFFFF80) {
                varintByte = (blockId & 0x7F) | 0x80;
                blockId >>>= 7;
                chunkHex += HEX_CHAR[varintByte >>> 4];
                chunkHex += HEX_CHAR[varintByte & 0xF];
              }
              varintByte = (blockId & 0x7F);
              chunkHex += HEX_CHAR[varintByte >>> 4];
              chunkHex += HEX_CHAR[varintByte & 0xF];

              amount = state.amount = 0;
            }

            state.chunkHex = chunkHex;
            amount = ++state.amount;
            state.blockId = blockId = chunk[state.caret];
            state.caret++;
          } while (state.caret < 32768);
        }

        // flush
        if (state.caret === 32768) {
          // max: 3 bytes unsigned varint: amount <= 32768 (-> [0, 2097152])
          if (amount & 0xFFFFFF80) {
            varintByte = (amount & 0x7F) | 0x80;
            amount >>>= 7;
            chunkHex += HEX_CHAR[varintByte >>> 4];
            chunkHex += HEX_CHAR[varintByte & 0xF];
          }
          if (amount & 0xFFFFFF80) {
            varintByte = (amount & 0x7F) | 0x80;
            amount >>>= 7;
            chunkHex += HEX_CHAR[varintByte >>> 4];
            chunkHex += HEX_CHAR[varintByte & 0xF];
          }
          varintByte = (amount & 0x7F);
          chunkHex += HEX_CHAR[varintByte >>> 4];
          chunkHex += HEX_CHAR[varintByte & 0xF];

          // max: 2 bytes unsigned varint: blockId <= 2612 (-> [0, 16384])
          if (blockId & 0xFFFFFF80) {
            varintByte = (blockId & 0x7F) | 0x80;
            blockId >>>= 7;
            chunkHex += HEX_CHAR[varintByte >>> 4];
            chunkHex += HEX_CHAR[varintByte & 0xF];
          }
          varintByte = (blockId & 0x7F);
          chunkHex += HEX_CHAR[varintByte >>> 4];
          chunkHex += HEX_CHAR[varintByte & 0xF];

          state.chunkHex = chunkHex;
          state.caret++;
        }

        
        // max: 3 bytes varint: chunkBytesCount <= (1+2)*32^3 = 98304 (-> [-1048576, 1048575])
        let hex = "";
        const chunkBytesCount = chunkHex.length >> 1;
        let int32 = ((chunkBytesCount << 1) ^ (chunkBytesCount >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        S.output.hex += hex + chunkHex;

        state.subphase = 3;
      },

      get 5() {
        const HEX_CHAR = T.HEX_CHAR;
        const state = S.state;

        const blockdatasCount = S.source.blockdatas.length;

        let hex = "";
        let int32, varintByte;

        // max: 3 bytes varint: blockdatasCount <= 2^20-1 (-> [-1048576, 1048575])
        int32 = ((blockdatasCount << 1) ^ (blockdatasCount >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];
        
        state.index = 0;

        S.output.hex += hex;

        state.phase = 6;
        this[state.phase];
      },

      get 6() {
        const HEX_CHAR = T.HEX_CHAR;
        const state = S.state;
        const output = S.output;

        const blockdatas = S.source.blockdatas;
        const blockdatasCount = blockdatas.length;
        let blockData, dataBytesCount;

        let hex;
        let int32, varintByte;

        if (state.index < blockdatasCount) {
          do {
            hex = "";
            blockData = blockdatas[state.index];

            // max: 2 bytes varint: blockOffsetX <= 2047 (-> [-8192, 8191])
            int32 = ((blockData[0] << 1) ^ (blockData[0] >> 31)) >>> 0;
            if (int32 & 0xFFFFFF80) {
              varintByte = (int32 & 0x7F) | 0x80;
              int32 >>>= 7;
              hex += HEX_CHAR[varintByte >>> 4];
              hex += HEX_CHAR[varintByte & 0xF];
            }
            varintByte = (int32 & 0x7F);
            hex += HEX_CHAR[varintByte >>> 4];
            hex += HEX_CHAR[varintByte & 0xF];

            // max: 2 bytes varint: blockOffsetY <= 2047 (-> [-8192, 8191])
            int32 = ((blockData[1] << 1) ^ (blockData[1] >> 31)) >>> 0;
            if (int32 & 0xFFFFFF80) {
              varintByte = (int32 & 0x7F) | 0x80;
              int32 >>>= 7;
              hex += HEX_CHAR[varintByte >>> 4];
              hex += HEX_CHAR[varintByte & 0xF];
            }
            varintByte = (int32 & 0x7F);
            hex += HEX_CHAR[varintByte >>> 4];
            hex += HEX_CHAR[varintByte & 0xF];

            // max: 2 bytes varint: blockOffsetZ <= 2047 (-> [-8192, 8191])
            int32 = ((blockData[2] << 1) ^ (blockData[2] >> 31)) >>> 0;
            if (int32 & 0xFFFFFF80) {
              varintByte = (int32 & 0x7F) | 0x80;
              int32 >>>= 7;
              hex += HEX_CHAR[varintByte >>> 4];
              hex += HEX_CHAR[varintByte & 0xF];
            }
            varintByte = (int32 & 0x7F);
            hex += HEX_CHAR[varintByte >>> 4];
            hex += HEX_CHAR[varintByte & 0xF];

            // max: 3 bytes varint: dataBytesCount <= 2^20-1 (-> [-1048576, 1048575])
            dataBytesCount = blockData[3].length >> 1;
            int32 = ((dataBytesCount << 1) ^ (dataBytesCount >> 31)) >>> 0;
            if (int32 & 0xFFFFFF80) {
              varintByte = (int32 & 0x7F) | 0x80;
              int32 >>>= 7;
              hex += HEX_CHAR[varintByte >>> 4];
              hex += HEX_CHAR[varintByte & 0xF];
            }
            if (int32 & 0xFFFFFF80) {
              varintByte = (int32 & 0x7F) | 0x80;
              int32 >>>= 7;
              hex += HEX_CHAR[varintByte >>> 4];
              hex += HEX_CHAR[varintByte & 0xF];
            }
            varintByte = (int32 & 0x7F);
            hex += HEX_CHAR[varintByte >>> 4];
            hex += HEX_CHAR[varintByte & 0xF];

            output.hex += hex + blockData[3];
            state.index++;
          } while (state.index < blockdatasCount);
        }

        if (blockdatasCount !== 0) {
          // 1 byte (end of blockdatas array)
          output.hex += "00";
        } 

        state.phase = 7;
        this[state.phase];
      },

      get 7() {
        const HEX_CHAR = T.HEX_CHAR;
        const state = S.state;
        
        const globalOrigin = S.source.globalOrigin;

        let hex = "";
        let int32, varintByte;

        // max: 3 bytes varint: abs(globalOriginX) <= 400000 (-> [-1048576, 1048575])
        int32 = ((globalOrigin[0] << 1) ^ (globalOrigin[0] >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // max: 3 bytes varint: abs(globalOriginY) <= 400000 (-> [-1048576, 1048575])
        int32 = ((globalOrigin[1] << 1) ^ (globalOrigin[1] >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // max: 3 bytes varint: abs(globalOriginZ) <= 400000 (-> [-1048576, 1048575])
        int32 = ((globalOrigin[2] << 1) ^ (globalOrigin[2] >> 31)) >>> 0;
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        if (int32 & 0xFFFFFF80) {
          varintByte = (int32 & 0x7F) | 0x80;
          int32 >>>= 7;
          hex += HEX_CHAR[varintByte >>> 4];
          hex += HEX_CHAR[varintByte & 0xF];
        }
        varintByte = (int32 & 0x7F);
        hex += HEX_CHAR[varintByte >>> 4];
        hex += HEX_CHAR[varintByte & 0xF];

        // 2 bytes (fixed tail)
        S.output.hex += hex + "0000";

        state.phase = 0;
        state.finished = true;
      },
    },
  },

  // schematicHex, taskId, { }
  // string, string, object
  toObject(source, taskId, output) {
    let state = S.tasks[taskId];
    if (!state) {
      state = S.tasks[taskId] = {
        phase: 1,
        cursor: null,
        count: null,
        index: null,
        subphase: null,
        bytesEndPosition: null,
        caret: null,
        finished: false,
      };
    }
    S.state = state;
    S.source = source;
    S.output = output;
    
    S.dispatcher.decoder[state.phase];

    if (state.finished) {
      delete S.tasks[taskId];
      S.state = null;
      S.source = null;
      S.output = null;
      return true;
    }
    return false;
  },

  // schematicObject, taskId, { hex: null }
  // object, string, object
  toHex(source, taskId, output) {
    let state = S.tasks[taskId];
    if (!state) {
      state = S.tasks[taskId] = {
        phase: 1,
        index: null,
        subphase: null,
        chunkHex: null,
        caret: null,
        amount: null,
        blockId: null,
        finished: false,
      };
    }
    S.state = state;
    S.source = source;
    S.output = output;
    
    S.dispatcher.encoder[state.phase];

    if (state.finished) {
      delete S.tasks[taskId];
      S.state = null;
      S.source = null;
      S.output = null;
      return true;
    }
    return false;
  },
};

globalThis.TABLES = T;
globalThis.SchematicManager = globalThis.SM = S;

void 0;

}
