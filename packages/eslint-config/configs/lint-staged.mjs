export default {
  '*.{js,jsx,ts,tsx}': 'pnpm lint --fix',
  '*.json': ['prettier --write'],
};
