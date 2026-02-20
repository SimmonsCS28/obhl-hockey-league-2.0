import './TeamBadge.css';

const TeamBadge = ({
    teamName,
    teamColor,
    className = '',
    style = {},
    onClick
}) => {
    const getContrastYIQ = (hexcolor) => {
        if (!hexcolor) return 'black';
        // Remove hash if present
        hexcolor = hexcolor.replace('#', '');

        // Handle 3-digit hex (e.g. #FFF -> #FFFFFF)
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(c => c + c).join('');
        }

        // Validate length
        if (hexcolor.length !== 6) return 'black';

        var r = parseInt(hexcolor.substr(0, 2), 16);
        var g = parseInt(hexcolor.substr(2, 2), 16);
        var b = parseInt(hexcolor.substr(4, 2), 16);
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'black' : 'white';
    };

    const contrastColor = getContrastYIQ(teamColor || '#ffffff');
    const backgroundColor = teamColor || '#ffffff';

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
