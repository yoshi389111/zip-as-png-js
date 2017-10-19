// ZipAsPng.js
// Copyright (C) 2017, SATO_Yoshiyuki
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php
'use strict';

const fs = require('fs');
const co = require('co');
const thunkify = require('thunkify');
const CRC32 = require('crc-32');

const readFile = thunkify(fs.readFile);
const writeFile = thunkify(fs.writeFile);

// PNGヘッダとIHDRの前半部分
const HEAD_PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const SIZE_PNG_HEAD_IHDR = 8 + 4 + 4 + 0x0d + 4; // PNGヘッダ+IHDRのサイズ

const SIG_CEN = 0x02014b50; // CENのシグネチャ
const SIG_EOCD = Buffer.from('504b0506', 'hex'); // EOCDのシグネチャ
const SIZE_ZIP_CEN = 46; // CENの固定長部分のサイズ
const ZIP_ENDSIZ = 12; // EOCD内のCENの全体長のoffset
const ZIP_ENDOFF = 16; // EOCD内のCENのオフセットのoffset
const ZIP_CENNAM = 28; // CEN内のファイル名サイズのoffset
const ZIP_CENEXT = 30; // CEN内の拡張情報サイズのoffset
const ZIP_CENCOM = 32; // CEN内のコメントサイズのoffset
const ZIP_CENOFF = 42; // CEN内のLOCのoffset

// ZIPコンテナ格納時の補正するoffset
const OFFSET_ZIP = SIZE_PNG_HEAD_IHDR + 4 + 4;

/**
 * disguise zip to png
 * @param {String} zipFile - Zip file path
 * @param {String} pngFile - Png file path
 * @param {String} outFile - Output file path
 */
module.exports = (zipFile, pngFile, outFile) => {

  return co(function*() {
    // ZIPファイルを読み込む
    const zipData = yield readFile(zipFile);
    const zipBuff = Buffer.from(zipData, 'binary');

    // PNGファイルを読み込む
    const pngData = yield readFile(pngFile);
    const pngBuff = Buffer.from(pngData, 'binary');

    // PNGファイルのヘッダ+IHDR前半チェック
    if (!HEAD_PNG.equals(pngBuff.slice(0, HEAD_PNG.length)))
      throw new Error('Invalid PNG Header');

    // PNGにEOCDが含まれていないことをチェック
    if (pngBuff.lastIndexOf(SIG_EOCD) != -1)
      throw new Error('contains EOCD in PNG');

    // ZIPファイルのEOCDを探す
    const posEocd = zipBuff.lastIndexOf(SIG_EOCD);
    if (posEocd === -1)
      throw new Error('SIG_EOCD not found');

    // ZIPファイルのCENを探す
    const posCen = zipBuff.readInt32LE(posEocd + ZIP_ENDOFF);
    if (posEocd <= posCen)
      throw new Error('invalid order CEN and EOCD');
    if (SIG_CEN !== zipBuff.readInt32LE(posCen))
      throw new Error('SIG_CEN not found');

    // CENの全体長を求める
    const sizeCen = zipBuff.readInt32LE(posEocd + ZIP_ENDSIZ);

    // PNGヘッダ + IHDRチャンク
    const outBuff1 = pngBuff.slice(0, SIZE_PNG_HEAD_IHDR);

    // ZIPコンテナの長さ・チャンク名
    const outBuff2 = Buffer.alloc(8);
    outBuff2.writeInt32BE(zipBuff.length, 0);
    outBuff2.write('ziPc', 4, 4, 'ascii');

    // ZIPファイル
    // const outBuff3 = Buffer.from(zipBuff);
    const outBuff3 = zipBuff;

    // CENの中のLOCのオフセットを書き換える
    for (let size = 0; size < sizeCen;) {
      const offsetLoc = outBuff3.readInt32LE(posCen + size + ZIP_CENOFF);
      outBuff3.writeInt32LE(offsetLoc + OFFSET_ZIP, posCen + size + ZIP_CENOFF);
      size += SIZE_ZIP_CEN +
          outBuff3.readInt32LE(posCen + size + ZIP_CENNAM) +
          outBuff3.readInt32LE(posCen + size + ZIP_CENEXT) +
          outBuff3.readInt32LE(posCen + size + ZIP_CENCOM);
    }

    // EOCDの中のCENのオフセットを書き換える
    outBuff3.writeInt32LE(posCen + OFFSET_ZIP, posEocd + ZIP_ENDOFF);

    // ZIPコンテナのCRCを出力
    const crc1 = CRC32.buf(outBuff2.slice(4, 8)); // チャック名
    const crc2 = CRC32.buf(outBuff3, crc1); // チャンクデータ
    const outBuff4 = Buffer.alloc(4);
    outBuff4.writeInt32BE(crc2, 0);

    // PNGのIHDRチャンクより
    const outBuff5 = pngBuff.slice(SIZE_PNG_HEAD_IHDR);

    // 結合
    const outBuff = Buffer.concat([outBuff1, outBuff2, outBuff3, outBuff4, outBuff5]);

    // ファイル出力
    yield writeFile(outFile, outBuff);
  });

};
