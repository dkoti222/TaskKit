import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  // Nest 12 packages are ES modules, but some (like @nestjs/throttler) are CommonJS and
  // require() them. Node 22 can do that; Jest can't until Node 24.9. So Jest compiles the
  // @nestjs packages to CommonJS too (`transformIgnorePatterns` lets it touch node_modules/@nestjs).
  transform: {
    '^.+\\.[tj]s$': [
      '<rootDir>/test/jest-transform.cjs', // ts-jest + an import.meta fix, see that file
      {
        // Each file is compiled on its own (isolatedModules), so resolution settings don't matter
        // here; these just make TypeScript accept CommonJS output.
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node10',
          ignoreDeprecations: '6.0',
          resolvePackageJsonExports: false,
          allowJs: true,
          isolatedModules: true,
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@nestjs|expo-server-sdk)/)'],
  moduleNameMapper: {
    // TypeScript ES-module style: `import './x.js'` means the file x.ts.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
