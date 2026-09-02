/**
 * Conventional Commits, enforced.
 *
 * This is not style policing: `commit-and-tag-version` derives the semantic
 * version from these messages. A commit typed `chore` when it is really a `feat`
 * produces a wrong version number and a changelog that lies to whoever upgrades.
 *
 * feat:     -> MINOR   fix: -> PATCH   BREAKING CHANGE footer -> MAJOR
 */

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scopes limited to the actual modules, so the changelog groups cleanly
    // instead of drifting into a dozen synonyms for the same area.
    'scope-enum': [
      2,
      'always',
      [
        'reservations',
        'resources',
        'availability',
        'auth',
        'users',
        'database',
        'health',
        'common',
        'config',
        'docker',
        // Developer tooling: the Makefile and everything under scripts/.
        'tooling',
        'ci',
        'docs',
        'deps',
        // commit-and-tag-version writes `chore(release): vX.Y.Z` itself, so
        // this scope has to be allowed or every release commit is rejected.
        'release',
      ],
    ],
    'scope-empty': [1, 'never'], // warning, not an error: some commits are global
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'body-max-line-length': [1, 'always', 100],
    'header-max-length': [2, 'always', 100],
  },
};
