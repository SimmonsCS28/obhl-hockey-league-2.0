import './TeamBadge.css';

const COLOR_MAP = {
    'Lt. Blu': '#ADD8E6',
    'White': '#FFFFFF',
    'Gray': '#808080',
    'Maroon': '#800000',
    'Black': '#000000',
    'Red': '#FF0000',
    'Blue': '#0000FF',
    'Green': '#008000',
    'Orange': '#FFA500',
    'Tan': '#D2B48C'
};

const TeamBadge = ({
    teamName,
    teamColor,
    className = '',
    style = {},
    onClick
}) => {
    const resolveColor = (color) => {
        if (!color) return '#ffffff';
        if (COLOR_MAP[color]) return COLOR_MAP[color];
        return color;
    };

    const getContrastYIQ = (color) => {
        if (!color) return 'black';
        
        let hex = color;
        // If it's a named color from our map, use the hex
        if (COLOR_MAP[color]) {
            hex = COLOR_MAP[color];
        }

        // If it's still not a hex (could be a CSS name like 'white'),
        // we can't easily calculate contrast without a full CSS color list.
        // For simplicity, we'll handle the most common ones or return black.
        if (!hex.startsWith('#')) {
            const darkColors = ['maroon', 'navy', 'black', 'purple', 'darkblue'];
            return darkColors.includes(hex.toLowerCase()) ? 'white' : 'black';
        }

        // Remove hash
        hex = hex.replace('#', '');

        // Handle 3-digit hex
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }

        if (hex.length !== 6) return 'black';

        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'black' : 'white';
    };

    const backgroundColor = resolveColor(teamColor);
    const contrastColor = getContrastYIQ(backgroundColor);

    const componentStyle = {
        backgroundColor,
        color: contrastColor,
        cursor: onClick ? 'pointer' : 'default',
        ...style
    };

    return (
        <span
            className={`team-badge ${className}`}
            style={componentStyle}
            onClick={onClick}
        >
            {teamName || 'Unknown Team'}
        </span>
    );
};

export default TeamBadge;
