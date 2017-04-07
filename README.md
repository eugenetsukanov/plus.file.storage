```javascript
const { expect } = require('chai');
const fs = require('fs');
const FileStore = require('./../FileStore');

describe('FileStore', () => {

    let store;
    let storePath = __dirname + '/FileStore/store';

    beforeEach(() => store = new FileStore(storePath, { prefix: 'http://host.com/uploads/' }));
    afterEach(() => store.destroy());

    it('save file', () => {
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        return store.save('someIdTest.txt', stream)
            .then((result) => {
                expect(result).to.deep.equal({
                    "id": "someIdTest.txt",
                    "path": "http://host.com/uploads/5c/22/93/36/0e/41/5c2293360e41ffc8d1b33b442f75dc0b328f4146.txt",
                    "shortPath": "http://host.com/uploads/5c2293360e41ffc8d1b33b442f75dc0b328f4146.txt"
                })
            })
    });

    it('easy pipe read method', () => {

        let readStream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        let id = 'some:uniq:id:to-this-file.txt';

        return store.save(id, readStream)
            .then(() => fs.createWriteStream(storePath + '/pipe-test-file'))
            .then((toStream) => store.pipe(id).write(toStream))
            .then(() => fs.readFileSync(storePath + '/pipe-test-file').toString())
            .then((content) => expect(content).to.contains('tests'));
    });

    it('easy pipe write method', () => {

        let fromStream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        let id = 'some:uniq:id:to-this-file.txt';

        let testFile = storePath + '/pipe-test-file';

        return store.pipe(id).read(fromStream)
            .then(() => fs.createWriteStream(testFile))
            .then((toStream) => store.pipe(id).write(toStream))
            .then(() => fs.readFileSync(testFile).toString())
            .then((content) => expect(content).to.contains('tests'));
    });

    it('get file', () => {
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        let id = 'some:uniq:id:to-this-file.txt';

        return store.save(id, stream)
            .then((result) => store.get(id))
            .then((fromStream) => {
                return new Promise((resolve, reject) => {

                    let toStream = fs.createWriteStream(storePath + '/get-test-file');
                    fromStream.pipe(toStream);

                    fromStream
                        .on('error', reject)
                        .on('end', resolve);
                })
            })
            .then(() => fs.readFileSync(storePath + '/get-test-file').toString())
            .then((content) => expect(content).to.contains('tests'));
    });

    it('remove file', () => {
        let id = 'some:uniq:id:to-this-file.txt';
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        return store.save(id, stream)
            .then(({ id }) => store.remove(id))
            .then(() => store.get(id))
            .catch((err) => {
                expect(err.message).to.contains('no such file or directory')
            })
    });

    it('file info', () => {
        let id = 'some:uniq:id:to-this-file.txt';
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        return store.save(id, stream)
            .then(() => store.getInfo(id))
            .then((info) => {

                expect(info).to.deep.equal({
                    "clientPath": "http://host.com/uploads/9d/60/9b/c3/b7/28/9d609bc3b7284e31773c88abed372fe1df612f13.txt",
                    "humanSize": "24 B",
                    "id": "some:uniq:id:to-this-file.txt",
                    "mime": "text/plain",
                    "localPath": "9d/60/9b/c3/b7/28/9d609bc3b7284e31773c88abed372fe1df612f13.txt",
                    "shortClientPath": "http://host.com/uploads/9d609bc3b7284e31773c88abed372fe1df612f13.txt",
                    "size": 24
                });
            })
    });

    it('get file by short public path', () => {
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');
        let testFile = storePath + '/pipe-test-file';

        return store.save('someIdTest.txt', stream)
            .then(({ shortPath }) => {
                return Promise.resolve()
                    .then(() => fs.createWriteStream(testFile))
                    .then((toStream) => store.pipe(shortPath).write(toStream))
                    .then(() => fs.readFileSync(testFile).toString())
                    .then((content) => expect(content).to.contains('tests'));
            });
    });

    it('remove file by short public path', () => {
        let id = 'some:uniq:id:to-this-file.txt';
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');

        return store.save(id, stream)
            .then(({ shortPath }) => store.remove(shortPath))
            .then(() => store.get(id))
            .catch((err) => {
                expect(err.message).to.contains('no such file or directory')
            })
    });

    it('get file without extension', () => {
        let stream = fs.createReadStream(__dirname + '/FileStore/file.txt');
        let testFile = storePath + '/pipe-test-file';

        return store.save('someIdTest', stream)
            .then(({ shortPath }) => {
                return Promise.resolve()
                    .then(() => fs.createWriteStream(testFile))
                    .then((toStream) => store.pipe(shortPath).write(toStream))
                    .then(() => fs.readFileSync(testFile).toString())
                    .then((content) => expect(content).to.contains('tests'));
            });
    });

});
```