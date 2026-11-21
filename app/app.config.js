// L'adresse de base change selon l'hébergement web (ex. /AppRun/ sur GitHub Pages).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || '' },
});
