module.exports = [
  ...require('eslint-config-next/core-web-vitals'),
  {
    rules: {
      // The current UI intentionally restores client state and starts async
      // loads from effects. Keep these React Compiler migration rules advisory
      // until those flows are refactored, while retaining the Hooks rules that
      // catch dependency and ordering bugs.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
];
