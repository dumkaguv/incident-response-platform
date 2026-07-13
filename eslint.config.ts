import js from '@eslint/js'
import stylisticTs from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import regexpPlugin from 'eslint-plugin-regexp'
import securityPlugin from 'eslint-plugin-security'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked
    ],

    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.node,

      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname
      }
    },

    plugins: {
      import: importPlugin,
      unicorn: eslintPluginUnicorn,
      regexp: regexpPlugin,
      '@stylistic/ts': stylisticTs,
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
      security: securityPlugin
    },

    rules: {
      'no-else-return': 'warn',
      'no-extra-boolean-cast': 'error',
      eqeqeq: 'error',
      'no-debugger': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty-function': 'off',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-lonely-if': 'error',
      curly: ['error', 'all'],
      'arrow-body-style': ['error', 'as-needed'],
      'func-style': ['error', 'declaration'],
      'prefer-arrow-callback': ['error'],
      'require-await': 'error',

      'regexp/no-dupe-characters-character-class': 'error',
      'regexp/no-empty-character-class': 'error',
      'regexp/no-obscure-range': 'error',
      'regexp/no-useless-assertions': 'error',
      'regexp/no-useless-character-class': 'error',
      'regexp/prefer-quantifier': 'error',
      'regexp/no-super-linear-backtracking': 'error',

      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } }
      ],
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true }
      ],
      '@typescript-eslint/prefer-readonly': 'error',

      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': ['error', { allow: [] }],
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',

      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false
          }
        }
      ],

      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreVoid: true,
          ignoreIIFE: true
        }
      ],

      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/unbound-method': 'off',

      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
          allowNullish: true
        }
      ],

      '@stylistic/ts/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var']
        },
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'any', prev: 'directive', next: 'directive' },
        { blankLine: 'always', prev: ['case', 'default'], next: '*' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: 'if', next: '*' }
      ],

      'unicorn/filename-case': [
        'error',
        {
          cases: {
            kebabCase: true,
            camelCase: true,
            pascalCase: true
          }
        }
      ],

      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`^(\./)*(\.\./){2,}`,
              message:
                'Do not use 2+ parent relative imports. Use @/alias instead.'
            }
          ]
        }
      ],

      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/no-named-as-default': 'warn',
      'import/no-named-as-default-member': 'warn',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-cycle': ['error', { maxDepth: 2 }],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type'
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after'
            }
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          },
          'newlines-between': 'always-and-inside-groups',
          named: {
            import: true,
            export: true,
            require: false,
            cjsExports: false,
            types: 'types-first'
          }
        }
      ]
    }
  },

  // OVERRIDE for tests
  {
    files: ['**/*.{spec,test}.{ts,js}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      '@typescript-eslint/unbound-method': 'off',

      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off'
    }
  },

  // OVERRIDE for dto
  {
    files: ['**/*.dto.ts'],
    rules: {
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/member-ordering': 'off'
    }
  },

  // OVERRIDE for prisma
  {
    files: ['prisma/**/*.{ts,js}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      '@typescript-eslint/unbound-method': 'off',

      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/return-await': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',

      'func-style': 'off'
    }
  },

  // OVERRIDE for barrel-files index.ts
  {
    files: ['**/index.ts'],
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error'
    }
  }
)
