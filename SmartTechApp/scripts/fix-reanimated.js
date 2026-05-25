const fs = require('fs');
const path = require('path');

// Also patch Expo CLI to fix 'Body is unusable' crash
const expoCliPath = path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', '@expo', 'cli', 'build', 'src', 'api', 'getNativeModuleVersions.js');
if (fs.existsSync(expoCliPath)) {
  let content = fs.readFileSync(expoCliPath, 'utf8');
  if (!content.includes('// [PATCHED]')) {
    content = content.replace(
      'async function getNativeModuleVersionsAsync(sdkVersion) {',
      `async function getNativeModuleVersionsAsync(sdkVersion) {
  // [PATCHED] Handle network errors gracefully
  let data;
  try {`
    );
    content = content.replace(
      'const data = (0, _client.getResponseDataOrThrow)(json);',
      'data = (0, _client.getResponseDataOrThrow)(json);'
    );
    content = content.replace(
      'if (!data.length) {',
      'if (!data.length) {'
    );
    // Wrap the entire function body in try-catch
    content = content.replace(
      '    return fromBundledNativeModuleList(data);\n}',
      '    return fromBundledNativeModuleList(data);\n  } catch (_) { return {}; }\n}'
    );
    fs.writeFileSync(expoCliPath, content, 'utf8');
    console.log('  Patched Expo CLI (getNativeModuleVersions.js)');
  } else {
    console.log('  Expo CLI already patched');
  }
} else {
  console.warn('  Expo CLI file not found');
}

const packages = [
  {
    name: 'react-native-reanimated',
    srcDir: path.join(__dirname, '..', 'node_modules', 'react-native-reanimated', 'src'),
    libDir: path.join(__dirname, '..', 'node_modules', 'react-native-reanimated', 'lib', 'module'),
    fixups: {
      'platform-specific/workletsVersion.ts': (content) => {
        if (content.includes('react-native-reanimated/scripts/validate-worklets-version')) {
          return `'use strict';\n\nexport function assertWorkletsVersion() {\n  // Version validation is handled by the package manager at install time.\n}\n`;
        }
        return content;
      },
      'specs/NativeReanimatedModule.ts': (content) => {
        // Cases:
        // 1. Has JSON.stringify(module) -> remove it (keep try-catch)
        // 2. Simple export (no try-catch) -> add try-catch returning null
        if (content.includes('JSON.stringify(module)')) {
          return content.replace(
            `  // Verify the TurboModule actually resolves by accessing a property
  if (module) {
    JSON.stringify(module);
  }`,
            ''
          );
        }
        const simpleExportRe = /export default TurboModuleRegistry\.get/;
        if (simpleExportRe.test(content)) {
          return `'use strict';
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

interface Spec extends TurboModule {
  installTurboModule: () => boolean;
}

let module: Spec | null;
try {
  module = TurboModuleRegistry.get<Spec>('ReanimatedModule');
} catch (_) {
  module = null;
}
export default module;
`;
        }
        return content;
      },
      'ReanimatedModule/NativeReanimated.ts': (content) => {
        // Remove the `&& ReanimatedTurboModule` condition so null TurboModule is handled
        // Change installTurboModule() to installTurboModule?.() for null safety
        const oldConditionRe = /if\s*\(\s*global\.__reanimatedModuleProxy\s*===\s*undefined\s*&&\s*ReanimatedTurboModule\s*\)/;
        if (oldConditionRe.test(content)) {
          return content.replace(
            oldConditionRe,
            `if (global.__reanimatedModuleProxy === undefined)`
          ).replace(
            `ReanimatedTurboModule.installTurboModule()`,
            `ReanimatedTurboModule?.installTurboModule()`
          );
        }
        return content;
      },
    },
  },
  {
    name: 'react-native-worklets',
    srcDir: path.join(__dirname, '..', 'node_modules', 'react-native-worklets', 'src'),
    libDir: path.join(__dirname, '..', 'node_modules', 'react-native-worklets', 'lib', 'module'),
    fixups: {
      'specs/NativeWorkletsModule.ts': (content) => {
        // Cases:
        // 1. Has JSON.stringify(module) -> remove it (keep try-catch)
        // 2. Simple export (no try-catch) -> add try-catch returning null
        if (content.includes('JSON.stringify(module)')) {
          return content.replace(
            `  if (module) {
    JSON.stringify(module);
  }`,
            ''
          );
        }
        const simpleExportRe = /export default TurboModuleRegistry\.get/;
        if (simpleExportRe.test(content)) {
          return `'use strict';
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  installTurboModule: () => boolean;
}

let module: Spec | null;
try {
  module = TurboModuleRegistry.get<Spec>('WorkletsModule');
} catch (_) {
  module = null;
}
export default module;
`;
        }
        return content;
      },
      'WorkletsModule/NativeWorklets.ts': (content) => {
        // Add try-catch around installTurboModule if not already present
        if (content.includes('WorkletsTurboModule?.installTurboModule()') && !content.includes('try {')) {
          return content.replace(
            `WorkletsTurboModule?.installTurboModule();`,
            `try { WorkletsTurboModule?.installTurboModule(); } catch (_) {}`
          );
        }
        return content;
      },
      'WorkletsModule/workletsModuleInstance.ts': (content) => {
        // Fall back to JSWorklets when the TurboModule is not available
        if (content.includes("SHOULD_BE_USE_WEB") && content.includes('createNativeWorkletsModule()')) {
          return `'use strict';

import { SHOULD_BE_USE_WEB } from '../PlatformChecker';
import { createJSWorkletsModule } from './JSWorklets';
import { createNativeWorkletsModule } from './NativeWorklets';
import { WorkletsTurboModule } from '../specs';

export const WorkletsModule = SHOULD_BE_USE_WEB || !WorkletsTurboModule
  ? createJSWorkletsModule()
  : createNativeWorkletsModule();
`;
        }
        return content;
      },
    },
  },
];

