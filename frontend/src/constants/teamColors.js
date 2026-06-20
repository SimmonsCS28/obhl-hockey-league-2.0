// Shared team-color resolution for the redesign. Maps OBHL's stored color
// names (some truncated in the DB) to the hex values from the design handoff.
const TEAM_COLOR_MAP = {
    'Red': '#FF0000',
    'Blue': '#0000FF',
    'Orange': '#FFA500',
    'Green': '#008000',
    'Dk. Gre': '#006400',
    'Black': '#000000',
    'Maroon': '#800000',
    'Gray': '#808080',
    'Grey': '#808080',
    'Lt. Blu': '#ADD8E6',
    'Lt. Blue': '#ADD8E6',
    'Tan': '#D2B48C',
    'White': '#FFFFFF',
    'Yellow': '#FFD700',
    'Gold': '#FFD700',
    'Purple': '#800080',
    'Navy': '#000080',
};

// Resolve a stored team color (name or hex) to a usable CSS color.
export const resolveTeamColor = (color) => {
    if (!color) return '#808080';
    return TEAM_COLOR_MAP[color] || color;
};

// Luminance-based contrast color (#000 on light teams, #fff on dark teams).
export const textOn = (color) => {
    let hex = resolveTeamColor(color);
    if (!hex.startsWith('#')) return '#fff';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return '#fff';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#0b0c0f' : '#fff';
};
