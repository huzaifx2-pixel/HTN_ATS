"use strict";

const { EventEmitter } = require("node:events");

const limit = 9999;
EventEmitter.defaultMaxListeners = limit;

if (typeof process.setMaxListeners === "function") {
  process.setMaxListeners(limit);
}