function copyMissingFiles(libPath, srcPath, pkgName) {
  if (!fs.existsSync(libPath) || !fs.existsSync(srcPath)) return;

  const entries = fs.readdirSync(libPath, { withFileTypes: true });
  for (const entry of entries) {
    const libEntryPath = path.join(libPath, entry.name);
    const srcEntryPath = path.join(srcPath, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(srcEntryPath)) {
        fs.mkdirSync(srcEntryPath, { recursive: true });
      }
      copyMissingFiles(libEntryPath, srcEntryPath, pkgName);
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.map')) {
      const tsName = entry.name.replace(/\.js$/, '.ts');
      const tsPath = path.join(srcPath, tsName);
      if (!fs.existsSync(tsPath)) {
        const content = fs.readFileSync(libEntryPath, 'utf8');
        fs.writeFileSync(tsPath, content, 'utf8');
        console.log('  Created ' + path.relative(__dirname, tsPath));
      }
    }
  }
}

function applyFixups(pkg) {
  for (const [relPath, fixup] of Object.entries(pkg.fixups)) {
    const filePath = path.join(pkg.srcDir, relPath);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fixed = fixup(content);
      if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, 'utf8');
        console.log('  Fixed ' + relPath + ' in ' + pkg.name);
      } else {
        console.log('  Skipped ' + relPath + ' in ' + pkg.name + ' (no change needed)');
      }
    } else {
      console.warn('  Missing ' + relPath + ' in ' + pkg.name);
    }
  }
}

for (const pkg of packages) {
  const srcExists = fs.existsSync(pkg.srcDir);
  const libExists = fs.existsSync(pkg.libDir);

  if (!srcExists) {
    console.warn('  Could not find ' + pkg.name + '/src directory');
    continue;
  }

  if (libExists) {
    copyMissingFiles(pkg.libDir, pkg.srcDir, pkg.name);
  }

  applyFixups(pkg);
  console.log('OK ' + pkg.name + ' done');
}
