const handler = {
  get(_target: any, prop: string) {
    if (prop === 'getConstants') return () => ({});
    if (prop === 'addListener') return () => {};
    if (prop === 'removeListeners') return () => {};
    if (prop === 'installTurboModule') return () => false;
    return () => {};
  },
};

const mockModule = new Proxy({}, handler);

try {
  const TurboModuleRegistry = require('react-native/Libraries/TurboModule/TurboModuleRegistry');
  if (TurboModuleRegistry) {
    const origGet = TurboModuleRegistry.get;
    if (origGet) {
      TurboModuleRegistry.get = function (name: string) {
        try {
          return origGet.call(TurboModuleRegistry, name) ?? mockModule;
        } catch {
          return mockModule;
        }
      };
    }
    const origGetEnforcing = TurboModuleRegistry.getEnforcing;
    if (origGetEnforcing) {
      TurboModuleRegistry.getEnforcing = function (name: string) {
        try {
          return origGetEnforcing.call(TurboModuleRegistry, name) ?? mockModule;
        } catch {
          return mockModule;
        }
      };
    }
  }
} catch (_) {}

export {};
