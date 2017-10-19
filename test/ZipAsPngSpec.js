'use strict';

const fs = require('fs')
const co = require('co');
const thunkify = require('thunkify')
const zipaspng = require('../src/ZipAsPng.js');

const readFile = thunkify(fs.readFile);

describe('ZipAsPngSpec', () => {

  it('disguise sucess', (done) => {
    co(function*() {
      yield zipaspng(
          './test/assets/hoge.zip',
          './test/assets/test.png',
          '/tmp/temp.zip.png');

      // 出力ファイルを読み込む
      const outData = yield readFile('/tmp/temp.zip.png');
      const outBuff = Buffer.from(outData, 'binary');

      // 正解データを読み込む
      const expectedData = yield readFile('./test/assets/output.zip.png');
      const expectedBuff = Buffer.from(expectedData, 'binary');

      // 一致チェック
      expect(outBuff.equals(expectedBuff)).toBeTruthy();
      done();

    }).catch((err) => {
      console.log(err);
      expect(err).toBeUndefined(); // fail();
      done();
    });
  });

  it('disguise error: contains EOCD', (done) => {
    zipaspng(
        './test/assets/hoge.zip',
        './test/assets/output.zip.png', // point!
        '/tmp/temp.zip.png')
      .then((data) => {
        expect(1).toBe(0); // fail();
        done();
      }).catch((err) => {
        console.log(err);
        done();
      });
  });

  it('disguise error: invalid png header', (done) => {
    zipaspng(
        './test/assets/hoge.zip',
        './test/assets/hoge.zip', // point!
        '/tmp/temp.zip.png')
      .then((data) => {
        expect(1).toBe(0); // fail();
        done();
      }).catch((err) => {
        console.log(err);
        done();
      });
  });

  it('disguise error: EOCD not found', (done) => {
    zipaspng(
        './test/assets/test.png', // point!
        './test/assets/test.png',
        '/tmp/temp.zip.png')
      .then((data) => {
        expect(1).toBe(0); // fail();
        done();
      }).catch((err) => {
        console.log(err);
        done();
      });
  });

});

