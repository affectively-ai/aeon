'use strict';
/**
 * Aeon Distributed Module
 *
 * Distributed synchronization primitives and coordination.
 *
 * Features:
 * - Sync coordination across distributed nodes
 * - Data replication with configurable consistency levels
 * - Synchronization protocol handling
 * - State reconciliation and conflict resolution
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.StateReconciler =
  exports.SyncProtocol =
  exports.ReplicationManager =
  exports.SyncCoordinator =
    void 0;
var SyncCoordinator_1 = require('./SyncCoordinator');
Object.defineProperty(exports, 'SyncCoordinator', {
  enumerable: true,
  get: function () {
    return SyncCoordinator_1.SyncCoordinator;
  },
});
var ReplicationManager_1 = require('./ReplicationManager');
Object.defineProperty(exports, 'ReplicationManager', {
  enumerable: true,
  get: function () {
    return ReplicationManager_1.ReplicationManager;
  },
});
var SyncProtocol_1 = require('./SyncProtocol');
Object.defineProperty(exports, 'SyncProtocol', {
  enumerable: true,
  get: function () {
    return SyncProtocol_1.SyncProtocol;
  },
});
var StateReconciler_1 = require('./StateReconciler');
Object.defineProperty(exports, 'StateReconciler', {
  enumerable: true,
  get: function () {
    return StateReconciler_1.StateReconciler;
  },
});
//# sourceMappingURL=index.js.map
