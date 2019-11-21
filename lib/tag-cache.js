let cache = {};

function hasTagCached(tag) {
  if (!tag)
    tag = '__ALL';
  return cache.hasOwnProperty(tag);
}

function getTagCache(tag) {
  if (!tag)
    tag = '__ALL';
  return cache[tag];
}

function setTagCache(tag, hash) {
  if (!tag)
    tag = '__ALL';
  cache[tag] = hash;
}

function unsetTagCache(tag) {
  delete cache[tag];
}

function getCache() {
  return cache;
}

function setCache(newCache) {
  cache = newCache;
}

module.exports = {getCache, setCache, hasTagCached, getTagCache, setTagCache, unsetTagCache};
