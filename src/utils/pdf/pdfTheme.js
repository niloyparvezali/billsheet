/**
 * Bill Sheet PDF Themes
 * One place to control all PDF colors.
 */

export const PDF_THEMES = {
  sunrise: {
    name: "Sunrise",

    primary: [37, 99, 235],
    secondary: [14, 165, 233],
    accent: [59, 130, 246],

    success: [22, 163, 74],
    warning: [217, 119, 6],
    danger: [220, 38, 38],
    info: [14, 165, 233],

    text: [15, 23, 42],
    light: [248, 250, 252],
    border: [226, 232, 240],
    white: [255, 255, 255],
    footer: [100, 116, 139],
  },

  midnight: {
    name: "Midnight",

    primary: [17, 24, 39],
    secondary: [31, 41, 55],
    accent: [59, 130, 246],

    success: [34, 197, 94],
    warning: [245, 158, 11],
    danger: [239, 68, 68],
    info: [6, 182, 212],

    text: [40, 40, 40],
    light: [247, 249, 251],
    border: [220, 226, 232],
    white: [255, 255, 255],
    footer: [120, 120, 120],
  },

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
