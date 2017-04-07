const fs = require('fs-extra');
const sha1 = require('sha1');
const path = require('path');
const filesize = require('filesize');
const mime = require('mime');

module.exports = class FileStore {

    /**
     * Construct file storage.
     *
     * @param {String} path
     * @param {Object} options
     * @param {String} options.prefix
     */
    constructor(path, options = {}) {
        this.path = path;
        this.options = Object.assign({
            prefix: ''
        }, options);
    }

    /**
     * Entity of light file
     *
     * @typedef LightFile
     * @property {String} id
     * @property {String} path
     * @property {String} shortPath
     */

    /**
     * Save stream to the storage
     *
     * @param {String} id
     * @param {Object} stream
     * @returns {Promise<LightFile>}
     */
    save(id, stream) {
        return this.getPath()
            .then(() => {
                return Promise.resolve()
                    .then(() => this.getDeepInfo(id))
                    .then(({ localPath, serverPath, clientPath, serverIdBase, shortClientPath }) => {
                        return this._ensureDir(serverIdBase)
                            .then(() => {
                                return { localPath, serverPath, clientPath, shortClientPath, id }
                            });

                    });
            })
            .then(({ serverPath, clientPath, shortClientPath }) => {
                return Promise.resolve(serverPath)
                    .then((serverPath) => fs.createWriteStream(serverPath))
                    .then((writeStream) => stream.pipe(writeStream))
                    .then(() => {
                        return new Promise((resolve, reject) => {
                            stream.on('end', () => resolve());
                            stream.on('error', (err) => reject(err));
                        })
                    })
                    .then(() => {
                        return {
                            id: id,
                            path: clientPath,
                            shortPath: shortClientPath
                        }
                    })
            });

    }

    /**
     * Save stream to the storage
     *
     * @param {String} id
     * @returns {Promise<Stream>}
     */
    get(id) {
        return this.getDeepInfo(id)
            .then(({ serverPath }) => this._exists(serverPath).then(() => serverPath))
            .then((path) => fs.createReadStream(path))
    }

    /**
     * Wrapper for write and read streams
     *
     * @param {String} id
     * @returns {Object}
     */
    pipe(id) {
        return {
            write: (toStream) => this.pipeIdToStream(id, toStream),
            read: (fromStream) => this.save(id, fromStream)
        };
    }

    /**
     * It pipes file data to stream
     *
     * @param {String} id
     * @param {Stream} toStream
     * @returns {Promise}
     */
    pipeIdToStream(id, toStream) {
        return Promise.resolve()
            .then(() => this.get(id))
            .then((fromStream) => {
                return new Promise((resolve, reject) => {
                    fromStream.pipe(toStream);

                    fromStream
                        .on('error', reject)
                        .on('end', resolve);
                })
            })
    }

    /**
     * Returns path of file store
     *
     * @returns {Promise<String>}
     */
    getPath() {
        return this._ensureDir(this.path);
    }

    /**
     * Remove file by id
     *
     * @param {String} id
     * @returns {Promise}
     */
    remove(id) {
        return this.getDeepInfo(id).then(({ serverPath }) => this._remove(serverPath));
    }

    /**
     * Destroy current file store
     *
     * @returns {Promise}
     */
    destroy() {
        return this.getPath()
            .then((path) => this._remove(path));
    }

    /**
     * Entity of file info
     *
     * @typedef FileInfo
     * @property {String} id
     * @property {String} mime
     * @property {Number} size
     * @property {String} humanSize
     * @property {String} localPath
     * @property {String} clientPath
     * @property {String} shortClientPath
     */

    /**
     * Get info about file by id
     *
     * @param {String} id
     * @returns {Promise<FileInfo>}
     */
    getInfo(id) {
        return this.getDeepInfo(id)
            .then((result) => {
                result.serverPath && delete result.serverPath;
                result.serverIdBase && delete result.serverIdBase;
                return result;
            });
    }

    /**
     * Entity of deep file info
     *
     * @typedef DeepFileInfo
     * @property {String} id
     * @property {String} mime
     * @property {Number} size
     * @property {String} humanSize
     * @property {String} localPath
     * @property {String} clientPath
     * @property {String} serverPath
     * @property {String} serverIdBase
     * @property {String} shortClientPath
     */

    /**
     * Get deep file info by id
     *
     * @param {String} id
     * @returns {Promise<DeepFileInfo>}
     */
    getDeepInfo(id) {
        let storedFileName;
        let matchedPath = /([a-f0-9^\/]{40})(\.\w{1,20})?$/.exec(id);

        if (matchedPath) {
            storedFileName = matchedPath[1] + (matchedPath[2] || '');
        } else {
            storedFileName = sha1(id) + path.extname(id);
        }

        return Promise
            .resolve(this.path).then((storePath) => {
                let shortClientPath = this.options.prefix + storedFileName;

                let aPrefix = /^(\w{2})(\w{2})(\w{2})(\w{2})(\w{2})(\w{2})/i.exec(storedFileName);
                let prefixDir = aPrefix.slice(1).join('/');

                let localPath = prefixDir + '/' + storedFileName;

                let clientPath = this.options.prefix + localPath;

                let serverPath = storePath + '/' + localPath;
                let serverIdBase = storePath + '/' + prefixDir;

                return {
                    localPath,
                    clientPath,
                    serverPath,
                    serverIdBase,
                    shortClientPath,
                    id,
                    size: null,
                    humanSize: null
                };
            })
            .then((result) => {
                let serverPath = result.serverPath;
                return Promise.resolve()
                    .then(() => this._exists(serverPath))
                    .then(() => this._stat(serverPath))
                    .then(({ size }) => {
                        result.size = size;
                        result.humanSize = filesize(size);
                    })
                    .then(() => {
                        result.mime = mime.lookup(id)
                    })
                    .catch((err) => null)
                    .then(() => result)
            })
    }

    /**
     * Private method
     *
     * @param {String} path
     * @returns {Promise<String>}
     */
    _stat(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (err, result) => err ? reject(err) : resolve(result));
        })
    }

    /**
     * Private method
     *
     * @param {String} path
     * @returns {Promise<String>}
     */
    _remove(path) {
        return new Promise((resolve, reject) => {
            fs.remove(path, (err, result) => err ? reject(err) : resolve(result));
        })
    }

    /**
     * Private method
     *
     * @param {String} path
     * @returns {Promise<String>}
     */
    _ensureDir(path) {
        return new Promise((resolve, reject) => {
            fs.ensureDir(path, (err, result) => err ? reject(err) : resolve(result));
        }).then(() => path);
    }

    /**
     * Private method
     *
     * @param {String} path
     * @returns {Promise<String>}
     */
    _exists(path) {
        return new Promise((resolve, reject) => {
            fs.access(path, fs.constants.R_OK, (err) => err ? reject(err) : resolve());
        });
    }
};
