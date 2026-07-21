/**
 * Bill Sheet PDF Themes
 * One place to control all PDF colors.
 */

export const PDF_THEMES = {
  forest: {
    name: "Forest",

    primary: [27, 67, 50],
    secondary: [45, 106, 79],
    accent: [64, 145, 108],

    success: [34, 197, 94],
    warning: [249, 115, 22],
    danger: [239, 68, 68],
    info: [59, 130, 246],

    text: [40, 40, 40],
    light: [247, 249, 251],
    border: [220, 226, 232],
    white: [255, 255, 255],
    footer: [120, 120, 120],
  },

  ocean: {
    name: "Ocean",

    primary: [15, 76, 117],
    secondary: [50, 130, 184],
    accent: [77, 168, 218],

    success: [34, 197, 94],
    warning: [249, 115, 22],
    danger: [239, 68, 68],
    info: [59, 130, 246],

    text: [40, 40, 40],
    light: [247, 249, 251],
    border: [220, 226, 232],
    white: [255, 255, 255],
    footer: [120, 120, 120],
  },
};

export function getPdfTheme(theme = "forest") {
  return PDF_THEMES[theme] || PDF_THEMES.forest;
}
