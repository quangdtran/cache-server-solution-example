const mongoose = require('mongoose');
const util = require('util');
const redis = require('redis');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);

// clear all cache data
// client.flushall();

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  // console.log('options.key: ',options.key);
  this.hashKey = JSON.stringify(options.key || '');
  return this;
};

mongoose.Query.prototype.exec = async function () {
  // console.log('Running Exec Function...');
  if (!this.useCache) {
    return await exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign(
      {},
      this.getQuery(),
      {
        collection: this.mongooseCollection.name,
      },
    ),
  );
  
  const cacheValue = await client.hget(this.hashKey, key);
  if (cacheValue) {
    // to get a plan object or an array plan object in mongoose
    const result = JSON.parse(cacheValue);
    // console.log(result)
    return Array.isArray(result)
    ? result.map(doc => new this.model(doc))
    : new this.model(result);
  }

  const result = await exec.apply(this, arguments);
  client.hset(this.hashKey, key, JSON.stringify(result));
  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};